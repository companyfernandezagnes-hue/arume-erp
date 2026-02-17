/* =============================================================
   💰 MÓDULO: CONTROL DE CAJAS & CIERRES (Versión Master Arume)
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

    const stats = () => {
        const recent = db.cierres.slice(0, 7);
        const totalSemana = recent.reduce((t, c) => t + (Number(c.totalVenta) || 0), 0);
        const mediaSemana = recent.length > 0 ? totalSemana / recent.length : 0;
        return { totalSemana, mediaSemana };
    };

    let kpis = stats();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Media 7 Días</p>
                <p class="text-xl font-black text-slate-800">${kpis.mediaSemana.toLocaleString()}€</p>
            </div>
            <div class="bg-indigo-50 p-4 rounded-[2rem] border border-indigo-100 shadow-sm">
                <p class="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Venta Semanal</p>
                <p class="text-xl font-black text-indigo-600">${kpis.totalSemana.toLocaleString()}€</p>
            </div>
             <div class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Z Ayer</p>
                <p class="text-xl font-black text-slate-800">${(db.cierres[0]?.totalVenta || 0).toLocaleString()}€</p>
            </div>
            <div class="bg-emerald-50 p-4 rounded-[2rem] border border-emerald-100 shadow-sm">
                <p class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Estado</p>
                <p class="text-xl font-black text-emerald-600">Abierto</p>
            </div>
        </div>

        <div class="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h2 class="text-2xl font-black text-slate-800">Cierre de Caja</h2>
                <div class="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl">
                    <span class="text-[10px] font-black text-slate-400 uppercase ml-2">Día del Cierre:</span>
                    <input id="inFechaCierre" type="date" value="${localISODate()}" class="bg-white px-4 py-2 rounded-xl text-xs font-black text-indigo-600 border-0 outline-none shadow-sm">
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                <div class="space-y-6">
                    <div class="flex items-center gap-2">
                        <span class="bg-indigo-100 text-indigo-600 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold">1</span>
                        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Ventas Totales (Z)</h3>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 ml-2 uppercase">Efectivo (en Z)</label>
                            <input id="inVentaEfectivo" type="number" step="0.01" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none transition">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 ml-2 uppercase">Tarjetas / TPV</label>
                            <input id="inVentaTarjeta" type="number" step="0.01" placeholder="0.00" class="w-full p-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none transition">
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="flex items-center gap-2">
                        <span class="bg-orange-100 text-orange-600 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold">2</span>
                        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Apps & Delivery</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[9px] font-bold text-orange-400 ml-2 uppercase">Glovo</label>
                            <input id="inGlovo" type="number" placeholder="0" class="w-full p-3 bg-orange-50/50 rounded-xl font-bold border-0 outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-teal-400 ml-2 uppercase">Deliveroo</label>
                            <input id="inDeliveroo" type="number" placeholder="0" class="w-full p-3 bg-teal-50/50 rounded-xl font-bold border-0 outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-indigo-400 ml-2 uppercase">Uber Eats</label>
                            <input id="inUber" type="number" placeholder="0" class="w-full p-3 bg-indigo-50/50 rounded-xl font-bold border-0 outline-none">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-rose-400 ml-2 uppercase">Madisa</label>
                            <input id="inMadisa" type="number" placeholder="0" class="w-full p-3 bg-rose-50/50 rounded-xl font-bold border-0 outline-none">
                        </div>
                    </div>
                    <div class="pt-2">
                        <label class="text-[10px] font-bold text-slate-400 ml-2 uppercase">Invitaciones / Personal</label>
                        <input id="inInvitaciones" type="number" placeholder="0.00" class="w-full p-3 bg-slate-100 rounded-xl font-bold border-0 outline-none">
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="flex items-center gap-2">
                        <span class="bg-emerald-100 text-emerald-600 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold">3</span>
                        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Cajón Físico</h3>
                    </div>
                    <div class="p-6 bg-slate-900 rounded-[2.5rem] shadow-inner space-y-4">
                        <div>
                            <label class="text-[9px] font-bold text-slate-500 ml-2 uppercase tracking-widest">Dinero real contado</label>
                            <input id="inCajaFisica" type="number" placeholder="0.00" class="w-full p-4 bg-slate-800 rounded-2xl text-2xl font-black text-emerald-400 border-0 outline-none focus:ring-2 focus:ring-emerald-500 transition">
                        </div>
                        <div class="pt-4 border-t border-slate-800 space-y-2">
                            <div class="flex justify-between text-[10px] font-bold">
                                <span class="text-slate-500">Venta Efectivo</span>
                                <span id="valVentaEf" class="text-white">0.00€</span>
                            </div>
                            <div class="flex justify-between text-[10px] font-bold">
                                <span class="text-slate-500">Diferencia</span>
                                <span id="valDescuadre" class="text-white">0.00€</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end gap-6">
                <div class="w-full md:w-1/3">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Notas del turno</label>
                    <input id="inNotas" type="text" placeholder="Ej: Faltó cambio, mucha gente..." class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-0 outline-none mt-1">
                </div>
                
                <div class="text-center md:text-right">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Jornada Bruta</p>
                    <span id="txtTotalCierre" class="text-6xl font-black text-indigo-600 tracking-tighter">0.00€</span>
                </div>
                
                <div class="flex flex-col gap-3 w-full md:w-auto">
                    <div class="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100 mb-2">
                        <input type="checkbox" id="chkGastoCaja" class="w-5 h-5 accent-amber-500">
                        <label for="chkGastoCaja" class="text-[10px] font-black text-amber-700 uppercase">¿Pagos con dinero de caja?</label>
                    </div>
                    <button id="btnGuardarCierre" class="w-full md:px-16 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">
                        REGISTRAR CIERRE Z
                    </button>
                </div>
            </div>
        </div>

        <div class="space-y-4">
            <div class="flex justify-between items-center px-6">
                <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Historial</h3>
                <input id="searchHistorial" type="text" placeholder="Filtrar fecha..." class="bg-white border border-slate-100 rounded-full px-4 py-2 text-[10px] font-bold outline-none shadow-sm w-48">
            </div>
            <div id="listaCierres" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
        </div>
    </div>
    `;
    // --- LÓGICA DE CONTROL ---
    const flds = {
        vEf: container.querySelector("#inVentaEfectivo"),
        vTr: container.querySelector("#inVentaTarjeta"),
        gl: container.querySelector("#inGlovo"),
        de: container.querySelector("#inDeliveroo"),
        ub: container.querySelector("#inUber"),
        ma: container.querySelector("#inMadisa"),
        inv: container.querySelector("#inInvitaciones"),
        fis: container.querySelector("#inCajaFisica"),
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

        // Ajuste de Arqueo (Supongamos un fondo de 300€)
        const fondoCaja = 30000; 
        const esperado = fondoCaja + ventaEf;
        const real = toCents(flds.fis.value);
        const desc = real - esperado;
        
        valDescuadre.innerText = (desc / 100).toFixed(2) + "€";
        valDescuadre.className = desc >= 0 ? 'text-emerald-400' : 'text-rose-400';

        return total;
    };

    Object.values(flds).forEach(f => {
        if(f.type === 'number') f.addEventListener("input", refresh);
    });

    // --- GUARDAR ---
    container.querySelector("#btnGuardarCierre").onclick = async () => {
        const totalCents = refresh();
        if(totalCents <= 0) return alert("Cierre vacío.");

        const today = localISODate();
        
        // Registrar Gasto de Caja si aplica
        if(flds.chk.checked) {
            const concepto = prompt("¿Qué has pagado? (ej: Hielo, Makro):");
            const importe = prompt("¿Cuánto has pagado (€)?:");
            if(concepto && importe) {
                db.albaranes.push({
                    id: 'cash-'+Date.now(), date: today, prov: concepto, total: parseFloat(importe),
                    base: parseFloat(importe), taxes: 0, paid: true, notes: "Pagado con dinero de caja"
                });
            }
        }

        const cierreData = {
            id: Date.now().toString(),
            date: today,
            totalVenta: totalCents / 100,
            efectivo: Number(flds.vEf.value) || 0,
            tarjeta: Number(flds.vTr.value) || 0,
            apps: (toCents(flds.gl.value) + toCents(flds.de.value) + toCents(flds.ub.value) + toCents(flds.ma.value)) / 100,
            descuadre: parseFloat(valDescuadre.innerText)
        };

        const idx = db.cierres.findIndex(c => c.date === today);
        if(idx >= 0) db.cierres[idx] = cierreData;
        else db.cierres.unshift(cierreData);

        // Generar Factura Z para Tesorería
        const zNum = `Z-${today.replace(/-/g,'')}`;
        const fIdx = db.facturas.findIndex(f => f.num === zNum);
        const fZ = {
            id: fIdx >= 0 ? db.facturas[fIdx].id : `z-${Date.now()}`,
            num: zNum, date: today, cliente: "Z DIARIO",
            total: cierreData.totalVenta, base: cierreData.totalVenta / 1.10, tax: cierreData.totalVenta - (cierreData.totalVenta/1.10),
            paid: true, reconciled: false,
            notes: `Ef: ${cierreData.efectivo} | Tr: ${cierreData.tarjeta} | Apps: ${cierreData.apps}`
        };
        if(fIdx >= 0) db.facturas[fIdx] = fZ;
        else db.facturas.push(fZ);

        await saveFn("Cierre registrado y Factura Z generada ✨");
        render(container, supabase, db, opts);
    };

   // --- PINTAR HISTORIAL CON BUSCADOR ---
    const pintar = () => {
        // 1. Cogemos lo que has escrito en el buscador
        const term = (container.querySelector("#searchHistorial")?.value || "").toLowerCase();
        
        // 2. Filtramos la lista de cierres
        const filtrados = db.cierres
            .filter(c => c.date.includes(term))
            .sort((a,b) => new Date(b.date) - new Date(a.date));

        // 3. Pintamos
        container.querySelector("#listaCierres").innerHTML = filtrados.slice(0, 20).map(c => `
            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex justify-between items-center group relative">
                <div>
                    <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">${c.date}</p>
                    <div class="flex gap-3 mt-2">
                        <span class="text-[9px] font-bold text-slate-500">💵 ${parseFloat(c.efectivo||0).toFixed(2)}€</span>
                        <span class="text-[9px] font-bold text-slate-500">💳 ${parseFloat(c.tarjeta||0).toFixed(2)}€</span>
                        <span class="text-[9px] font-bold text-orange-400">🛵 ${parseFloat(c.apps||0).toFixed(2)}€</span>
                    </div>
                    ${c.notas ? `<p class="text-[9px] text-slate-400 italic mt-2">"${c.notas}"</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="text-xl font-black text-slate-800">${parseFloat(c.totalVenta).toFixed(2)}€</p>
                    <button onclick="window.borrarCierre('${c.id}')" class="text-[8px] text-rose-300 font-bold uppercase hover:text-rose-500 opacity-0 group-hover:opacity-100 transition">Borrar</button>
                </div>
            </div>
        `).join('') || '<p class="col-span-full text-center py-20 text-slate-300 italic">No hay cajas con esa fecha</p>';
    };

    // 4. Activamos el evento de escribir
    const searchInput = container.querySelector("#searchHistorial");
    if(searchInput) searchInput.oninput = pintar;

    pintar();
