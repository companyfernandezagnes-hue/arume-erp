/* =============================================================
   💵 MÓDULO: CAJA & CIERRE TOTAL (Desglose Completo + Integración)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. SETUP
    if (!db.diario) db.diario = [];
    if (!db.facturas) db.facturas = [];

    let mesVer = new Date().getMonth();

    // 2. DINERO EN CAJÓN (Solo Efectivo Real)
    const dineroEnCajon = db.diario.reduce((acc, mov) => {
        if (mov.type === 'z-closure') return acc + (parseFloat(mov.cash) || 0) - (parseFloat(mov.expenses) || 0);
        if (mov.type === 'manual') return acc + (parseFloat(mov.amount) || 0);
        return acc;
    }, 0);

    // 3. INTERFAZ
    container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-20">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-100">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Libro de Caja</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control Detallado</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Dinero Físico (Cajón)</p>
                    <p class="text-3xl font-black ${dineroEnCajon >= 0 ? 'text-emerald-600' : 'text-rose-500'}">${dineroEnCajon.toLocaleString('es-ES', {minimumFractionDigits: 2})}€</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onclick="window.abrirCierreZ()" class="md:col-span-3 bg-slate-900 text-white py-6 rounded-[2.5rem] shadow-xl hover:bg-slate-800 transition relative overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-20 group-hover:opacity-30 transition"></div>
                    <div class="relative flex flex-col items-center">
                        <span class="text-3xl mb-1">📝</span>
                        <span class="text-sm font-black uppercase tracking-widest">Hacer Cierre Z Detallado</span>
                        <span class="text-[10px] text-slate-400 font-bold mt-1">Efectivo + Tarjetas + Delivery + Apps</span>
                    </div>
                </button>

                <button onclick="window.movimientoManual('entrada')" class="bg-emerald-50 text-emerald-600 py-4 rounded-[2rem] font-bold text-xs border border-emerald-100 flex justify-center items-center gap-2 hover:bg-emerald-100 transition"><span>⬇️</span> Entrada</button>
                <button onclick="window.movimientoManual('salida')" class="bg-rose-50 text-rose-500 py-4 rounded-[2rem] font-bold text-xs border border-rose-100 flex justify-center items-center gap-2 hover:bg-rose-100 transition"><span>⬆️</span> Retirada</button>
                <button id="btnExport" class="bg-white text-slate-500 py-4 rounded-[2rem] font-bold text-xs border border-slate-200 flex justify-center items-center gap-2 hover:bg-slate-50 transition"><span>📊</span> Excel</button>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px]">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="font-black text-slate-800">Historial</h3>
                    <select id="selMes" class="bg-slate-100 text-xs font-bold px-3 py-2 rounded-xl outline-none">
                        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => `<option value="${i}" ${mesVer===i?'selected':''}>${m}</option>`).join('')}
                    </select>
                </div>
                <div id="listaMovimientos" class="space-y-3"></div>
            </div>
        </div>

        <div id="modalCierre" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[999] flex justify-center items-center p-4"></div>
    `;

    // --- LISTADO ---
    const pintarLista = () => {
        const lista = container.querySelector("#listaMovimientos");
        const filtrados = db.diario.filter(m => {
            const d = new Date(m.date);
            return d.getMonth() === mesVer && d.getFullYear() === new Date().getFullYear();
        }).sort((a,b) => new Date(b.date) - new Date(a.date));

        if (filtrados.length === 0) { lista.innerHTML = `<div class="text-center py-10 text-slate-300 italic">Sin datos este mes.</div>`; return; }

        lista.innerHTML = filtrados.map(m => {
            let icono = '📝';
            let color = 'text-slate-800';
            
            if (m.type === 'manual') {
                if (m.amount > 0) { icono = '⬇️'; color = 'text-emerald-500'; }
                else { icono = '⬆️'; color = 'text-rose-500'; }
            }

            // Cálculo total para mostrar en lista
            const totalDisplay = m.type === 'z-closure' ? m.total : m.amount;

            return `
            <div class="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition border-b border-slate-50 last:border-0 cursor-pointer" onclick="window.editarMovimiento('${m.id}')">
                <div class="flex items-center gap-3">
                    <div class="text-xl bg-slate-50 w-10 h-10 flex items-center justify-center rounded-full">${icono}</div>
                    <div>
                        <p class="text-xs font-bold text-slate-700">${m.concept || 'Cierre Diario'}</p>
                        <p class="text-[9px] text-slate-400 uppercase">${new Date(m.date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-black ${color}">${parseFloat(totalDisplay).toFixed(2)}€</p>
                    ${m.type === 'z-closure' ? `<p class="text-[8px] text-indigo-400 font-bold">Detalle +</p>` : ''}
                </div>
            </div>
            `;
        }).join('');
    };

    // --- MODAL CIERRE Z (FULL EQUIP) ---
    window.abrirCierreZ = (id = null) => {
        const modal = container.querySelector("#modalCierre");
        modal.classList.remove("hidden");
        
        const item = id ? db.diario.find(x => x.id === id) : {
            date: new Date().toISOString().split('T')[0],
            cash: 0, tpv: 0, amex: 0, madisa: 0, glovo: 0, uber: 0, discounts: 0, expenses: 0
        };

        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <h3 class="text-2xl font-black text-slate-800 mb-1">${id ? 'Editar' : 'Cierre Detallado'}</h3>
                <p class="text-xs text-slate-400 font-bold mb-6">Desglosa tus ventas</p>

                <div class="space-y-4">
                    <input id="z-date" type="date" value="${item.date}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-center border-0 outline-none">

                    <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <label class="text-[9px] font-black text-emerald-600 uppercase">Efectivo (Cash)</label>
                        <input id="z-cash" type="number" value="${item.cash||''}" placeholder="0.00" class="w-full bg-transparent text-3xl font-black text-emerald-800 outline-none mt-1">
                    </div>

                    <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <p class="text-[9px] font-black text-indigo-600 uppercase mb-2">Tarjetas & Vales</p>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="text-[8px] text-indigo-400 font-bold">TPV (Visa/MC)</label>
                                <input id="z-tpv" type="number" value="${item.tpv||''}" placeholder="0" class="w-full p-2 rounded-lg text-sm font-bold text-center outline-none">
                            </div>
                            <div>
                                <label class="text-[8px] text-indigo-400 font-bold">AMEX</label>
                                <input id="z-amex" type="number" value="${item.amex||''}" placeholder="0" class="w-full p-2 rounded-lg text-sm font-bold text-center outline-none">
                            </div>
                            <div>
                                <label class="text-[8px] text-indigo-400 font-bold">Ticket Rest.</label>
                                <input id="z-madisa" type="number" value="${item.madisa||''}" placeholder="0" class="w-full p-2 rounded-lg text-sm font-bold text-center outline-none">
                            </div>
                        </div>
                    </div>

                    <div class="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                        <p class="text-[9px] font-black text-amber-600 uppercase mb-2">Delivery / Apps</p>
                        <div class="grid grid-cols-2 gap-3">
                            <input id="z-glovo" type="number" value="${item.glovo||''}" placeholder="Glovo €" class="p-2 rounded-xl border-0 font-bold text-sm bg-white/60 text-amber-900">
                            <input id="z-uber" type="number" value="${item.uber||''}" placeholder="Uber €" class="p-2 rounded-xl border-0 font-bold text-sm bg-white/60 text-amber-900">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 pt-2">
                        <div>
                            <label class="text-[9px] font-black text-rose-400 uppercase">Gastos Caja</label>
                            <input id="z-expenses" type="number" value="${item.expenses||''}" placeholder="0.00" class="w-full p-2 bg-rose-50 text-rose-600 rounded-xl font-bold border border-rose-100 outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase">Descuentos</label>
                            <input id="z-discounts" type="number" value="${item.discounts||''}" placeholder="0.00" class="w-full p-2 bg-slate-50 text-slate-600 rounded-xl font-bold border border-slate-200 outline-none">
                        </div>
                    </div>

                    ${!id ? `
                    <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
                        <input type="checkbox" id="z-integrate" checked class="w-5 h-5 accent-indigo-600 cursor-pointer">
                        <label for="z-integrate" class="cursor-pointer">
                            <p class="text-[10px] font-black text-slate-700 uppercase">Generar Factura Automática</p>
                            <p class="text-[9px] text-slate-400">Para módulo Fiscal y P&L</p>
                        </label>
                    </div>
                    ` : ''}

                    <div class="flex justify-between items-center pt-2 mt-2 border-t border-slate-100">
                        <span class="font-black text-slate-400 uppercase text-xs">Total Facturado</span>
                        <span id="z-total-display" class="text-3xl font-black text-slate-900">0.00€</span>
                    </div>

                    <button id="btnSaveZ" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg text-sm mt-2 hover:scale-[1.02] transition">
                        GUARDAR CIERRE
                    </button>
                    <button onclick="document.getElementById('modalCierre').classList.add('hidden')" class="w-full text-slate-400 font-bold text-xs mt-2">CANCELAR</button>
                    
                    ${id ? `<button onclick="window.borrarMovimiento('${id}')" class="w-full text-rose-400 font-bold text-[10px] mt-4 uppercase">Eliminar registro</button>` : ''}
                </div>
            </div>
        `;

        // Calculadora en tiempo real
        const inputs = modal.querySelectorAll('input[type="number"]');
        const calc = () => {
            const sum = (parseFloat(modal.querySelector('#z-cash').value)||0) +
                        (parseFloat(modal.querySelector('#z-tpv').value)||0) +
                        (parseFloat(modal.querySelector('#z-amex').value)||0) +
                        (parseFloat(modal.querySelector('#z-madisa').value)||0) +
                        (parseFloat(modal.querySelector('#z-glovo').value)||0) +
                        (parseFloat(modal.querySelector('#z-uber').value)||0);
            modal.querySelector('#z-total-display').innerText = sum.toLocaleString('es-ES', {minimumFractionDigits:2}) + "€";
        };
        inputs.forEach(i => i.oninput = calc);
        calc();

        // GUARDAR
        modal.querySelector("#btnSaveZ").onclick = async () => {
            const data = {
                id: id || Date.now().toString(),
                date: modal.querySelector('#z-date').value,
                type: 'z-closure',
                cash: parseFloat(modal.querySelector('#z-cash').value)||0,
                tpv: parseFloat(modal.querySelector('#z-tpv').value)||0,
                amex: parseFloat(modal.querySelector('#z-amex').value)||0,
                madisa: parseFloat(modal.querySelector('#z-madisa').value)||0,
                glovo: parseFloat(modal.querySelector('#z-glovo').value)||0,
                uber: parseFloat(modal.querySelector('#z-uber').value)||0,
                discounts: parseFloat(modal.querySelector('#z-discounts').value)||0,
                expenses: parseFloat(modal.querySelector('#z-expenses').value)||0,
                user: 'Gerencia'
            };
            data.total = data.cash + data.tpv + data.amex + data.madisa + data.glovo + data.uber;

            if (data.total === 0 && !confirm("¿Total 0€? ¿Seguro?")) return;

            // 1. Guardar en Diario
            if (id) {
                const idx = db.diario.findIndex(x => x.id === id);
                db.diario[idx] = data;
            } else {
                db.diario.push(data);
                
                // 2. INTEGRACIÓN AUTOMÁTICA
                const integrate = modal.querySelector('#z-integrate').checked;
                if(integrate) {
                    const base = data.total / 1.10; 
                    db.facturas.push({
                        id: "Z-" + data.date.replace(/-/g,''),
                        numero: "Z-" + data.date,
                        date: data.date,
                        cliente: "CLIENTE CONTADO (TICKET Z)",
                        base: base,
                        tax: data.total - base,
                        total: data.total,
                        status: 'cobrada',
                        paid: true,
                        reconciled: true,
                        notes: `Cierre: ${data.total.toFixed(2)}€ (Efec: ${data.cash} | Tarj: ${data.tpv + data.amex} | Delivery: ${data.glovo + data.uber})`
                    });
                }
            }

            await saveFn("Cierre guardado ✅");
            modal.classList.add("hidden");
            
            if (!id && confirm("¿Quieres registrar tendencias de platos (Pulso)?")) {
                if(window.loadModule) window.loadModule('menu');
            } else {
                render(container, supabase, db, opts);
            }
        };
    };

    // --- MANUALES (Entradas/Salidas sueltas) ---
    window.movimientoManual = (tipo) => {
        const esSalida = tipo === 'salida';
        const concepto = prompt(esSalida ? "Concepto (ej. Hielo, Taxi):" : "Concepto (ej. Cambio, Bote):");
        if (!concepto) return;
        const importe = parseFloat(prompt("Importe (€):")?.replace(',','.'));
        if (isNaN(importe)) return;

        db.diario.push({
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            type: 'manual',
            concept: concepto,
            amount: esSalida ? -importe : importe,
            total: esSalida ? -importe : importe,
            user: 'Manual'
        });
        saveFn("Registrado");
        render(container, supabase, db, opts);
    };

    // --- BORRAR ---
    window.editarMovimiento = (id) => {
        const m = db.diario.find(x => x.id === id);
        if(m.type === 'z-closure') window.abrirCierreZ(id);
        else if(confirm("¿Eliminar movimiento manual?")) window.borrarMovimiento(id);
    };

    window.borrarMovimiento = async (id) => {
        db.diario = db.diario.filter(x => x.id !== id);
        await saveFn("Eliminado");
        document.getElementById('modalCierre')?.classList.add('hidden');
        render(container, supabase, db, opts);
    };

    // --- EXPORTAR EXCEL ---
    container.querySelector("#btnExport").onclick = () => {
        const csv = "data:text/csv;charset=utf-8," + "Fecha;Concepto;Efectivo;TPV;AMEX;Madisa;Glovo;Uber;Descuentos;Gastos;Total\n" + 
            db.diario.map(e => {
                if(e.type === 'z-closure') return `${e.date};Cierre Z;${e.cash};${e.tpv};${e.amex||0};${e.madisa||0};${e.glovo||0};${e.uber||0};${e.discounts||0};${e.expenses||0};${e.total}`;
                return `${e.date};${e.concept};${e.amount};0;0;0;0;0;0;0;${e.amount}`;
            }).join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = "Caja_Completa.csv";
        document.body.appendChild(link);
        link.click();
    };

    container.querySelector("#selMes").onchange = (e) => { mesVer = parseInt(e.target.value); pintarLista(); };
    pintarLista();
}
