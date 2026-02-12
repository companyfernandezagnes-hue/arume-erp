/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS PRO (Estructura Contable y Prorrateo)
   ============================================================= */

export async function render(container, supabase, db) {
    if (!db.gastos_fijos) db.gastos_fijos = [];
    
    // Configuración local basada en tus motores financieros [cite: 237-263]
    const SALES_EST = (typeof CONFIG !== 'undefined' && CONFIG.EST_MONTHLY_SALES) ? CONFIG.EST_MONTHLY_SALES : 3000;

    const saveToCloud = async (msg) => {
        db.lastSync = Date.now(); // [cite: 386]
        try {
            const { error } = await supabase.from('arume_data').upsert({ id: 1, data: db }); // [cite: 388]
            if (error) throw error;
            if (typeof toast !== 'undefined') toast(msg, 'success'); // [cite: 390]
        } catch (e) {
            if (typeof toast !== 'undefined') toast("Guardado local", "info"); // [cite: 391]
        }
    };

    // --- LÓGICA DE PRORRATEO EXACTO ---
    const calcImpactoMensual = (g) => {
        const importe = parseFloat(g.amount) || 0;
        if (g.oneOff) return importe; // Gasto puntual no se prorratea
        
        const freqMap = {
            'semanal': 4.33,
            'mensual': 1,
            'bimensual': 0.5,
            'trimestral': 1/3, // [cite: 244]
            'semestral': 1/6,
            'anual': 1/12 // [cite: 245]
        };
        
        return importe * (freqMap[g.freq] || 1);
    };

    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6" role="main">
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-end border border-slate-50">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Estructura Fija</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Contabilidad y Centros de Coste</p>
                </div>
                <button id="btnAddFijo" class="btn-premium w-auto px-6 py-3" aria-label="Añadir nuevo gasto">
                    + NUEVO GASTO
                </button>
            </header>

            <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Mochila Mensual</p>
                    <p id="totalMensual" class="text-2xl font-black text-emerald-400">0,00 €</p>
                </div>
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Impacto / Plato</p>
                    <p id="impactoPlato" class="text-2xl font-black text-indigo-600">0,00 €</p>
                    <p class="text-[8px] text-slate-300 font-bold uppercase">Sobre ${SALES_EST} vtas/mes</p>
                </div>
                <div class="hidden lg:block bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Próximo Vencimiento</p>
                    <p id="proximoVto" class="text-sm font-bold text-slate-700 mt-2">--</p>
                </div>
            </div>

            <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button class="bg-slate-800 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase">Todos</button>
                <button class="bg-white text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border border-slate-100">Cocina</button>
                <button class="bg-white text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border border-slate-100">Sala</button>
                <button class="bg-white text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border border-slate-100">Delivery</button>
            </div>

            <div id="listaFijos" class="grid gap-3"></div>
        </div>
        <div id="overlayFijo" class="overlay hidden" role="dialog" aria-modal="true"></div>
    `;

    const refresh = () => {
        let totalAcumulado = 0;
        const listaDiv = container.querySelector("#listaFijos");
        
        db.gastos_fijos.sort((a,b) => calcImpactoMensual(b) - calcImpactoMensual(a));

        listaDiv.innerHTML = db.gastos_fijos.map(g => {
            const mensual = calcImpactoMensual(g);
            totalAcumulado += mensual;
            const prov = db.proveedores.find(p => p.id === g.provId) || { n: 'Sin Prov.' };
            
            // Alarma de vencimiento (< 7 días)
            const hoy = new Date().getDate();
            const esUrgente = g.dueDay && (g.dueDay - hoy > 0 && g.dueDay - hoy < 7);

            return `
                <div class="glass-card flex justify-between items-center group p-5 mb-0 border-l-4 ${mensual > (totalAcumulado * 0.35) ? 'border-l-rose-500' : 'border-l-indigo-500'}">
                    <div class="flex-1 cursor-pointer" onclick="openFijoModal('${g.id}')">
                        <div class="flex items-center gap-2 mb-1">
                            <h4 class="font-black text-slate-800">${g.concept}</h4>
                            ${g.indexation?.kind !== 'ninguna' ? '<span class="text-[7px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black uppercase">Indexado</span>' : ''}
                            ${esUrgente ? '<span class="animate-pulse text-[12px]">⚠️</span>' : ''}
                        </div>
                        <div class="flex gap-3 text-[9px] font-bold uppercase text-slate-400">
                            <span class="text-indigo-500">${g.center || 'General'}</span>
                            <span>•</span>
                            <span>${prov.n}</span>
                            <span>•</span>
                            <span class="${esUrgente ? 'text-rose-500' : ''}">Día ${g.dueDay || '--'}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-slate-900">${mensual.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${g.freq} | +${(mensual/SALES_EST).toFixed(2)}€ / Plato</p>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelector("#totalMensual").innerText = totalAcumulado.toLocaleString('es-ES', {style:'currency', currency:'EUR'});
        container.querySelector("#impactoPlato").innerText = (totalAcumulado / SALES_EST).toLocaleString('es-ES', {style:'currency', currency:'EUR'});
    };

    // --- MODAL DE EDICIÓN PRO ---
    window.openFijoModal = (id = null) => {
        const item = id ? db.gastos_fijos.find(x => x.id === id) : { 
            id: crypto.randomUUID(), concept: '', amount: 0, freq: 'mensual', 
            center: 'General', taxPct: 10, dueDay: 1, indexation: {kind: 'ninguna'} 
        };

        const overlay = container.querySelector("#overlayFijo");
        overlay.classList.remove("hidden");
        overlay.innerHTML = `
            <div class="modal max-w-lg">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-800 uppercase">${id ? 'Editar Gasto' : 'Nuevo Fijo'}</h3>
                    <button onclick="document.getElementById('overlayFijo').classList.add('hidden')" class="btn-icon">✕</button>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="col-span-2 text-center bg-slate-50 p-4 rounded-3xl border border-dashed border-slate-200">
                        <label>Importe Total Bruto</label>
                        <input id="f-amount" type="number" value="${item.amount}" class="bg-transparent text-3xl font-black text-center w-full outline-none text-indigo-600">
                    </div>
                    <div>
                        <label>Concepto</label>
                        <input id="f-concept" type="text" value="${item.concept}" class="input-premium" placeholder="Alquiler...">
                    </div>
                    <div>
                        <label>Centro de Coste</label>
                        <select id="f-center" class="input-premium">
                            <option value="General" ${item.center==='General'?'selected':''}>General</option>
                            <option value="Cocina" ${item.center==='Cocina'?'selected':''}>Cocina</option>
                            <option value="Sala" ${item.center==='Sala'?'selected':''}>Sala</option>
                            <option value="Oficina" ${item.center==='Oficina'?'selected':''}>Oficina</option>
                        </select>
                    </div>
                    <div>
                        <label>Frecuencia de Pago</label>
                        <select id="f-freq" class="input-premium">
                            <option value="mensual" ${item.freq==='mensual'?'selected':''}>Mensual</option>
                            <option value="trimestral" ${item.freq==='trimestral'?'selected':''}>Trimestral</option>
                            <option value="anual" ${item.freq==='anual'?'selected':''}>Anual</option>
                            <option value="semanal" ${item.freq==='semanal'?'selected':''}>Semanal</option>
                        </select>
                    </div>
                    <div>
                        <label>Día Vencimiento</label>
                        <input id="f-due" type="number" value="${item.dueDay}" min="1" max="31" class="input-premium text-center">
                    </div>
                </div>

                <div class="flex gap-3 mt-8">
                    <button id="btnSaveFijo" class="btn-premium flex-1">SINCRO NUBE</button>
                    ${id ? `<button onclick="deleteFijo('${id}')" class="btn-ghost text-rose-500 border-rose-100 w-auto">Eliminar</button>` : ''}
                </div>
            </div>
        `;

        document.getElementById("btnSaveFijo").onclick = async () => {
            const amount = parseFloat(document.getElementById("f-amount").value) || 0;
            const concept = document.getElementById("f-concept").value.trim();
            const freq = document.getElementById("f-freq").value;
            const center = document.getElementById("f-center").value;
            const dueDay = parseInt(document.getElementById("f-due").value);

            if (!concept || amount <= 0) return alert("Concepto e Importe obligatorios");

            const index = db.gastos_fijos.findIndex(x => x.id === item.id);
            const finalObj = { ...item, concept, amount, freq, center, dueDay };

            if (index >= 0) db.gastos_fijos[index] = finalObj;
            else db.gastos_fijos.push(finalObj);

            await saveToCloud("Mochila actualizada");
            overlay.classList.add("hidden");
            refresh();
        };
    };

    container.querySelector("#btnAddFijo").onclick = () => openFijoModal();

    window.deleteFijo = async (id) => {
        if (!confirm("¿Eliminar gasto de la estructura?")) return;
        db.gastos_fijos = db.gastos_fijos.filter(x => x.id !== id);
        await saveToCloud("Gasto eliminado");
        container.querySelector("#overlayFijo").classList.add("hidden");
        refresh();
    };

    refresh();
}
