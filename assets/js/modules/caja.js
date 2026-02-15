/* =============================================================
   💵 MÓDULO: CAJA & CIERRE Z (El Cerebro del Día)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    // 1. Setup y Helpers
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    if (!db.diario) db.diario = [];
    if (!db.facturas) db.facturas = []; // Para generar la factura automática

    let mesVer = new Date().getMonth();
    let vistaTrimestral = false;

    // Calcular Dinero Físico en el Cajón (Solo movimientos de Efectivo)
    // Sumamos Cierres (Cash) + Entradas Manuales - Salidas Manuales
    const dineroEnCajon = db.diario.reduce((acc, mov) => {
        if (mov.type === 'z-closure') return acc + (parseFloat(mov.cash) || 0) - (parseFloat(mov.expenses) || 0);
        if (mov.type === 'manual') return acc + (parseFloat(mov.amount) || 0);
        return acc;
    }, 0);

    // --- INTERFAZ ---
    container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-20">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-100">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Libro de Caja</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control de Efectivo & Ventas</p>
                </div>
                
                <div class="flex gap-4 items-center">
                    <div class="text-right">
                        <p class="text-[9px] font-black text-slate-400 uppercase">Dinero en Cajón</p>
                        <p class="text-3xl font-black ${dineroEnCajon >= 0 ? 'text-emerald-600' : 'text-rose-500'}">${dineroEnCajon.toLocaleString('es-ES', {minimumFractionDigits: 2})}€</p>
                    </div>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onclick="window.abrirCierreZ()" class="md:col-span-3 bg-slate-900 text-white py-6 rounded-[2.5rem] shadow-xl hover:bg-slate-800 transition relative overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-20 group-hover:opacity-30 transition"></div>
                    <div class="relative flex flex-col items-center">
                        <span class="text-3xl mb-1">📝</span>
                        <span class="text-sm font-black uppercase tracking-widest">Hacer Cierre del Día (Z)</span>
                        <span class="text-[10px] text-slate-400 font-bold mt-1">Genera Venta + Factura + Actualiza Caja</span>
                    </div>
                </button>

                <button onclick="window.movimientoManual('entrada')" class="bg-emerald-50 text-emerald-600 py-4 rounded-[2rem] font-bold text-xs hover:bg-emerald-100 transition border border-emerald-100 flex justify-center items-center gap-2">
                    <span>⬇️</span> Entrada Cambio
                </button>
                <button onclick="window.movimientoManual('salida')" class="bg-rose-50 text-rose-500 py-4 rounded-[2rem] font-bold text-xs hover:bg-rose-100 transition border border-rose-100 flex justify-center items-center gap-2">
                    <span>⬆️</span> Retirada / Pago
                </button>
                <button id="btnExport" class="bg-white text-slate-500 py-4 rounded-[2rem] font-bold text-xs hover:bg-slate-50 transition border border-slate-200 flex justify-center items-center gap-2">
                    <span>📊</span> Exportar Excel
                </button>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px]">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="font-black text-slate-800">Historial de Movimientos</h3>
                    <select id="selMes" class="bg-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none">
                        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => `<option value="${i}" ${mesVer===i?'selected':''}>${m}</option>`).join('')}
                    </select>
                </div>
                <div id="listaMovimientos" class="space-y-3"></div>
            </div>

        </div>

        <div id="modalCierre" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[999] flex justify-center items-center p-4"></div>
    `;

    // --- LÓGICA DE LISTADO ---
    const pintarLista = () => {
        const lista = container.querySelector("#listaMovimientos");
        const filtrados = db.diario.filter(m => {
            const d = new Date(m.date);
            return d.getMonth() === mesVer && d.getFullYear() === new Date().getFullYear();
        }).sort((a,b) => new Date(b.date) - new Date(a.date));

        if (filtrados.length === 0) {
            lista.innerHTML = `<div class="text-center py-10 text-slate-300 italic">No hay movimientos en este mes.</div>`;
            return;
        }

        lista.innerHTML = filtrados.map(m => {
            let icono = '📝';
            let color = 'text-slate-800';
            let desc = 'Cierre Z';
            
            if (m.type === 'manual') {
                if (m.amount > 0) { icono = '⬇️'; color = 'text-emerald-500'; desc = 'Entrada'; }
                else { icono = '⬆️'; color = 'text-rose-500'; desc = 'Retirada'; }
            }

            return `
            <div class="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition border-b border-slate-50 last:border-0 cursor-pointer" onclick="window.editarMovimiento('${m.id}')">
                <div class="flex items-center gap-3">
                    <div class="text-xl bg-slate-50 w-10 h-10 flex items-center justify-center rounded-full">${icono}</div>
                    <div>
                        <p class="text-xs font-bold text-slate-700">${m.concept || desc}</p>
                        <p class="text-[9px] text-slate-400 uppercase">${new Date(m.date).toLocaleDateString()} · ${m.user || 'Staff'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-black ${color}">${parseFloat(m.total || m.amount).toFixed(2)}€</p>
                    ${m.type === 'z-closure' ? `<p class="text-[8px] text-slate-400">Efec: ${m.cash} | Tarj: ${(parseFloat(m.total)-parseFloat(m.cash)).toFixed(2)}</p>` : ''}
                </div>
            </div>
            `;
        }).join('');
    };

    // --- FUNCIONES GLOBALES (ACCESIBLES DESDE HTML) ---
    
    // 1. APERTURA MODAL CIERRE Z
    window.abrirCierreZ = (id = null) => {
        const modal = container.querySelector("#modalCierre");
        modal.classList.remove("hidden");
        
        // Si hay ID es edición, si no es nuevo (con fecha de hoy)
        const item = id ? db.diario.find(x => x.id === id) : {
            date: new Date().toISOString().split('T')[0],
            cash: 0, tpv: 0, glovo: 0, uber: 0, expenses: 0, notes: ''
        };

        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-black text-slate-800 mb-1">${id ? 'Editar Cierre' : 'Cierre del Día (Z)'}</h3>
                <p class="text-xs text-slate-400 font-bold mb-6">Copia los datos del ticket de Qamarero</p>

                <div class="space-y-4">
                    <input id="z-date" type="date" value="${item.date}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-center border-0 outline-none">

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                            <label class="text-[9px] font-black text-emerald-600 uppercase">Efectivo (Caja)</label>
                            <input id="z-cash" type="number" value="${item.cash||''}" placeholder="0.00" class="w-full bg-transparent text-2xl font-black text-emerald-800 outline-none mt-1">
                        </div>
                        <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                            <label class="text-[9px] font-black text-indigo-600 uppercase">Tarjeta (Banco)</label>
                            <input id="z-tpv" type="number" value="${item.tpv||''}" placeholder="0.00" class="w-full bg-transparent text-2xl font-black text-indigo-800 outline-none mt-1">
                        </div>
                    </div>

                    <div class="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                        <p class="text-[9px] font-black text-amber-600 uppercase mb-2">Delivery / Otros</p>
                        <div class="grid grid-cols-2 gap-3">
                            <input id="z-glovo" type="number" value="${item.glovo||''}" placeholder="Glovo €" class="p-2 rounded-xl border-0 font-bold text-sm bg-white/50 text-amber-900 placeholder-amber-900/30">
                            <input id="z-uber" type="number" value="${item.uber||''}" placeholder="Uber €" class="p-2 rounded-xl border-0 font-bold text-sm bg-white/50 text-amber-900 placeholder-amber-900/30">
                        </div>
                    </div>

                    <div>
                        <label class="text-[9px] font-black text-rose-400 uppercase ml-2">Pagos desde Caja (Hielo, etc)</label>
                        <input id="z-expenses" type="number" value="${item.expenses||''}" placeholder="0.00" class="w-full p-3 bg-rose-50 text-rose-600 rounded-xl font-bold border border-rose-100 outline-none">
                    </div>

                    <div class="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                        <span class="font-black text-slate-400 uppercase text-xs">Total Venta</span>
                        <span id="z-total-display" class="text-3xl font-black text-slate-900">0.00€</span>
                    </div>

                    <button id="btnSaveZ" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg text-sm mt-2 hover:scale-[1.02] transition">
                        ${id ? 'ACTUALIZAR CIERRE' : 'CONFIRMAR Y CERRAR'}
                    </button>
                    <button onclick="document.getElementById('modalCierre').classList.add('hidden')" class="w-full text-slate-400 font-bold text-xs mt-2">CANCELAR</button>
                    
                    ${id ? `<button onclick="window.borrarMovimiento('${id}')" class="w-full text-rose-400 font-bold text-[10px] mt-4 uppercase">Eliminar este registro</button>` : ''}
                </div>
            </div>
        `;

        // Cálculo en tiempo real
        const inputs = modal.querySelectorAll('input[type="number"]');
        const calc = () => {
            const sum = 
                (parseFloat(modal.querySelector('#z-cash').value)||0) +
                (parseFloat(modal.querySelector('#z-tpv').value)||0) +
                (parseFloat(modal.querySelector('#z-glovo').value)||0) +
                (parseFloat(modal.querySelector('#z-uber').value)||0);
            modal.querySelector('#z-total-display').innerText = sum.toLocaleString('es-ES', {minimumFractionDigits:2}) + "€";
        };
        inputs.forEach(i => i.oninput = calc);
        calc(); // Calc inicial

        // GUARDAR
        modal.querySelector("#btnSaveZ").onclick = async () => {
            const data = {
                id: id || Date.now().toString(),
                date: modal.querySelector('#z-date').value,
                type: 'z-closure',
                cash: parseFloat(modal.querySelector('#z-cash').value)||0,
                tpv: parseFloat(modal.querySelector('#z-tpv').value)||0,
                glovo: parseFloat(modal.querySelector('#z-glovo').value)||0,
                uber: parseFloat(modal.querySelector('#z-uber').value)||0,
                expenses: parseFloat(modal.querySelector('#z-expenses').value)||0,
                user: 'Gerencia'
            };
            data.total = data.cash + data.tpv + data.glovo + data.uber;

            if (data.total === 0 && !confirm("¿Seguro que el total es 0?")) return;

            // 1. Guardar en Diario
            if (id) {
                const idx = db.diario.findIndex(x => x.id === id);
                db.diario[idx] = data;
            } else {
                db.diario.push(data);
                
                // 2. AUTO-FACTURA (Solo al crear nuevo, para no duplicar al editar)
                // Esto alimenta el módulo fiscal automáticamente
                const base = data.total / 1.10; // Asumiendo 10% medio
                db.facturas.push({
                    id: "F-AUTO-" + data.date.replace(/-/g,''),
                    numero: "Z-" + data.date, // Serie Ticket Z
                    date: data.date,
                    cliente: "CLIENTE CONTADO (TICKET Z)",
                    base: base,
                    tax: data.total - base,
                    total: data.total,
                    status: 'cobrada',
                    paid: true,
                    reconciled: true, // Ya sabemos que está cobrado
                    notes: "Generado automáticamente desde Caja"
                });
            }

            await saveFn("Cierre guardado correctamente ✅");
            modal.classList.add("hidden");
            
            // 3. ENLACE A MENÚ (PULSO)
            if (!id && confirm("Cierre completado. ¿Quieres marcar rápidamente qué platos se han vendido más hoy? (Ayuda a la estrategia)")) {
                if(window.loadModule) window.loadModule('menu');
            } else {
                render(container, supabase, db, opts);
            }
        };
    };

    // 2. MOVIMIENTO MANUAL (Entrada/Salida simple)
    window.movimientoManual = (tipo) => {
        const esSalida = tipo === 'salida';
        const concepto = prompt(esSalida ? "Motivo de la retirada (ej. Compra hielo):" : "Motivo del ingreso (ej. Cambio banco):");
        if (!concepto) return;
        
        const importeStr = prompt("Importe (€):");
        if (!importeStr) return;
        
        let importe = parseFloat(importeStr.replace(',','.'));
        if (isNaN(importe)) return alert("Importe no válido");

        if (esSalida) importe = importe * -1; // Las salidas restan

        db.diario.push({
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            type: 'manual',
            concept: concepto,
            amount: importe,
            total: importe, // Para compatibilidad visual
            user: 'Manual'
        });

        saveFn("Movimiento de caja registrado");
        render(container, supabase, db, opts);
    };

    // 3. EDITAR (Router simple)
    window.editarMovimiento = (id) => {
        const m = db.diario.find(x => x.id === id);
        if(!m) return;
        if(m.type === 'z-closure') window.abrirCierreZ(id);
        else {
            if(confirm(`Movimiento manual: ${m.concept}\nImporte: ${m.amount}€\n\n¿Quieres ELIMINARLO?`)) {
                window.borrarMovimiento(id);
            }
        }
    };

    window.borrarMovimiento = async (id) => {
        if(!confirm("¿Seguro que quieres borrar este registro?")) return;
        db.diario = db.diario.filter(x => x.id !== id);
        await saveFn("Registro eliminado");
        document.getElementById('modalCierre')?.classList.add('hidden');
        render(container, supabase, db, opts);
    };

    // 4. EXPORTAR EXCEL
    container.querySelector("#btnExport").onclick = () => {
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Fecha;Tipo;Concepto;Efectivo;Tarjeta;Delivery;Gastos;Total\n"
            + db.diario.map(e => {
                if(e.type === 'z-closure') return `${e.date};Cierre Z;Ventas Día;${e.cash};${e.tpv};${(e.glovo||0)+(e.uber||0)};${e.expenses};${e.total}`;
                return `${e.date};Manual;${e.concept};${e.amount};0;0;0;${e.amount}`;
            }).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Caja_Arume.csv");
        document.body.appendChild(link);
        link.click();
    };

    // Eventos UI
    container.querySelector("#selMes").onchange = (e) => { mesVer = parseInt(e.target.value); pintarLista(); };

    pintarLista();
}
