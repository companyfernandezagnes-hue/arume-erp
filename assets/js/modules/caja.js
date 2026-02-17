/* =============================================================
   💰 MÓDULO: CONTROL DE CAJAS & CIERRES (Parte 1: Motor Seguro)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    if (!db.cierres) db.cierres = [];

    // --- HELPERS DE PRECISIÓN ---
    const toCents = (n) => Math.round((Number(n) || 0) * 100);
    const localISODate = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        <header class="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Cierre de Caja</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control Diario Arume</p>
            </div>
            <div class="text-right">
                <p class="text-[9px] font-black text-slate-400 uppercase">Fecha Local</p>
                <p class="text-sm font-black text-slate-800">${localISODate()}</p>
            </div>
        </header>

        <div class="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <h3 class="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">💰 Ingresos Directos</h3>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">EFECTIVO (CAJA)</label>
                        <input id="inCaja" type="number" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-0 focus:ring-2 focus:ring-indigo-500 transition">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">TPV (TARJETAS)</label>
                        <input id="inTarjeta" type="number" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-0 focus:ring-2 focus:ring-indigo-500 transition">
                    </div>
                </div>

                <div class="space-y-4">
                    <h3 class="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">🛵 Plataformas</h3>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-bold text-orange-400">GLOVO</label>
                            <input id="inGlovo" type="number" placeholder="0.0" class="w-full p-3 bg-orange-50 rounded-xl font-bold border-0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-teal-400">DELIVEROO</label>
                            <input id="inDeliveroo" type="number" placeholder="0.0" class="w-full p-3 bg-teal-50 rounded-xl font-bold border-0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-indigo-400">UBER</label>
                            <input id="inUber" type="number" placeholder="0.0" class="w-full p-3 bg-indigo-50 rounded-xl font-bold border-0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-rose-400">MADISA</label>
                            <input id="inMadisa" type="number" placeholder="0.0" class="w-full p-3 bg-rose-50 rounded-xl font-bold border-0">
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-center md:text-left">
                    <p class="text-[10px] font-black text-slate-400 uppercase">Total Venta Bruta (Z)</p>
                    <p id="txtTotalCierre" aria-live="polite" class="text-4xl font-black text-indigo-600">0.00€</p>
                </div>
                <button id="btnGuardarCierre" class="w-full md:w-auto px-12 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-600 transition-all transform active:scale-95">
                    GUARDAR CIERRE
                </button>
            </div>
        </div>

        <div class="space-y-3">
            <h3 id="hdrHistorial" class="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Últimos Cierres</h3>
            <div id="listaCierres" class="space-y-2"></div>
        </div>
    </div>
    <div id="undoContainer"></div>
    `;

    // --- ELEMENTOS ---
    const inputs = [
        container.querySelector("#inCaja"),
        container.querySelector("#inTarjeta"),
        container.querySelector("#inGlovo"),
        container.querySelector("#inDeliveroo"),
        container.querySelector("#inUber"),
        container.querySelector("#inMadisa")
    ];
    const txtTotal = container.querySelector("#txtTotalCierre");
    const [inCaja] = inputs;

    // --- CÁLCULO EN VIVO (CON CÉNTIMOS) ---
    const calcularTotalCents = () => {
        const totalCents = inputs.reduce((acc, input) => acc + toCents(input.value), 0);
        txtTotal.innerText = (totalCents / 100).toFixed(2) + "€";
        return totalCents;
    };

    inputs.forEach(input => input.addEventListener("input", calcularTotalCents));

    // --- GUARDADO SEGURO (ANTI-DUPLICADOS) ---
    container.querySelector("#btnGuardarCierre").onclick = async () => {
        const totalCents = calcularTotalCents();
        if (totalCents <= 0) return alert("Introduce importes.");

        const todayLocal = localISODate();
        const existingIdx = db.cierres.findIndex(c => c.date === todayLocal);

        if (existingIdx >= 0) {
            if (!confirm("Ya existe un cierre hoy. ¿Deseas sobreescribirlo?")) return;
        }

        const cierreData = {
            id: existingIdx >= 0 ? db.cierres[existingIdx].id : Date.now().toString(),
            date: todayLocal,
            totalCaja: Number(inCaja.value) || 0,
            totalTarjeta: Number(inputs[1].value) || 0,
            glovo: Number(inputs[2].value) || 0,
            deliveroo: Number(inputs[3].value) || 0,
            uber: Number(inputs[4].value) || 0,
            madisa: Number(inputs[5].value) || 0,
            totalVenta: totalCents / 100
        };

        if (existingIdx >= 0) db.cierres[existingIdx] = cierreData;
        else db.cierres.unshift(cierreData);

        await saveFn("Cierre guardado ✅");
        inputs.forEach(i => i.value = "");
        calcularTotalCents();
        pintarCierres();
    };

    // --- RENDER HISTORIAL ---
    const pintarCierres = () => {
        const lista = container.querySelector("#listaCierres");
        const recent = db.cierres.slice(0, 7);
        const total7 = recent.reduce((t, c) => t + (Number(c.totalVenta) || 0), 0);
        const avg7 = (total7 / Math.max(recent.length, 1)).toFixed(2);

        container.querySelector("#hdrHistorial").innerHTML = `Últimos 7 días · <span class="text-indigo-400">Media: ${avg7}€</span>`;

        lista.innerHTML = recent.map(c => `
            <div class="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase">${c.date}</p>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">💵 ${c.totalCaja.toFixed(2)}</span>
                        <span class="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">💳 ${c.totalTarjeta.toFixed(2)}</span>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-black text-slate-800">${c.totalVenta.toFixed(2)}€</p>
                    <button onclick="window.borrarCierre('${c.id}')" class="text-[8px] text-rose-300 font-bold uppercase hover:text-rose-500">Eliminar</button>
                </div>
            </div>
        `).join('') || '<p class="text-center py-10 text-slate-300 italic text-sm">Sin registros</p>';
    };

    // --- BORRADO CON OPCIÓN A DESHACER ---
    let lastDeleted = null;
    window.borrarCierre = async (id) => {
        const idx = db.cierres.findIndex(c => c.id === id);
        if (idx < 0) return;
        
        lastDeleted = db.cierres[idx];
        db.cierres.splice(idx, 1);
        await saveFn("Cierre eliminado");
        pintarCierres();

        const undo = document.createElement('div');
        undo.className = "fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-4 z-[9999]";
        undo.innerHTML = `Cierre borrado <button id="btnUndo" class="text-indigo-400 underline uppercase tracking-widest">Deshacer</button>`;
        container.querySelector("#undoContainer").appendChild(undo);

        let timer = setTimeout(() => undo.remove(), 8000);
        undo.querySelector("#btnUndo").onclick = async () => {
            clearTimeout(timer);
            if (lastDeleted) db.cierres.unshift(lastDeleted);
            lastDeleted = null;
            await saveFn("Cierre restaurado");
            pintarCierres();
            undo.remove();
        };
    };

    // Focus inicial
    inCaja.focus();
    pintarCierres();
}
/* =============================================================
   💰 MÓDULO: CONTROL DE CAJAS & CIERRES (Parte 2: Automatización)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    if (!db.cierres) db.cierres = [];
    if (!db.facturas) db.facturas = []; // Aseguramos que existan facturas para la Z

    // --- HELPERS ---
    const toCents = (n) => Math.round((Number(n) || 0) * 100);
    const localISODate = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        <header class="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Cierre de Caja</h2>
                <p class="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Contabilidad Automatizada</p>
            </div>
            <div class="text-right">
                <p class="text-[9px] font-black text-slate-400 uppercase">Hoy</p>
                <p class="text-sm font-black text-slate-800">${localISODate()}</p>
            </div>
        </header>

        <div class="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">💰 Venta Directa</h3>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">EFECTIVO</label>
                        <input id="inCaja" type="number" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-0 focus:ring-2 focus:ring-indigo-500 transition">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">TPV (TARJETAS)</label>
                        <input id="inTarjeta" type="number" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-0 focus:ring-2 focus:ring-indigo-500 transition">
                    </div>
                </div>

                <div class="space-y-4">
                    <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">🛵 Plataformas</h3>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-bold text-orange-400">GLOVO</label>
                            <input id="inGlovo" type="number" placeholder="0.0" class="w-full p-3 bg-orange-50 rounded-xl font-bold border-0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-teal-400">DELIVEROO</label>
                            <input id="inDeliveroo" type="number" placeholder="0.0" class="w-full p-3 bg-teal-50 rounded-xl font-bold border-0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-indigo-400">UBER</label>
                            <input id="inUber" type="number" placeholder="0.0" class="w-full p-3 bg-indigo-50 rounded-xl font-bold border-0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-rose-400">MADISA</label>
                            <input id="inMadisa" type="number" placeholder="0.0" class="w-full p-3 bg-rose-50 rounded-xl font-bold border-0">
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-center md:text-left">
                    <p class="text-[10px] font-black text-slate-400 uppercase">Total Z</p>
                    <p id="txtTotalCierre" class="text-4xl font-black text-indigo-600">0.00€</p>
                </div>
                <button id="btnGuardarCierre" class="w-full md:w-auto px-12 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-600 transition-all transform active:scale-95">
                    FINALIZAR DÍA
                </button>
            </div>
        </div>

        <div class="space-y-3">
            <h3 id="hdrHistorial" class="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Historial</h3>
            <div id="listaCierres" class="space-y-2"></div>
        </div>
    </div>
    <div id="undoContainer"></div>
    `;

    const inputs = [
        container.querySelector("#inCaja"), container.querySelector("#inTarjeta"),
        container.querySelector("#inGlovo"), container.querySelector("#inDeliveroo"),
        container.querySelector("#inUber"), container.querySelector("#inMadisa")
    ];
    const txtTotal = container.querySelector("#txtTotalCierre");

    const calcularTotalCents = () => {
        const totalCents = inputs.reduce((acc, input) => acc + toCents(input.value), 0);
        txtTotal.innerText = (totalCents / 100).toFixed(2) + "€";
        return totalCents;
    };

    inputs.forEach(input => input.addEventListener("input", calcularTotalCents));

    // --- GUARDADO + AUTO FACTURA Z ---
    container.querySelector("#btnGuardarCierre").onclick = async () => {
        const totalCents = calcularTotalCents();
        if (totalCents <= 0) return alert("Cierre vacío.");

        const todayLocal = localISODate();
        const totalVenta = totalCents / 100;

        // 1. Guardar en Cierres
        const cierreData = {
            id: Date.now().toString(),
            date: todayLocal,
            totalCaja: Number(inputs[0].value) || 0,
            totalTarjeta: Number(inputs[1].value) || 0,
            glovo: Number(inputs[2].value) || 0,
            deliveroo: Number(inputs[3].value) || 0,
            uber: Number(inputs[4].value) || 0,
            madisa: Number(inputs[5].value) || 0,
            totalVenta: totalVenta
        };

        const existingIdx = db.cierres.findIndex(c => c.date === todayLocal);
        if (existingIdx >= 0) db.cierres[existingIdx] = cierreData;
        else db.cierres.unshift(cierreData);

        // 2. MAGIA: Crear Factura Z automática (para Tesorería e IVA)
        const zNum = `Z-${todayLocal.replace(/-/g,'')}`;
        const existingFacturaIdx = db.facturas.findIndex(f => f.num === zNum);
        
        const facturaZ = {
            id: existingFacturaIdx >= 0 ? db.facturas[existingFacturaIdx].id : `z-${Date.now()}`,
            num: zNum,
            date: todayLocal,
            cliente: "Venta Diaria Z (Arume)",
            total: totalVenta,
            base: Number((totalVenta / 1.10).toFixed(2)), // Estimación 10% IVA
            tax: Number((totalVenta - (totalVenta / 1.10)).toFixed(2)),
            paid: true,
            reconciled: false, // Esperando al banco en Tesorería
            notes: `Caja: ${cierreData.totalCaja}€ | TPV: ${cierreData.totalTarjeta}€ | Apps: ${cierreData.glovo + cierreData.deliveroo + cierreData.uber + cierreData.madisa}€`
        };

        if (existingFacturaIdx >= 0) db.facturas[existingFacturaIdx] = facturaZ;
        else db.facturas.push(facturaZ);

        await saveFn("Cierre y Factura Z generados ⚡");
        inputs.forEach(i => i.value = "");
        calcularTotalCents();
        pintarCierres();
    };

    const pintarCierres = () => {
        const lista = container.querySelector("#listaCierres");
        lista.innerHTML = db.cierres.slice(0, 7).map(c => `
            <div class="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase">${c.date}</p>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[9px] font-bold text-emerald-600">💵 ${c.totalCaja.toFixed(2)}€</span>
                        <span class="text-[9px] font-bold text-blue-600">💳 ${c.totalTarjeta.toFixed(2)}€</span>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-black text-slate-800">${c.totalVenta.toFixed(2)}€</p>
                    <button onclick="window.borrarCierre('${c.id}')" class="text-[8px] text-rose-300 font-bold">Eliminar</button>
                </div>
            </div>
        `).join('') || '<p class="text-center py-10 text-slate-300 italic text-sm">Sin registros</p>';
    };

    // --- BORRADO ---
    window.borrarCierre = async (id) => {
        if(!confirm("¿Borrar cierre?")) return;
        const cierre = db.cierres.find(c => c.id === id);
        if(cierre) {
            // También borramos la Factura Z asociada
            const zNum = `Z-${cierre.date.replace(/-/g,'')}`;
            db.facturas = db.facturas.filter(f => f.num !== zNum);
            db.cierres = db.cierres.filter(c => c.id !== id);
            await saveFn("Cierre y Z eliminados");
            pintarCierres();
        }
    };

    pintarCierres();
}
/* =============================================================
   💰 MÓDULO: CONTROL DE CAJAS & CIERRES (Parte 3: Final - Dashboard)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    if (!db.cierres) db.cierres = [];
    if (!db.facturas) db.facturas = [];

    // --- HELPERS ---
    const toCents = (n) => Math.round((Number(n) || 0) * 100);
    const localISODate = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // --- CÁLCULOS ESTADÍSTICOS ---
    const getStats = () => {
        const recent = db.cierres.slice(0, 7);
        const totalSemana = recent.reduce((t, c) => t + (Number(c.totalVenta) || 0), 0);
        const mediaSemana = recent.length > 0 ? totalSemana / recent.length : 0;
        const ultimoCierre = db.cierres[0]?.totalVenta || 0;
        const diferencia = mediaSemana > 0 ? ((ultimoCierre - mediaSemana) / mediaSemana) * 100 : 0;
        
        return { totalSemana, mediaSemana, ultimoCierre, diferencia };
    };

    let stats = getStats();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-lg">
                <p class="text-[10px] font-black opacity-60 uppercase">Venta Último Z</p>
                <p class="text-3xl font-black">${stats.ultimoCierre.toLocaleString()}€</p>
                <p class="text-[10px] mt-2 font-bold ${stats.diferencia >= 0 ? 'text-emerald-300' : 'text-rose-300'}">
                    ${stats.diferencia >= 0 ? '▲' : '▼'} ${Math.abs(stats.diferencia).toFixed(1)}% vs media 7d
                </p>
            </div>
            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase">Media Semanal</p>
                <p class="text-3xl font-black text-slate-800">${stats.mediaSemana.toLocaleString()}€</p>
                <p class="text-[10px] mt-2 text-slate-400 font-bold">Últimos 7 cierres</p>
            </div>
            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase">Acumulado Semana</p>
                <p class="text-3xl font-black text-indigo-600">${stats.totalSemana.toLocaleString()}€</p>
                <p class="text-[10px] mt-2 text-slate-400 font-bold">Venta total bruta</p>
            </div>
        </div>

        <div class="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>
            
            <h2 class="text-xl font-black text-slate-800 mb-6">Nuevo Cierre Diario</h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-4">
                    <h3 class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">💰 Caja y TPV</h3>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">EFECTIVO TOTAL</label>
                        <input id="inCaja" type="number" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-0 focus:ring-2 focus:ring-indigo-500 transition">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">TARJETAS (DATAfONO)</label>
                        <input id="inTarjeta" type="number" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-0 focus:ring-2 focus:ring-indigo-500 transition">
                    </div>
                </div>

                <div class="space-y-4">
                    <h3 class="text-[10px] font-black text-orange-500 uppercase tracking-widest">🛵 Delivery</h3>
                    <div class="grid grid-cols-2 gap-3">
                        <input id="inGlovo" type="number" placeholder="Glovo" class="w-full p-3 bg-orange-50 rounded-xl font-bold border-0">
                        <input id="inDeliveroo" type="number" placeholder="Deliveroo" class="w-full p-3 bg-teal-50 rounded-xl font-bold border-0">
                        <input id="inUber" type="number" placeholder="Uber" class="w-full p-3 bg-indigo-50 rounded-xl font-bold border-0">
                        <input id="inMadisa" type="number" placeholder="Otros" class="w-full p-3 bg-slate-50 rounded-xl font-bold border-0">
                    </div>
                </div>
            </div>

            <div class="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-center md:text-left">
                    <p class="text-[10px] font-black text-slate-400 uppercase">Total Venta Bruta (Z)</p>
                    <p id="txtTotalCierre" class="text-4xl font-black text-indigo-600">0.00€</p>
                </div>
                <button id="btnGuardarCierre" class="w-full md:w-auto px-12 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-600 transition-all transform active:scale-95">
                    GUARDAR Y GENERAR Z
                </button>
            </div>
        </div>

        <div class="space-y-3">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Historial Reciente</h3>
            <div id="listaCierres" class="space-y-2"></div>
        </div>
    </div>
    `;

    const inputs = [
        container.querySelector("#inCaja"), container.querySelector("#inTarjeta"),
        container.querySelector("#inGlovo"), container.querySelector("#inDeliveroo"),
        container.querySelector("#inUber"), container.querySelector("#inMadisa")
    ];
    const txtTotal = container.querySelector("#txtTotalCierre");

    const calcularTotalCents = () => {
        const totalCents = inputs.reduce((acc, input) => acc + toCents(input.value), 0);
        txtTotal.innerText = (totalCents / 100).toFixed(2) + "€";
        return totalCents;
    };

    inputs.forEach(input => input.addEventListener("input", calcularTotalCents));

    container.querySelector("#btnGuardarCierre").onclick = async () => {
        const totalCents = calcularTotalCents();
        if (totalCents <= 0) return alert("Cierre vacío.");

        const todayLocal = localISODate();
        const totalVenta = totalCents / 100;

        const cierreData = {
            id: Date.now().toString(),
            date: todayLocal,
            totalCaja: Number(inputs[0].value) || 0,
            totalTarjeta: Number(inputs[1].value) || 0,
            glovo: Number(inputs[2].value) || 0,
            deliveroo: Number(inputs[3].value) || 0,
            uber: Number(inputs[4].value) || 0,
            madisa: Number(inputs[5].value) || 0,
            totalVenta: totalVenta
        };

        // Guardar Cierre
        const existingIdx = db.cierres.findIndex(c => c.date === todayLocal);
        if (existingIdx >= 0) db.cierres[existingIdx] = cierreData;
        else db.cierres.unshift(cierreData);

        // Crear/Actualizar Factura Z
        const zNum = `Z-${todayLocal.replace(/-/g,'')}`;
        const existingFacturaIdx = db.facturas.findIndex(f => f.num === zNum);
        const facturaZ = {
            id: existingFacturaIdx >= 0 ? db.facturas[existingFacturaIdx].id : `z-${Date.now()}`,
            num: zNum, date: todayLocal, cliente: "Venta Diaria Z",
            total: totalVenta, base: Number((totalVenta / 1.10).toFixed(2)),
            tax: Number((totalVenta - (totalVenta / 1.10)).toFixed(2)),
            paid: true, reconciled: false
        };
        if (existingFacturaIdx >= 0) db.facturas[existingFacturaIdx] = facturaZ;
        else db.facturas.push(facturaZ);

        await saveFn("¡Cierre completado! ✨");
        render(container, supabase, db, opts); // Recargar para actualizar stats
    };

    const pintarCierres = () => {
        container.querySelector("#listaCierres").innerHTML = db.cierres.slice(0, 10).map(c => `
            <div class="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase">${c.date}</p>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[10px] font-bold text-slate-700">💵 ${c.totalCaja.toFixed(2)}</span>
                        <span class="text-[10px] font-bold text-indigo-500">💳 ${c.totalTarjeta.toFixed(2)}</span>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xl font-black text-slate-800">${c.totalVenta.toFixed(2)}€</p>
                    <button onclick="window.borrarCierre('${c.id}')" class="text-[8px] text-rose-300 font-bold hover:text-rose-500 uppercase">Eliminar</button>
                </div>
            </div>
        `).join('');
    };

    window.borrarCierre = async (id) => {
        if(!confirm("¿Borrar cierre y su factura Z?")) return;
        const c = db.cierres.find(x => x.id === id);
        if(c) {
            db.facturas = db.facturas.filter(f => f.num !== `Z-${c.date.replace(/-/g,'')}`);
            db.cierres = db.cierres.filter(x => x.id !== id);
            await saveFn("Eliminado");
            render(container, supabase, db, opts);
        }
    };

    pintarCierres();
}
