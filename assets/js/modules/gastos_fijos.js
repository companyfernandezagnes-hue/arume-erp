/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS (La Mochila del Restaurante)
   ============================================================= */

export async function render(container, supabase, db) {
    // Aseguramos que la estructura existe en tu caja fuerte Diamond
    if (!db.gastos_fijos) db.gastos_fijos = []; [cite: 9, 52]
    
    const saveFn = window.save || (async () => {}); [cite: 14]

    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6">
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-center border border-slate-50">
                <div>
                    <h2 class="text-xl font-black text-slate-800 text-indigo-600">Gastos Fijos</h2>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Estructura de "La Mochila"</p>
                </div>
                <button id="btnAddFijo" class="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg active:scale-95 transition">
                    + AÑADIR CONCEPTO
                </button>
            </header>

            <div id="listaFijos" class="grid gap-3"></div>

            <div class="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl flex justify-between items-center">
                <div>
                    <p class="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Carga Fija Mensual Total</p>
                    <p id="totalMensual" class="text-3xl font-black">0.00€</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Punto de Equilibrio Diario (est.)</p>
                    <p id="puntoDiario" class="text-xl font-black">0.00€</p>
                </div>
            </div>
        </div>
        <div id="modalFijo" class="hidden"></div>
    `;

    const listaDiv = container.querySelector("#listaFijos");
    const totalDiv = container.querySelector("#totalMensual");
    const diarioDiv = container.querySelector("#puntoDiario");

    const refresh = () => {
        let totalMensual = 0;
        listaDiv.innerHTML = db.gastos_fijos.map(g => {
            const importe = parseFloat(g.amount) || 0;
            const mensual = g.freq === 'anual' ? importe / 12 : importe; [cite: 9, 52]
            totalMensual += mensual;

            return `
                <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                        <p class="font-bold text-slate-800 text-base">${g.concept}</p>
                        <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${g.freq === 'anual' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}">
                            ${g.freq.toUpperCase()}
                        </span>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                            <p class="font-black text-slate-900 text-lg">${importe.toFixed(2)}€</p>
                            ${g.freq === 'anual' ? `<p class="text-[9px] text-slate-400">Prorrateado: ${mensual.toFixed(2)}€/mes</p>` : ''}
                        </div>
                        <button onclick="deleteFijo('${g.id}')" class="text-slate-300 hover:text-rose-500 transition text-xl">✕</button>
                    </div>
                </div>
            `;
        }).join('');
        
        totalDiv.innerText = totalMensual.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + "€";
        diarioDiv.innerText = ((totalMensual * 1.5) / 30).toFixed(2) + "€"; // Estimación rápida de venta diaria necesaria 
    };

    // --- LÓGICA DE INTERACCIÓN ---
    container.querySelector("#btnAddFijo").onclick = () => {
        const modal = container.querySelector("#modalFijo");
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex justify-center items-center z-[200] p-4">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-slide-up">
                    <h3 class="text-xl font-black text-slate-800 mb-6">Nuevo Gasto Fijo</h3>
                    <div class="space-y-4">
                        <input id="f-concept" type="text" placeholder="Concepto (Ej: Alquiler, Gestoría...)" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500 transition">
                        <input id="f-amount" type="number" placeholder="Importe (€)" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500 transition">
                        <select id="f-freq" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none">
                            <option value="mensual">Cada Mes</option>
                            <option value="anual">Una vez al año (Prorratear)</option>
                        </select>
                        <div class="pt-4 flex gap-2">
                            <button id="f-save" class="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition">GUARDAR</button>
                            <button onclick="document.getElementById('modalFijo').classList.add('hidden')" class="px-6 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black">CANCELAR</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.querySelector("#f-save").onclick = async () => {
            const concept = container.querySelector("#f-concept").value.trim();
            const amount = parseFloat(container.querySelector("#f-amount").value);
            const freq = container.querySelector("#f-freq").value;

            if (!concept || isNaN(amount)) return;

            db.gastos_fijos.push({ 
                id: Math.random().toString(36).slice(2,11), [cite: 12]
                concept, amount, freq 
            });
            
            await saveFn("Gasto fijo actualizado en la nube"); [cite: 14]
            modal.classList.add("hidden");
            refresh();
        };
    };

    window.deleteFijo = async (id) => {
        if (!confirm("¿Eliminar este gasto de la mochila?")) return;
        db.gastos_fijos = db.gastos_fijos.filter(g => g.id !== id);
        await saveFn("Gasto fijo eliminado"); [cite: 14]
        refresh();
    };

    refresh();
}
