/* =============================================================
   💰 MÓDULO: CONTROL DE CAJAS & CIERRES (Versión Master Definitiva)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. INICIALIZACIÓN
    if (!db.cierres) db.cierres = [];
    if (!db.facturas) db.facturas = [];
    if (!db.albaranes) db.albaranes = []; // Para registrar gastos pagados con caja

    // --- HELPERS (Precisión y Fechas) ---
    const toCents = (n) => Math.round((Number(n) || 0) * 100);
    const localISODate = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const getKpis = () => {
        const recent = db.cierres.slice(0, 7);
        const totalSemana = recent.reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0);
        const mediaSemana = recent.length > 0 ? totalSemana / recent.length : 0;
        return { totalSemana, mediaSemana };
    };

    let kpis = getKpis();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800 tracking-tight">Registro de Cajas</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Histórico Arume</p>
            </div>
            <div class="flex gap-2">
                <div class="bg-white px-5 py-2 rounded-2xl border border-slate-100 text-right shadow-sm">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Media 7d</p>
                    <p class="text-lg font-black text-slate-800">${kpis.mediaSemana.toLocaleString('es-ES',{maximumFractionDigits:0})}€</p>
                </div>
                <div class="bg-indigo-50 px-5 py-2 rounded-2xl border border-indigo-100 text-right shadow-sm">
                    <p class="text-[9px] font-black text-indigo-400 uppercase">Semana</p>
                    <p class="text-lg font-black text-indigo-700">${kpis.totalSemana.toLocaleString('es-ES',{maximumFractionDigits:0})}€</p>
                </div>
            </div>
        </header>

        <div class="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-emerald-400"></div>
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h3 class="text-xl font-black text-slate-800">Cierre de Jornada</h3>
                <div class="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl">
                    <span class="text-[10px] font-black text-slate-400 uppercase ml-2">Día del Cierre:</span>
                    <input id="inFechaCierre" type="date" value="${localISODate()}" class="bg-white px-4 py-2 rounded-xl text-xs font-black text-indigo-600 border-0 outline-none shadow-sm cursor-pointer">
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                <div class="space-y-4">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">1</span> Venta Según Z
                    </h4>
                    <div class="space-y-3">
                        <div class="relative">
                            <label class="absolute top-2 left-4 text-[9px] font-bold text-slate-400 uppercase">Efectivo (Z)</label>
                            <input id="inVentaEfectivo" type="number" step="0.01" class="w-full pt-6 pb-2 px-4 bg-slate-50 rounded-2xl text-lg font-black border-2 border-transparent focus:border-indigo-500 outline-none transition">
                        </div>
                        <div class="relative">
                            <label class="absolute top-2 left-4 text-[9px] font-bold text-slate-400 uppercase">Tarjeta (TPV)</label>
                            <input id="inVentaTarjeta" type="number" step="0.01" class="w-full pt-6 pb-2 px-4 bg-slate-50 rounded-2xl text-lg font-black border-2 border-transparent focus:border-indigo-500 outline-none transition">
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">2</span> Apps & Otros
                    </h4>
                    <div class="grid grid-cols-2 gap-3">
                        <input id="inGlovo" type="number" placeholder="Glovo" class="p-3 bg-orange-50/50 rounded-xl font-bold border-0 outline-none text-sm">
                        <input id="inDeliveroo" type="number" placeholder="Deliveroo" class="p-3 bg-teal-50/50 rounded-xl font-bold border-0 outline-none text-sm">
                        <input id="inUber" type="number" placeholder="Uber" class="p-3 bg-indigo-50/50 rounded-xl font-bold border-0 outline-none text-sm">
                        <input id="inMadisa" type="number" placeholder="Madisa" class="p-3 bg-rose-50/50 rounded-xl font-bold border-0 outline-none text-sm">
                    </div>
                    <input id="inInvitaciones" type="number" placeholder="Invitaciones / Personal" class="w-full p-3 bg-slate-100 rounded-xl font-bold border-0 outline-none text-sm">
                </div>

                <div class="space-y-4">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">3</span> Cajón Real
                    </h4>
                    <div class="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-inner">
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">Efectivo contado físico</label>
                        <input id="inCajaFisica" type="number" placeholder="0.00" class="w-full bg-transparent text-4xl font-black text-emerald-400 outline-none border-b border-slate-800 pb-2 mb-4">
                        
                        <div class="space-y-2 opacity-80 text-xs">
                            <div class="flex justify-between font-bold">
                                <span class="text-slate-500">Esperado (Venta)</span>
                                <span id="valVentaEf">0.00€</span>
                            </div>
                            <div class="flex justify-between font-bold pt-2 border-t border-slate-800">
                                <span>Descuadre</span>
                                <span id="valDescuadre" class="text-emerald-400">0.00€</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div class="w-full md:w-1/3">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Notas del turno</label>
                    <input id="inNotas" type="text" placeholder="Ej: Faltó cambio, mucha gente..." class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-0 outline-none mt-1">
                </div>
                
                <div class="text-center md:text-right">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Jornada Bruta</p>
                    <span id="txtTotalCierre" class="text-5xl font-black text-indigo-600 tracking-tighter">0.00€</span>
                </div>

                <div class="flex flex-col gap-3 w-full md:w-auto">
                    <div class="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100 mb-2">
                        <input type="checkbox" id="chkGastoCaja" class="w-5 h-5 accent-amber-500 cursor-pointer">
                        <label for="chkGastoCaja" class="text-[10px] font-black text-amber-700 uppercase cursor-pointer">¿Pagos con caja?</label>
                    </div>
                    <button id="btnGuardarCierre" class="w-full md:px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">
                        REGISTRAR CIERRE Z
                    </button>
                </div>
            </div>
        </div>

        <div class="space-y-4">
            <div class="flex justify-between items-center px-6">
                <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Historial</h3>
                <div class="relative">
                    <span class="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                    <input id="searchHistorial" type="text" placeholder="Buscar fecha..." class="pl-8 pr-4 py-2 bg-white border border-slate-100 rounded-full text-[10px] font-bold outline-none shadow-sm w-48 focus:w-64 transition-all">
                </div>
            </div>
            <div id="listaCierres" class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10"></div>
        </div>
    </div>
    `;

    // --- LÓGICA DE CONTROL ---
    const inFecha = container.querySelector("#inFechaCierre");
    const flds = {
        vEf: container.querySelector("#inVentaEfectivo"),
        vTr: container.querySelector("#inVentaTarjeta"),
        gl: container.querySelector("#inGlovo"),
        de: container.querySelector("#inDeliveroo"),
        ub: container.querySelector("#inUber"),
        ma: container.querySelector("#inMadisa"),
        inv: container.querySelector("#inInvitaciones"),
        fis: container.querySelector("#inCajaFisica"),
        not: container.querySelector("#inNotas"),
        chk: container.querySelector("#chkGastoCaja")
    };
    
    const txtTotal = container.querySelector("#txtTotalCierre");
    const valVentaEf = container.querySelector("#valVentaEf");
    const valDescuadre = container.querySelector("#valDescuadre");

    const refresh = () => {
        const ventaEf = toCents(flds.vEf.value);
        const ventaTr = toCents(flds.vTr.value);
        const apps = toCents(flds.gl.value) + toCents(flds.de.value) + toCents(flds.ub.value) + toCents(flds.ma.value);
        const total = ventaEf + ventaTr + apps;
        
        txtTotal.innerText = (total / 100).toFixed(2) + "€";
        valVentaEf.innerText = (ventaEf / 100).toFixed(2) + "€";

        // Descuadre (Suponiendo fondo de 300€)
        const fondoCaja = 30000; // 300.00€
        const esperado = fondoCaja + ventaEf;
        const real = toCents(flds.fis.value);
        
        // Si no han puesto el arqueo, no mostramos descuadre loco
        if (flds.fis.value === '') {
            valDescuadre.innerText = "---";
            valDescuadre.className = "text-slate-500";
        } else {
            const desc = real - esperado;
            valDescuadre.innerText = (desc / 100).toFixed(2) + "€";
            valDescuadre.className = desc >= 0 ? 'text-emerald-400' : 'text-rose-400';
        }

        return total;
    };

    Object.values(flds).forEach(f => {
        if(f && f.type === 'number') f.addEventListener("input", refresh);
    });

    // --- GUARDAR CIERRE ---
    container.querySelector("#btnGuardarCierre").onclick = async () => {
        const totalCents = refresh();
        if(totalCents <= 0) return alert("Introduce algún importe para cerrar.");

        const fechaSeleccionada = inFecha.value; // Usamos la fecha del calendario
        
        // Registrar Gasto de Caja si aplica
        if(flds.chk.checked) {
            const concepto = prompt("¿Qué has pagado? (ej: Hielo, Taxi):");
            const importe = prompt("¿Cuánto has pagado (€)?:");
            if(concepto && importe) {
                db.albaranes.push({
                    id: 'cash-'+Date.now(),
                    date: fechaSeleccionada,
                    prov: concepto,
                    num: "CAJA",
                    total: parseFloat(importe),
                    base: parseFloat(importe),
                    taxes: 0,
                    paid: true,
                    status: 'ok',
                    notes: "Pagado con efectivo de caja (Cierre)"
                });
            }
        }

        const cierreData = {
            id: Date.now().toString(),
            date: fechaSeleccionada,
            totalVenta: totalCents / 100,
            efectivo: Number(flds.vEf.value) || 0,
            tarjeta: Number(flds.vTr.value) || 0,
            apps: (toCents(flds.gl.value) + toCents(flds.de.value) + toCents(flds.ub.value) + toCents(flds.ma.value)) / 100,
            descuadre: parseFloat(valDescuadre.innerText) || 0,
            notas: flds.not.value
        };

        // Si ya existe caja ese día, actualizamos en lugar de duplicar
        const idx = db.cierres.findIndex(c => c.date === fechaSeleccionada);
        if(idx >= 0) {
            if(!confirm(`Ya existe una caja para el día ${fechaSeleccionada}. ¿Quieres sobrescribirla?`)) return;
            db.cierres[idx] = cierreData;
        } else {
            db.cierres.unshift(cierreData);
        }

        // Generar Factura Z automática para Tesorería
        const zNum = `Z-${fechaSeleccionada.replace(/-/g,'')}`;
        const fIdx = db.facturas.findIndex(f => f.num === zNum);
        
        const fZ = {
            id: fIdx >= 0 ? db.facturas[fIdx].id : `z-${Date.now()}`,
            num: zNum,
            date: fechaSeleccionada,
            cliente: "Z DIARIO (Arume)",
            total: cierreData.totalVenta,
            base: Number((cierreData.totalVenta / 1.10).toFixed(2)),
            tax: Number((cierreData.totalVenta - (cierreData.totalVenta/1.10)).toFixed(2)),
            paid: true,
            reconciled: false,
            notes: `Ef: ${cierreData.efectivo} | Tr: ${cierreData.tarjeta} | Apps: ${cierreData.apps}`
        };

        if(fIdx >= 0) db.facturas[fIdx] = fZ;
        else db.facturas.push(fZ);

        await saveFn(`Cierre del ${fechaSeleccionada} guardado correctamente ✅`);
        
        // Limpiar formulario
        Object.values(flds).forEach(f => { if(f.type !== 'date' && f.type !== 'checkbox') f.value = ''; });
        flds.chk.checked = false;
        refresh();
        pintar();
    };

    // --- PINTAR HISTORIAL CON BUSCADOR ---
    const pintar = () => {
        const term = (container.querySelector("#searchHistorial")?.value || "").toLowerCase();
        
        const filtrados = db.cierres
            .filter(c => c.date.includes(term) || (c.notas && c.notas.toLowerCase().includes(term)))
            .sort((a,b) => new Date(b.date) - new Date(a.date));

        container.querySelector("#listaCierres").innerHTML = filtrados.slice(0, 20).map(c => `
            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex justify-between items-center group relative hover:shadow-md transition">
                <div>
                    <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg w-fit mb-2">${c.date}</p>
                    <div class="flex flex-wrap gap-3">
                        <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1">💵 ${parseFloat(c.efectivo||0).toFixed(2)}€</span>
                        <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1">💳 ${parseFloat(c.tarjeta||0).toFixed(2)}€</span>
                        ${c.apps > 0 ? `<span class="text-[10px] font-bold text-orange-400 flex items-center gap-1">🛵 ${parseFloat(c.apps||0).toFixed(2)}€</span>` : ''}
                    </div>
                    ${c.notas ? `<p class="text-[9px] text-slate-400 italic mt-2 border-l-2 border-slate-200 pl-2">"${c.notas}"</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="text-2xl font-black text-slate-800">${parseFloat(c.totalVenta).toFixed(2)}€</p>
                    ${c.descuadre !== 0 ? `<p class="text-[8px] font-bold ${c.descuadre>0?'text-emerald-500':'text-rose-500'}">${c.descuadre>0?'+':''}${c.descuadre}€</p>` : ''}
                    <button onclick="window.borrarCierre('${c.id}')" class="text-[8px] text-rose-300 font-bold uppercase hover:text-rose-500 opacity-0 group-hover:opacity-100 transition mt-1">Borrar</button>
                </div>
            </div>
        `).join('') || '<div class="col-span-full text-center py-10 text-slate-300 italic text-sm">No hay cierres para esta fecha.</div>';
    };

    window.borrarCierre = async (id) => {
        if(!confirm("¿Seguro que quieres borrar este cierre y su Z asociada?")) return;
        const c = db.cierres.find(x => x.id === id);
        if(c) {
            const zNum = `Z-${c.date.replace(/-/g,'')}`;
            db.facturas = db.facturas.filter(f => f.num !== zNum); // Borrar la Z también
            db.cierres = db.cierres.filter(x => x.id !== id);
            await saveFn("Cierre eliminado");
            render(container, supabase, db, opts);
        }
    };

    // Evento buscador
    const searchInput = container.querySelector("#searchHistorial");
    if(searchInput) searchInput.oninput = pintar;

    pintar();
} // <--- ¡AQUÍ ESTÁ LA LLAVE QUE FALTABA!
