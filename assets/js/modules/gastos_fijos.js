/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS (Pro: Checklist + Vigencia + Buscador)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. GESTIÓN DE DATOS (Compatibilidad asegurada)
    if (!Array.isArray(db.gastos_fijos)) db.gastos_fijos = [];
    
    // Control de pagos del mes actual
    const today = new Date();
    const currentKey = `pagos_${today.getFullYear()}_${today.getMonth()}`;
    if (!db.control_pagos) db.control_pagos = {};
    if (!db.control_pagos[currentKey]) db.control_pagos[currentKey] = [];

    // Helpers de cálculo avanzado
    const getMensual = (g) => {
        let amount = parseFloat(g.amount) || 0;
        // Lógica de prorrateo precisa
        if (g.freq === 'anual') return amount / 12;
        if (g.freq === 'trimestral') return amount / 3;
        if (g.freq === 'semanal') return amount * 4.33; // Media semanas/mes
        return amount;
    };

    // Calcular Total Mensual (Solo activos y vigentes)
    const totalMensual = db.gastos_fijos
        .filter(g => g.active !== false) // Soft delete check
        .reduce((acc, g) => acc + getMensual(g), 0);

    const costeDiario = totalMensual / 30;

    // 2. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Estructura de Costes</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">
                    Control ${today.toLocaleDateString('es-ES', {month:'long'})}
                </p>
            </div>
            
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-auto">
                <span class="text-slate-400">🔍</span>
                <input id="txtSearch" type="text" placeholder="Buscar gasto..." class="bg-transparent outline-none text-xs font-bold text-slate-600 w-full md:w-32">
            </div>

            <div class="flex gap-4">
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Mochila Mensual</p>
                    <p class="text-2xl font-black text-slate-800">${totalMensual.toLocaleString('es-ES', {maximumFractionDigits:0})}€</p>
                </div>
                <div class="text-right border-l pl-4 border-slate-100 hidden md:block">
                    <p class="text-[9px] font-black text-rose-400 uppercase">Coste/Día</p>
                    <p class="text-2xl font-black text-rose-500">${costeDiario.toLocaleString('es-ES', {maximumFractionDigits:0})}€</p>
                </div>
            </div>
        </header>

        <button id="btnNuevo" class="w-full py-4 rounded-[2rem] bg-indigo-50 text-indigo-600 font-black text-xs hover:bg-indigo-100 transition border border-indigo-100 border-dashed">
            + AÑADIR NUEVO GASTO FIJO
        </button>

        <div id="listaGastos" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20"></div>
    </div>

    <div id="modalGasto" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
    `;

    // 3. RENDERIZADO INTELIGENTE
    const pintarLista = () => {
        const term = container.querySelector("#txtSearch").value.toLowerCase();
        const lista = container.querySelector("#listaGastos");
        const pagados = db.control_pagos[currentKey];

        const filtered = db.gastos_fijos.filter(g => {
            if (g.active === false) return false; // Ocultar borrados
            return (g.name || "").toLowerCase().includes(term);
        }).sort((a,b) => getMensual(b) - getMensual(a)); // Ordenar por importe

        if (filtered.length === 0) {
            lista.innerHTML = `<div class="col-span-full text-center py-10 opacity-50 italic">No se encontraron gastos activos.</div>`;
            return;
        }

        lista.innerHTML = filtered.map(g => {
            const isPaid = pagados.includes(g.id);
            const mensual = getMensual(g);
            
            // Alerta de Vigencia
            let vigenciaAlert = "";
            if(g.end) {
                const diasRestantes = Math.ceil((new Date(g.end) - new Date()) / (1000 * 60 * 60 * 24));
                if(diasRestantes < 30 && diasRestantes > 0) vigenciaAlert = `<span class="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded ml-2">Vence en ${diasRestantes} días</span>`;
                if(diasRestantes < 0) vigenciaAlert = `<span class="text-[8px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded ml-2">VENCIDO</span>`;
            }

            return `
            <div class="bg-white p-5 rounded-[2rem] border ${isPaid ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100'} shadow-sm relative group transition-all hover:shadow-md">
                
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <span class="text-2xl flex-shrink-0">${getIcon(g.cat)}</span>
                        <div class="min-w-0">
                            <h4 class="font-black text-slate-800 leading-none truncate cursor-pointer hover:text-indigo-600 transition" onclick="window.editarGasto('${g.id}')">${g.name}</h4>
                            <div class="flex items-center mt-1">
                                <span class="text-[9px] text-slate-400 font-bold uppercase">${g.freq}</span>
                                ${vigenciaAlert}
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="window.togglePago('${g.id}')" class="flex-shrink-0 transition-all active:scale-90">
                        ${isPaid 
                            ? `<span class="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-emerald-200 flex items-center gap-1">✅ PAGADO</span>` 
                            : `<span class="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black hover:bg-slate-200 border border-slate-200">PENDIENTE</span>`
                        }
                    </button>
                </div>

                <div class="flex justify-between items-end mt-4 pt-2 border-t border-slate-50">
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold uppercase">Recibo</p>
                        <p class="text-lg font-black text-slate-800">${parseFloat(g.amount).toLocaleString()}€</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] text-indigo-400 font-bold uppercase">Mensual</p>
                        <p class="text-base font-black text-indigo-600">${mensual.toFixed(0)}€</p>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // Evento Buscador
    container.querySelector("#txtSearch").addEventListener('input', pintarLista);
    container.querySelector("#btnNuevo").onclick = () => window.editarGasto();

    // 4. LÓGICA DE CHECKLIST (Vital para Tesorería)
    window.togglePago = async (id) => {
        const pagados = db.control_pagos[currentKey];
        const idx = pagados.indexOf(id);
        const gasto = db.gastos_fijos.find(x => x.id === id);

        if (idx === -1) {
            pagados.push(id);
            // Integración opcional con Banco
            if(confirm(`¿Registrar salida de ${gasto.amount}€ en Banco automáticamente?`)) {
                if(!db.banco) db.banco = [];
                db.banco.push({
                    id: Date.now(),
                    date: new Date().toLocaleDateString('es-ES'),
                    desc: `Pago Recurrente: ${gasto.name}`,
                    amount: -Math.abs(parseFloat(gasto.amount)),
                    status: 'reconciled'
                });
            }
            await saveFn("Gasto pagado ✅");
        } else {
            pagados.splice(idx, 1);
            await saveFn("Gasto desmarcado ↩️");
        }
        pintarLista();
    };

    // 5. EDICIÓN MEJORADA (Con Fechas y Frecuencia Semanal)
    window.editarGasto = (id = null) => {
        // Truco del scroll
        container.scrollTop = 0; window.scrollTo(0, 0);

        const g = id ? db.gastos_fijos.find(x => x.id === id) : { 
            id: Date.now().toString(), name: '', amount: '', freq: 'mensual', cat: 'varios', start: '', end: '', active: true
        };

        const modal = container.querySelector("#modalGasto");
        modal.classList.remove("hidden");

        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalGasto').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-6">${id ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>

                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Concepto</label>
                        <input id="g-name" type="text" value="${g.name}" placeholder="Ej. Alquiler Local" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Importe (€)</label>
                            <input id="g-amount" type="number" value="${g.amount}" placeholder="0.00" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-lg outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Frecuencia</label>
                            <select id="g-freq" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none">
                                <option value="semanal" ${g.freq==='semanal'?'selected':''}>Semanal (x4.33)</option>
                                <option value="mensual" ${g.freq==='mensual'?'selected':''}>Mensual</option>
                                <option value="trimestral" ${g.freq==='trimestral'?'selected':''}>Trimestral</option>
                                <option value="anual" ${g.freq==='anual'?'selected':''}>Anual</option>
                            </select>
                        </div>
                    </div>

                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Vigencia del Contrato (Opcional)</p>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="text-[9px] text-slate-400">Inicio</label>
                                <input id="g-start" type="date" value="${g.start || ''}" class="w-full bg-white rounded-lg p-2 text-xs font-bold text-slate-600">
                            </div>
                            <div>
                                <label class="text-[9px] text-slate-400">Fin / Vencimiento</label>
                                <input id="g-end" type="date" value="${g.end || ''}" class="w-full bg-white rounded-lg p-2 text-xs font-bold text-slate-600">
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Categoría</label>
                        <select id="g-cat" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none">
                            <option value="local" ${g.cat==='local'?'selected':''}>Local/Luz</option>
                            <option value="personal" ${g.cat==='personal'?'selected':''}>Personal</option>
                            <option value="impuestos" ${g.cat==='impuestos'?'selected':''}>Gestoría/Imp</option>
                            <option value="varios" ${g.cat==='varios'?'selected':''}>Varios</option>
                        </select>
                    </div>

                    <button id="btnSaveGasto" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-600 transition mt-2">GUARDAR</button>
                    
                    ${id ? `<button id="btnArchiveGasto" class="w-full text-rose-400 text-xs font-bold mt-2">Archivar / Eliminar</button>` : ''}
                </div>
            </div>
        `;

        modal.querySelector("#btnSaveGasto").onclick = async () => {
            const nuevo = {
                id: g.id,
                name: modal.querySelector("#g-name").value,
                amount: parseFloat(modal.querySelector("#g-amount").value) || 0,
                freq: modal.querySelector("#g-freq").value,
                cat: modal.querySelector("#g-cat").value,
                start: modal.querySelector("#g-start").value, // Guardar fecha inicio
                end: modal.querySelector("#g-end").value,     // Guardar fecha fin
                active: true
            };

            if(!nuevo.name) return alert("Ponle un nombre");

            if(id) {
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                db.gastos_fijos[idx] = nuevo;
            } else {
                db.gastos_fijos.push(nuevo);
            }

            await saveFn("Gasto guardado");
            modal.classList.add("hidden");
            // Recargar módulo completo para actualizar totales
            render(container, supabase, db, opts);
        };

        if(id) {
            modal.querySelector("#btnArchiveGasto").onclick = async () => {
                if(!confirm("¿Archivar este gasto? Dejará de contar en los totales.")) return;
                // Soft Delete (solo lo marcamos como inactivo)
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                if(idx >= 0) db.gastos_fijos[idx].active = false;
                
                await saveFn("Gasto archivado");
                modal.classList.add("hidden");
                render(container, supabase, db, opts);
            };
        }
    };

    // Helpers Visuales
    function getIcon(cat) {
        if(cat === 'local') return '🏢';
        if(cat === 'personal') return '👨‍🍳';
        if(cat === 'impuestos') return '⚖️';
        return '📦';
    }

    pintarLista();
}     
