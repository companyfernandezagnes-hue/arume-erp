/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS PRO (Versión 2.0 - Edición y Sincro)
   ============================================================= */

export async function render(container, supabase, db) {
    if (!db.gastos_fijos) db.gastos_fijos = [];
    
    // Función de guardado robusta
    const saveToCloud = async (msg) => {
        db.lastSync = Date.now();
        const { error } = await supabase.from('arume_data').upsert({ id: 1, data: db });
        if (error) console.error("Error:", error);
        else console.log("☁️ " + msg);
    };

    // Lógica de cálculo (Mantenemos la inteligencia de prorrateo)
    const getMensual = (g) => {
        const importe = parseFloat(g.amount || g.v || 0);
        const f = g.freq || 'mensual';
        if (f === 'trimestral') return importe / 3;
        if (f === 'anual') return importe / 12;
        if (f === 'semanal') return importe * 4.33;
        return importe;
    };

    const drawList = () => {
        const listaDiv = container.querySelector("#listaFijos");
        let totalMochila = 0;

        listaDiv.innerHTML = db.gastos_fijos.map(g => {
            const mensual = getMensual(g);
            totalMochila += mensual;
            // Compatibilidad con nombres antiguos (n = nombre, v = valor)
            const nombre = g.concept || g.n || 'Sin nombre';
            const valor = g.amount || g.v || 0;

            return `
                <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition-transform" 
                     onclick="window.abrirEditorFijo('${g.id}')">
                    <div class="flex-1">
                        <h4 class="font-black text-slate-800">${nombre}</h4>
                        <div class="flex gap-2 mt-1">
                            <span class="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase">${g.freq || 'mensual'}</span>
                            <span class="text-[8px] font-bold text-slate-400 uppercase">${g.center || 'General'}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-black text-slate-900 text-lg">${parseFloat(valor).toFixed(2)}€</p>
                        <p class="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">Impacto: ${mensual.toFixed(2)}€/mes</p>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelector("#totalMensual").innerText = totalAcumulado.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
    };

    // --- INTERFAZ BASE ---
    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6">
            <header class="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Mochila Fija</h2>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">Gestión de Estructura</p>
                </div>
                <button id="btnAddFijo" class="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg">+ AÑADIR</button>
            </header>

            <div id="listaFijos" class="grid gap-3"></div>

            <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex justify-between items-center">
                <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Carga Mensual Total</p>
                    <p id="totalMensual" class="text-3xl font-black text-emerald-400">0.00€</p>
                </div>
            </div>
        </div>
        <div id="modalFijo" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[500] flex justify-center items-center p-4"></div>
    `;

    // --- FUNCIÓN GLOBAL DE EDICIÓN ---
    window.abrirEditorFijo = (id = null) => {
        const modal = container.querySelector("#modalFijo");
        const item = id ? db.gastos_fijos.find(x => x.id === id) : { concept: '', amount: '', freq: 'mensual', taxPct: 10, center: 'General', dueDay: 1 };
        
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-slide-up">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-800">${id ? 'EDITAR GASTO' : 'NUEVO GASTO'}</h3>
                    <button onclick="document.getElementById('modalFijo').classList.add('hidden')" class="text-slate-300 text-2xl">✕</button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Concepto del gasto</label>
                        <input id="f-concept" type="text" value="${item.concept || item.n || ''}" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Importe Bruto (€)</label>
                            <input id="f-amount" type="number" value="${item.amount || item.v || ''}" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">% IVA</label>
                            <select id="f-tax" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none">
                                <option value="0" ${item.taxPct==0?'selected':''}>0% (Exento)</option>
                                <option value="4" ${item.taxPct==4?'selected':''}>4% (Super)</option>
                                <option value="10" ${item.taxPct==10?'selected':''}>10% (Reducido)</option>
                                <option value="21" ${item.taxPct==21?'selected':''}>21% (General)</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Periodicidad</label>
                            <select id="f-freq" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none">
                                <option value="mensual" ${item.freq=='mensual'?'selected':''}>Mensual</option>
                                <option value="trimestral" ${item.freq=='trimestral'?'selected':''}>Trimestral</option>
                                <option value="anual" ${item.freq=='anual'?'selected':''}>Anual</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Día de cobro</label>
                            <input id="f-due" type="number" value="${item.dueDay || 1}" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold outline-none">
                        </div>
                    </div>

                    <div class="pt-6 space-y-2">
                        <button id="f-save-btn" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-transform">GUARDAR CAMBIOS</button>
                        ${id ? `<button id="f-delete-btn" class="w-full bg-rose-50 text-rose-500 py-4 rounded-2xl font-bold text-xs">ELIMINAR GASTO</button>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Acción Guardar
        document.getElementById("f-save-btn").onclick = async () => {
            const concept = document.getElementById("f-concept").value;
            const amount = parseFloat(document.getElementById("f-amount").value);
            const freq = document.getElementById("f-freq").value;
            const taxPct = parseInt(document.getElementById("f-tax").value);
            const dueDay = parseInt(document.getElementById("f-due").value);

            if (!concept || isNaN(amount)) return;

            const nuevoGasto = { 
                id: id || Math.random().toString(36).substr(2, 9), 
                concept, amount, freq, taxPct, dueDay,
                center: item.center || 'General'
            };

            if (id) {
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                db.gastos_fijos[idx] = nuevoGasto;
            } else {
                db.gastos_fijos.push(nuevoGasto);
            }

            await saveToCloud("Mochila actualizada");
            modal.classList.add("hidden");
            drawList();
        };

        // Acción Eliminar
        if(id) {
            document.getElementById("f-delete-btn").onclick = async () => {
                if(!confirm("¿Seguro que quieres borrar este gasto?")) return;
                db.gastos_fijos = db.gastos_fijos.filter(x => x.id !== id);
                await saveToCloud("Gasto eliminado");
                modal.classList.add("hidden");
                drawList();
            };
        }
    };

    container.querySelector("#btnAddFijo").onclick = () => window.abrirEditorFijo();
    
    // Dibujar lista inicial
    drawList();
}
