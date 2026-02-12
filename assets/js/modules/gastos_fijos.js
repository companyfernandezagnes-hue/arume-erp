/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS PRO (Versión Final Sin Errores)
   ============================================================= */

export async function render(container, supabase, db) {
    if (!db.gastos_fijos) db.gastos_fijos = [];
    
    const saveToCloud = async (msg) => {
        db.lastSync = Date.now();
        const { error } = await supabase.from('arume_data').upsert({ id: 1, data: db });
        if (error) console.error("Error:", error);
    };

    const getMensual = (g) => {
        const importe = parseFloat(g.amount || g.v || 0);
        const f = g.freq || 'mensual';
        if (f === 'trimestral') return importe / 3;
        if (f === 'anual') return importe / 12;
        if (f === 'semanal') return importe * 4.33;
        return importe;
    };

    // --- FUNCIÓN DE DIBUJO ---
    const draw = () => {
        const listaDiv = container.querySelector("#listaFijos");
        let totalTotal = 0;

        listaDiv.innerHTML = db.gastos_fijos.map(g => {
            const mensual = getMensual(g);
            totalTotal += mensual;
            return `
                <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer active:scale-95 transition-all" 
                     onclick="window.abrirEditorFijo('${g.id}')">
                    <div class="flex-1">
                        <h4 class="font-black text-slate-800">${g.concept || g.n || 'Sin nombre'}</h4>
                        <span class="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase">${g.freq || 'mensual'}</span>
                    </div>
                    <div class="text-right">
                        <p class="font-black text-slate-900">${(parseFloat(g.amount || g.v || 0)).toFixed(2)}€</p>
                        <p class="text-[8px] font-bold text-indigo-400 uppercase">Impacto: ${mensual.toFixed(2)}€/mes</p>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelector("#totalMensual").innerText = totalTotal.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
    };

    // --- ESTRUCTURA ---
    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6 pb-20">
            <header class="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm">
                <h2 class="text-xl font-black text-slate-800 uppercase tracking-tighter">Mochila Fija</h2>
                <button id="btnAdd" class="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg">+ AÑADIR</button>
            </header>
            <div id="listaFijos" class="grid gap-3"></div>
            <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Carga Mensual Total</p>
                <p id="totalMensual" class="text-3xl font-black text-emerald-400">0.00€</p>
            </div>
        </div>
        <div id="modalFijo" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[500] flex justify-center items-center p-4"></div>
    `;

    // --- EDITOR (ANCLADO A WINDOW) ---
    window.abrirEditorFijo = (id = null) => {
        const modal = container.querySelector("#modalFijo");
        const item = id ? db.gastos_fijos.find(x => x.id === id) : { concept: '', amount: '', freq: 'mensual', taxPct: 10 };
        
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
                <h3 class="text-xl font-black mb-6">${id ? 'EDITAR GASTO' : 'NUEVO GASTO'}</h3>
                <div class="space-y-4">
                    <input id="f-concept" type="text" value="${item.concept || item.n || ''}" placeholder="Concepto" class="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-0">
                    <input id="f-amount" type="number" value="${item.amount || item.v || ''}" placeholder="Importe €" class="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-0">
                    <select id="f-freq" class="w-full p-4 bg-slate-50 rounded-2xl font-bold border-0">
                        <option value="mensual" ${item.freq=='mensual'?'selected':''}>Mensual</option>
                        <option value="trimestral" ${item.freq=='trimestral'?'selected':''}>Trimestral</option>
                        <option value="anual" ${item.freq=='anual'?'selected':''}>Anual</option>
                    </select>
                    <div class="pt-4 flex gap-2">
                        <button id="f-save-btn" class="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black">GUARDAR</button>
                        <button onclick="document.getElementById('modalFijo').classList.add('hidden')" class="px-4 text-slate-400 font-bold">✕</button>
                    </div>
                    ${id ? `<button id="f-del-btn" class="w-full text-rose-500 font-bold text-xs pt-4">ELIMINAR GASTO DEFINITIVAMENTE</button>` : ''}
                </div>
            </div>
        `;

        document.getElementById("f-save-btn").onclick = async () => {
            const concept = document.getElementById("f-concept").value;
            const amount = parseFloat(document.getElementById("f-amount").value);
            const freq = document.getElementById("f-freq").value;

            if (!concept || isNaN(amount)) return;

            const newItem = { id: id || Date.now().toString(), concept, amount, freq };
            if (id) {
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                db.gastos_fijos[idx] = newItem;
            } else {
                db.gastos_fijos.push(newItem);
            }

            await saveToCloud("Mochila actualizada");
            modal.classList.add("hidden");
            draw();
        };

        if(id) {
            document.getElementById("f-del-btn").onclick = async () => {
                if(!confirm("¿Borrar?")) return;
                db.gastos_fijos = db.gastos_fijos.filter(x => x.id !== id);
                await saveToCloud("Eliminado");
                modal.classList.add("hidden");
                draw();
            };
        }
    };

    container.querySelector("#btnAdd").onclick = () => window.abrirEditorFijo();
    draw();
}
