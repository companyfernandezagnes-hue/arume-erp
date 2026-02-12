/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS (Conexión Diamond a Supabase)
   ============================================================= */

export async function render(container, supabase, db) {
    // IMPORTANTE: Usamos 'gastos_fijos' porque es como se llama en tu PDF original
    if (!db.gastos_fijos) db.gastos_fijos = [];
    
    // Función de guardado que sobreescribe la fila 1 de arume_data
    const saveToCloud = async () => {
        const { error } = await supabase
            .from('arume_data')
            .upsert({ id: 1, data: db }); 
        if (error) console.error("Error sincronizando:", error);
    };

    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6">
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-indigo-600">Gastos Fijos</h2>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronizado con Supabase</p>
                </div>
                <button id="btnAddFijo" class="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg">
                    + AÑADIR
                </button>
            </header>

            <div id="listaFijos" class="grid gap-3"></div>

            <div class="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl">
                <p class="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Carga Fija Mensual</p>
                <p id="totalMensual" class="text-3xl font-black">0.00€</p>
            </div>
        </div>
        <div id="modalFijo" class="hidden"></div>
    `;

    const listaDiv = container.querySelector("#listaFijos");
    const totalDiv = container.querySelector("#totalMensual");

    const refresh = () => {
        let totalMensual = 0;
        listaDiv.innerHTML = db.gastos_fijos.map(g => {
            const importe = parseFloat(g.amount) || 0;
            // Si en tu base de datos antigua 'freq' era 'mensual' o 'anual'
            const mensual = g.freq === 'anual' ? importe / 12 : importe;
            totalMensual += mensual;

            return `
                <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                        <p class="font-bold text-slate-800 text-base">${g.concept}</p>
                        <span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">${g.freq}</span>
                    </div>
                    <div class="flex items-center gap-6">
                        <p class="font-black text-slate-900 text-lg">${importe.toFixed(2)}€</p>
                        <button onclick="deleteFijo('${g.id}')" class="text-slate-300 hover:text-rose-500 transition text-xl">✕</button>
                    </div>
                </div>
            `;
        }).join('');
        totalDiv.innerText = totalMensual.toLocaleString('es-ES') + "€";
    };

    // Lógica para añadir (idéntica a la que tenías pero salvando en la nube)
    container.querySelector("#btnAddFijo").onclick = () => {
        const modal = container.querySelector("#modalFijo");
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex justify-center items-center z-[200] p-4">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
                    <h3 class="text-xl font-black text-slate-800 mb-6">Nuevo Gasto Fijo</h3>
                    <input id="f-concept" type="text" placeholder="Concepto" class="w-full p-4 bg-slate-50 rounded-2xl mb-4 border-0 font-bold">
                    <input id="f-amount" type="number" placeholder="Importe (€)" class="w-full p-4 bg-slate-50 rounded-2xl mb-4 border-0 font-bold">
                    <select id="f-freq" class="w-full p-4 bg-slate-50 rounded-2xl mb-6 border-0 font-bold">
                        <option value="mensual">Mensual</option>
                        <option value="anual">Anual</option>
                    </select>
                    <button id="f-save" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">GUARDAR EN NUBE</button>
                </div>
            </div>
        `;

        container.querySelector("#f-save").onclick = async () => {
            const concept = container.querySelector("#f-concept").value;
            const amount = container.querySelector("#f-amount").value;
            const freq = container.querySelector("#f-freq").value;
            
            db.gastos_fijos.push({ id: Date.now().toString(), concept, amount, freq });
            await saveToCloud();
            modal.classList.add("hidden");
            refresh();
        };
    };

    window.deleteFijo = async (id) => {
        db.gastos_fijos = db.gastos_fijos.filter(g => g.id !== id);
        await saveToCloud();
        refresh();
    };

    refresh();
}
