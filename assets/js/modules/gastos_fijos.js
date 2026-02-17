/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS v2.2 (Con botón Editar Visible)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. AUTO-MIGRACIÓN (Limpieza de datos antiguos)
    if (!Array.isArray(db.gastos_fijos)) db.gastos_fijos = [];
    
    db.gastos_fijos.forEach(g => {
        if (!g.dia_pago) g.dia_pago = 1;
        if (!g.notas) g.notas = "";
        // Si no tiene nombre o es cadena vacía, le ponemos una etiqueta de aviso
        if (!g.name || g.name.trim() === "") g.name = "⚠️ (Sin Nombre) - Editar aquí";
    });

    const today = new Date();
    const currentMonthKey = `pagos_${today.getFullYear()}_${today.getMonth() + 1}`;
    
    if (!db.control_pagos) db.control_pagos = {};
    if (!db.control_pagos[currentMonthKey]) db.control_pagos[currentMonthKey] = [];

    // --- CEREBRO ---
    const getMensual = (g) => {
        let amount = parseFloat(g.amount) || 0;
        if (g.active === false) return 0;
        if (g.freq === 'anual') return amount / 12;
        if (g.freq === 'trimestral') return amount / 3;
        if (g.freq === 'semestral') return amount / 6;
        if (g.freq === 'bimensual') return amount / 2;
        if (g.freq === 'semanal') return amount * 4.33; 
        return amount;
    };

    const totalMochila = db.gastos_fijos.reduce((acc, g) => acc + getMensual(g), 0);
    const gastosPendientes = db.gastos_fijos.filter(g => {
        const isPaid = (db.control_pagos[currentMonthKey] || []).includes(g.id);
        return g.active !== false && !isPaid;
    });
    const totalPendiente = gastosPendientes.reduce((acc, g) => acc + getMensual(g), 0);
    const totalPagado = totalMochila - totalPendiente;
    const porcentajePagado = totalMochila > 0 ? (totalPagado / totalMochila) * 100 : 0;

    // 2. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Estructura de Costes</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    ${today.toLocaleDateString('es-ES', {month:'long', year:'numeric'})}
                </p>
            </div>
            <div class="flex gap-6 items-center">
                <div class="text-right">
                    <p class="text-[9px] font-black text-rose-500 uppercase">Pendiente</p>
                    <p class="text-2xl font-black text-rose-600">${totalPendiente.toLocaleString('es-ES', {maximumFractionDigits:0})}€</p>
                </div>
                <div class="w-12 h-12 rounded-full border-4 border-slate-100 flex items-center justify-center relative overflow-hidden">
                    <div class="absolute bottom-0 w-full bg-indigo-100" style="height: ${porcentajePagado}%"></div>
                    <span class="text-[9px] font-black z-10 relative">${Math.round(porcentajePagado)}%</span>
                </div>
            </div>
        </header>

        <div class="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm sticky top-2 z-10">
            <span class="text-slate-400 pl-2">🔍</span>
            <input id="txtSearch" type="text" placeholder="Buscar gasto..." class="bg-transparent outline-none text-xs font-bold text-slate-600 w-full">
            <button onclick="window.editarGasto()" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex-shrink-0 shadow-lg shadow-indigo-200">
                + NUEVO
            </button>
        </div>

        <div id="listaGastos" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20"></div>
    </div>

    <div id="modalGasto" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 opacity-0 transition-opacity duration-300"></div>
    `;

    // 3. RENDERIZADO DE LISTA
    const pintarLista = () => {
        const term = (container.querySelector("#txtSearch").value || "").toLowerCase();
        const lista = container.querySelector("#listaGastos");
        const pagados = db.control_pagos[currentMonthKey] || [];

        const filtered = db.gastos_fijos.filter(g => {
            if (g.active === false) return false;
            const nombre = g.name || ""; 
            return nombre.toLowerCase().includes(term);
        }).sort((a,b) => {
            const paidA = pagados.includes(a.id) ? 1 : 0;
            const paidB = pagados.includes(b.id) ? 1 : 0;
            if (paidA !== paidB) return paidA - paidB;
            return (a.dia_pago || 30) - (b.dia_pago || 30);
        });

        if (filtered.length === 0) {
            lista.innerHTML = `<div class="col-span-full text-center py-10 opacity-50 italic text-sm">No tienes gastos fijos activos.</div>`;
            return;
        }

        lista.innerHTML = filtered.map(g => {
            const isPaid = pagados.includes(g.id);
            const mensual = getMensual(g);
            
            // Iconos
            let icon = '📦';
            let catColor = 'bg-slate-100 text-slate-500';
            if(g.cat === 'personal') { icon = '👨‍🍳'; catColor = 'bg-blue-50 text-blue-500'; }
            if(g.cat === 'local') { icon = '🏢'; catColor = 'bg-orange-50 text-orange-500'; }
            if(g.cat === 'suministros') { icon = '💡'; catColor = 'bg-yellow-50 text-yellow-600'; }
            if(g.cat === 'impuestos') { icon = '⚖️'; catColor = 'bg-red-50 text-red-500'; }
            if(g.cat === 'software') { icon = '💻'; catColor = 'bg-purple-50 text-purple-500'; }

            const diaHoy = today.getDate();
            const esUrgente = !isPaid && (g.dia_pago - diaHoy <= 3) && (g.dia_pago - diaHoy >= -5);
            
            // Nombre seguro
            const safeName = (g.name || "Sin Nombre").replace(/'/g, "\\'"); 

            return `
            <div class="bg-white p-5 rounded-[2rem] border ${isPaid ? 'border-emerald-200 bg-emerald-50/20' : esUrgente ? 'border-rose-300 shadow-rose-100 shadow-md' : 'border-slate-100'} shadow-sm relative group hover:shadow-md transition">
                
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center gap-3 overflow-hidden flex-1">
                        <div class="w-10 h-10 rounded-2xl ${catColor} flex items-center justify-center text-xl shrink-0">
                            ${icon}
                        </div>
                        <div class="overflow-hidden">
                            <h4 class="font-black text-slate-800 text-sm truncate leading-tight">${g.name}</h4>
                            <div class="flex gap-2 text-[9px] font-bold uppercase tracking-wide text-slate-400 mt-1">
                                <span>${g.freq}</span>
                                <span>•</span>
                                <span>Día ${g.dia_pago}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <button onclick="window.editarGasto('${g.id}')" class="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition">
                            ✏️
                        </button>

                        <button onclick="window.togglePago('${g.id}', '${safeName}', ${mensual})" class="transition-all active:scale-90">
                            ${isPaid 
                                ? `<div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200">✓</div>` 
                                : `<div class="w-8 h-8 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center hover:border-indigo-400"></div>`
                            }
                        </button>
                    </div>
                </div>

                <div class="flex justify-between items-end mt-2 pt-3 border-t border-slate-50">
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold uppercase">Cuota Real</p>
                        <p class="text-sm font-black text-slate-800">${parseFloat(g.amount).toLocaleString()}€</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] font-bold uppercase ${isPaid ? 'text-emerald-400' : 'text-slate-400'}">Mensualizado</p>
                        <p class="text-base font-black ${isPaid ? 'text-emerald-600' : 'text-indigo-600'}">${mensual.toLocaleString(undefined,{maximumFractionDigits:0})}€</p>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // 4. LÓGICA DE PAGO
    window.togglePago = async (id, nombreGasto, importeMensual) => {
        const pagados = db.control_pagos[currentMonthKey];
        const idx = pagados.indexOf(id);
        
        if (idx === -1) {
            pagados.push(id);
            if(confirm("¿Registrar pago en Banco?")) {
                db.banco.unshift({
                    id: 'gf-' + Date.now(),
                    date: new Date().toISOString().split('T')[0],
                    desc: `Pago Gasto Fijo: ${nombreGasto}`,
                    amount: -Math.abs(importeMensual),
                    cat: 'Fijos',
                    status: 'conciliado_auto'
                });
            }
            await saveFn("Pagado ✅");
        } else {
            pagados.splice(idx, 1);
            await saveFn("Pendiente ⏳");
        }
        pintarLista();
        render(container, supabase, db, opts);
    };

    // 5. MODAL DE EDICIÓN (COMPLETO)
    window.editarGasto = (id = null) => {
        const g = id ? db.gastos_fijos.find(x => x.id === id) : { 
            id: Date.now().toString(), name: '', amount: '', freq: 'mensual', cat: 'varios', active: true, dia_pago: 1, notes: '' 
        };

        const modal = container.querySelector("#modalGasto");
        modal.classList.remove("hidden");
        requestAnimationFrame(() => modal.classList.remove("opacity-0"));

        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onclick="cerrarModalGasto()" class="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl transition">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-6">${id ? 'Editar' : 'Nuevo'}</h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Nombre</label>
                        <input id="g-name" type="text" value="${g.name || ''}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100 outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Importe (€)</label>
                            <input id="g-amount" type="number" value="${g.amount}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-lg border border-slate-100 outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Día Pago</label>
                            <input id="g-day" type="number" value="${g.dia_pago || 1}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-lg border border-slate-100 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Frecuencia</label>
                        <select id="g-freq" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100 outline-none">
                            <option value="mensual" ${g.freq==='mensual'?'selected':''}>Mensual</option>
                            <option value="trimestral" ${g.freq==='trimestral'?'selected':''}>Trimestral</option>
                            <option value="anual" ${g.freq==='anual'?'selected':''}>Anual</option>
                        </select>
                    </div>
                     <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Categoría</label>
                        <select id="g-cat" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100 outline-none">
                            <option value="varios" ${g.cat==='varios'?'selected':''}>📦 Varios</option>
                            <option value="local" ${g.cat==='local'?'selected':''}>🏢 Local</option>
                            <option value="personal" ${g.cat==='personal'?'selected':''}>👨‍🍳 Personal</option>
                            <option value="suministros" ${g.cat==='suministros'?'selected':''}>💡 Suministros</option>
                            <option value="software" ${g.cat==='software'?'selected':''}>💻 Software</option>
                        </select>
                    </div>
                    <button id="btnSaveGasto" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg mt-2">GUARDAR</button>
                    ${id ? `<button id="btnArchiveGasto" class="w-full text-rose-400 text-[10px] font-bold uppercase mt-2">Eliminar</button>` : ''}
                </div>
            </div>
        `;

        window.cerrarModalGasto = () => {
            modal.classList.add("opacity-0");
            setTimeout(() => modal.classList.add("hidden"), 300);
        };

        modal.querySelector("#btnSaveGasto").onclick = async () => {
            const nuevo = {
                id: g.id,
                name: modal.querySelector("#g-name").value || "Sin Nombre",
                amount: parseFloat(modal.querySelector("#g-amount").value) || 0,
                freq: modal.querySelector("#g-freq").value,
                cat: modal.querySelector("#g-cat").value,
                dia_pago: parseInt(modal.querySelector("#g-day").value) || 1,
                notes: "",
                active: true
            };
            
            if(id) {
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                if(idx >= 0) db.gastos_fijos[idx] = nuevo;
            } else {
                db.gastos_fijos.push(nuevo);
            }
            await saveFn("Guardado ✅");
            window.cerrarModalGasto();
            render(container, supabase, db, opts);
        };

        if(id) {
             modal.querySelector("#btnArchiveGasto").onclick = async () => {
                if(!confirm("¿Borrar?")) return;
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                if(idx >= 0) db.gastos_fijos[idx].active = false;
                await saveFn("Eliminado");
                window.cerrarModalGasto();
                render(container, supabase, db, opts);
            };
        }
    };

    container.querySelector("#txtSearch").addEventListener('input', pintarLista);
    pintarLista();
}
