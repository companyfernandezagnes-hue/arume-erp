/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS (La Mochila Real: Prorrateo y Control)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. GESTIÓN DE DATOS
    if (!Array.isArray(db.gastos_fijos)) db.gastos_fijos = [];
    
    // Control de pagos del mes actual (Checklist)
    const today = new Date();
    const currentKey = `pagos_${today.getFullYear()}_${today.getMonth()}`;
    if (!db.control_pagos) db.control_pagos = {};
    if (!db.control_pagos[currentKey]) db.control_pagos[currentKey] = [];

    // --- CEREBRO DE CÁLCULO (Prorrateo Exacto) ---
    // Esto convierte cualquier gasto a su coste mensual real
    const getMensual = (g) => {
        let amount = parseFloat(g.amount) || 0;
        if (g.active === false) return 0; // Si está archivado, no cuenta

        switch (g.freq) {
            case 'anual': return amount / 12;
            case 'semestral': return amount / 6;
            case 'trimestral': return amount / 3;
            case 'bimensual': return amount / 2;
            case 'semanal': return amount * 4.33; // Media de semanas por mes
            case 'mensual': default: return amount;
        }
    };

    // Calcular Totales
    const totalMensual = db.gastos_fijos.reduce((acc, g) => acc + getMensual(g), 0);
    const costeDiario = totalMensual / 30;

    // 2. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Estructura de Costes</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">
                    Control ${today.toLocaleDateString('es-ES', {month:'long'})}
                </p>
            </div>
            
            <div class="flex gap-4 items-center">
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Mochila Mensual</p>
                    <p class="text-2xl font-black text-slate-800">${totalMensual.toLocaleString('es-ES', {maximumFractionDigits:0})}€</p>
                </div>
                <div class="text-right border-l pl-4 border-slate-100 hidden md:block">
                    <p class="text-[9px] font-black text-rose-400 uppercase">Coste Diario</p>
                    <p class="text-2xl font-black text-rose-500">${costeDiario.toLocaleString('es-ES', {maximumFractionDigits:0})}€</p>
                </div>
            </div>
        </header>

        <div class="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm sticky top-2 z-10">
            <span class="text-slate-400 pl-2">🔍</span>
            <input id="txtSearch" type="text" placeholder="Buscar gasto..." class="bg-transparent outline-none text-xs font-bold text-slate-600 w-full">
            <button id="btnNuevo" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex-shrink-0">
                + AÑADIR
            </button>
        </div>

        <div id="listaGastos" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20"></div>
    </div>

    <div id="modalGasto" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
    `;

    // 3. RENDERIZADO DE LISTA
    const pintarLista = () => {
        const term = container.querySelector("#txtSearch").value.toLowerCase();
        const lista = container.querySelector("#listaGastos");
        const pagados = db.control_pagos[currentKey] || [];

        const filtered = db.gastos_fijos.filter(g => {
            if (g.active === false) return false; // No mostrar archivados
            return (g.name || "").toLowerCase().includes(term);
        }).sort((a,b) => getMensual(b) - getMensual(a)); // Ordenar del más caro al más barato

        if (filtered.length === 0) {
            lista.innerHTML = `<div class="col-span-full text-center py-10 opacity-50 italic text-sm">No hay gastos activos.</div>`;
            return;
        }

        lista.innerHTML = filtered.map(g => {
            const isPaid = pagados.includes(g.id);
            const mensual = getMensual(g);
            
            // Icono según categoría (Visual Aid)
            let icon = '📦';
            if(g.cat === 'personal') icon = '👨‍🍳';
            if(g.cat === 'local') icon = '🏢';
            if(g.cat === 'suministros') icon = '💡';
            if(g.cat === 'impuestos') icon = '⚖️';

            return `
            <div class="bg-white p-5 rounded-[2rem] border ${isPaid ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'} shadow-sm relative group hover:shadow-md transition">
                
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="window.editarGasto('${g.id}')">
                        <span class="text-2xl">${icon}</span>
                        <div>
                            <h4 class="font-black text-slate-800 leading-none hover:text-indigo-600 transition">${g.name}</h4>
                            <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wide">${g.freq}</span>
                        </div>
                    </div>
                    <button onclick="window.togglePago('${g.id}')" class="transition-all active:scale-90">
                        ${isPaid 
                            ? `<span class="bg-emerald-500 text-white px-3 py-1 rounded-full text-[9px] font-black shadow-lg shadow-emerald-200 flex items-center gap-1">PAGADO</span>` 
                            : `<span class="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[9px] font-black border border-slate-200 hover:bg-white">PENDIENTE</span>`
                        }
                    </button>
                </div>

                <div class="flex justify-between items-end mt-4 pt-3 border-t border-slate-50">
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold uppercase">Recibo</p>
                        <p class="text-lg font-black text-slate-800">${parseFloat(g.amount).toLocaleString()}€</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] text-indigo-400 font-bold uppercase">Coste Mensual</p>
                        <p class="text-base font-black text-indigo-600">${mensual.toLocaleString(undefined,{maximumFractionDigits:0})}€</p>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // 4. LÓGICA DE CHECKLIST
    window.togglePago = async (id) => {
        const pagados = db.control_pagos[currentKey];
        const idx = pagados.indexOf(id);
        
        if (idx === -1) {
            pagados.push(id);
            await saveFn("Pagado ✅");
        } else {
            pagados.splice(idx, 1);
            await saveFn("Pendiente ⏳");
        }
        pintarLista();
    };

    // 5. EDICIÓN Y CREACIÓN (LO QUE PEDÍAS: MODIFICABLE 100%)
    window.editarGasto = (id = null) => {
        container.scrollTop = 0; window.scrollTo(0, 0);

        // Si hay ID buscamos el gasto, si no, creamos uno vacío
        const g = id ? db.gastos_fijos.find(x => x.id === id) : { 
            id: Date.now().toString(), name: '', amount: '', freq: 'mensual', cat: 'varios', active: true 
        };

        const modal = container.querySelector("#modalGasto");
        modal.classList.remove("hidden");

        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalGasto').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl transition">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-6">${id ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>

                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Nombre del Gasto</label>
                        <input id="g-name" type="text" value="${g.name}" placeholder="Ej. Seguro Local" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Importe Recibo (€)</label>
                            <input id="g-amount" type="number" value="${g.amount}" placeholder="0.00" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-lg border border-slate-100 outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Frecuencia</label>
                            <select id="g-freq" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100 outline-none">
                                <option value="mensual" ${g.freq==='mensual'?'selected':''}>Mensual</option>
                                <option value="trimestral" ${g.freq==='trimestral'?'selected':''}>Trimestral (/3)</option>
                                <option value="anual" ${g.freq==='anual'?'selected':''}>Anual (/12)</option>
                                <option value="semestral" ${g.freq==='semestral'?'selected':''}>Semestral (/6)</option>
                                <option value="bimensual" ${g.freq==='bimensual'?'selected':''}>Bimensual (/2)</option>
                                <option value="semanal" ${g.freq==='semanal'?'selected':''}>Semanal (x4.3)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Categoría</label>
                        <select id="g-cat" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100 outline-none">
                            <option value="varios" ${g.cat==='varios'?'selected':''}>📦 Varios / Otros</option>
                            <option value="local" ${g.cat==='local'?'selected':''}>🏢 Local (Alquiler, Luz, Agua)</option>
                            <option value="personal" ${g.cat==='personal'?'selected':''}>👨‍🍳 Personal (Nóminas, SS)</option>
                            <option value="impuestos" ${g.cat==='impuestos'?'selected':''}>⚖️ Impuestos / Gestoría</option>
                            <option value="suministros" ${g.cat==='suministros'?'selected':''}>💡 Suministros (Internet, TPV)</option>
                        </select>
                    </div>

                    <div class="pt-4 flex flex-col gap-3">
                        <button id="btnSaveGasto" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition">GUARDAR CAMBIOS</button>
                        
                        ${id ? `<button id="btnArchiveGasto" class="w-full text-rose-400 text-[10px] font-bold uppercase tracking-widest hover:text-rose-600">Eliminar este gasto</button>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Lógica del botón Guardar
        modal.querySelector("#btnSaveGasto").onclick = async () => {
            const nuevo = {
                id: g.id,
                name: modal.querySelector("#g-name").value,
                amount: parseFloat(modal.querySelector("#g-amount").value) || 0,
                freq: modal.querySelector("#g-freq").value,
                cat: modal.querySelector("#g-cat").value,
                active: true
            };

            if(!nuevo.name) return alert("Ponle un nombre al gasto");

            if(id) {
                // MODO EDICIÓN: Buscamos y reemplazamos
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                if(idx >= 0) db.gastos_fijos[idx] = nuevo;
            } else {
                // MODO CREACIÓN: Añadimos
                db.gastos_fijos.push(nuevo);
            }

            await saveFn("Estructura actualizada ✅");
            modal.classList.add("hidden");
            render(container, supabase, db, opts); // Recalcular mochila
        };

        // Lógica del botón Borrar
        if(id) {
            modal.querySelector("#btnArchiveGasto").onclick = async () => {
                if(!confirm("¿Seguro que quieres borrarlo?")) return;
                const idx = db.gastos_fijos.findIndex(x => x.id === id);
                if(idx >= 0) db.gastos_fijos[idx].active = false; // Borrado lógico
                
                await saveFn("Gasto eliminado 🗑️");
                modal.classList.add("hidden");
                render(container, supabase, db, opts);
            };
        }
    };

    // Eventos del Buscador y Nuevo
    container.querySelector("#txtSearch").addEventListener('input', pintarLista);
    container.querySelector("#btnNuevo").onclick = () => window.editarGasto();

    pintarLista();
}
