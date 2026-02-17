/* =============================================================
   💰 MÓDULO: CAJAS & GERENCIA (v3.0: Retro-Compatibility Fix)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. INICIALIZACIÓN Y MIGRACIÓN AUTOMÁTICA
    if (!db.cierres) db.cierres = [];
    if (!db.facturas) db.facturas = [];
    if (!db.albaranes) db.albaranes = [];

    // --- 🛠️ PARCHE DE RESCATE (MIGRACIÓN) ---
    // Si hay cierres antiguos sin fecha normalizada o con estructura vieja, los arreglamos
    db.cierres.forEach(c => {
        // 1. Asegurar formato de fecha YYYY-MM-DD
        if (c.date && c.date.includes('/')) {
            const parts = c.date.split('/');
            if (parts.length === 3) {
                // Asumimos DD/MM/YYYY -> YYYY-MM-DD
                c.date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
        }
        
        // 2. Asegurar totales numéricos (evitar nulos)
        c.totalVenta = parseFloat(c.totalVenta) || parseFloat(c.total) || 0;
        c.efectivo = parseFloat(c.efectivo) || parseFloat(c.totalCaja) || 0;
        c.tarjeta = parseFloat(c.tarjeta) || parseFloat(c.totalTarjeta) || 0;
        
        // 3. Reconstruir desglose de apps si falta (para que no de error)
        if (c.apps === undefined) {
            // Intentar sumar campos antiguos si existen (glovo, uber...)
            const appsTotal = (parseFloat(c.glovo)||0) + (parseFloat(c.deliveroo)||0) + (parseFloat(c.uber)||0) + (parseFloat(c.madisa)||0);
            c.apps = appsTotal;
        }
    });
    // Guardamos la base de datos "arreglada" para que no vuelva a pasar
    // (Nota: No llamamos a save() directo para no saturar, se guardará en la próxima acción)

    // Estado del filtro (Por defecto: Mes Actual)
    let currentFilterDate = new Date().toISOString().slice(0, 7); // "2026-02"

    // --- HELPERS ---
    const toCents = (n) => Math.round((Number(n) || 0) * 100);
    const localISODate = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // --- CÁLCULO DE KPIS (ESTADÍSTICAS) ---
    const getKpis = () => {
        // Filtrar por el mes seleccionado
        const cierresMes = db.cierres.filter(c => c.date && c.date.startsWith(currentFilterDate));
        
        const total = cierresMes.reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0);
        const dias = cierresMes.length;
        const media = dias > 0 ? total / dias : 0;
        
        // Desglose
        const efec = cierresMes.reduce((acc, c) => acc + (parseFloat(c.efectivo) || 0), 0);
        const tarj = cierresMes.reduce((acc, c) => acc + (parseFloat(c.tarjeta) || 0), 0);
        const apps = cierresMes.reduce((acc, c) => acc + (parseFloat(c.apps) || 0), 0);

        return { total, media, dias, efec, tarj, apps };
    };

    // --- INTERFAZ ---
    const draw = () => {
        const kpis = getKpis();
        const [year, month] = currentFilterDate.split('-');
        const nombreMes = new Date(year, month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });

        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
                <div>
                    <h2 class="text-xl font-black text-slate-800 tracking-tight">Control de Caja</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Visión Mensual</p>
                </div>
                
                <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button id="btnPrevMonth" class="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-slate-600 shadow-sm hover:bg-indigo-50 transition">‹</button>
                    <input id="monthPicker" type="month" value="${currentFilterDate}" class="bg-transparent border-0 text-xs font-black text-slate-700 uppercase outline-none text-center w-32 cursor-pointer">
                    <button id="btnNextMonth" class="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-slate-600 shadow-sm hover:bg-indigo-50 transition">›</button>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-6 opacity-10 text-6xl">💶</div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación ${nombreMes}</p>
                    <p class="text-4xl font-black mt-2">${kpis.total.toLocaleString('es-ES', {minimumFractionDigits: 0})}€</p>
                    <p class="text-[10px] text-emerald-400 mt-1 font-bold">Media diaria: ${kpis.media.toFixed(0)}€ (${kpis.dias} cierres)</p>
                </div>

                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Distribución de Cobro</p>
                    
                    <div class="space-y-2">
                        <div class="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>💳 Tarjeta</span>
                            <span>${kpis.tarj.toLocaleString()}€</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-indigo-500" style="width: ${(kpis.total > 0 ? (kpis.tarj/kpis.total)*100 : 0)}%"></div>
                        </div>

                        <div class="flex justify-between text-[10px] font-bold text-slate-600 mt-1">
                            <span>💵 Efectivo</span>
                            <span>${kpis.efec.toLocaleString()}€</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500" style="width: ${(kpis.total > 0 ? (kpis.efec/kpis.total)*100 : 0)}%"></div>
                        </div>
                    </div>
                </div>

                <div class="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 shadow-sm relative">
                    <p class="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Impacto Delivery</p>
                    <p class="text-3xl font-black text-orange-600 mt-2">${kpis.apps.toLocaleString()}€</p>
                    <p class="text-[10px] text-orange-400 mt-1 font-bold">
                        Representa el ${(kpis.total > 0 ? (kpis.apps/kpis.total)*100 : 0).toFixed(1)}% del total
                    </p>
                </div>
            </div>

            <div class="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-emerald-400"></div>
                
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <h3 class="text-xl font-black text-slate-800">Nuevo Cierre Z</h3>
                    <div class="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl">
                        <span class="text-[10px] font-black text-slate-400 uppercase ml-2">Fecha:</span>
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
                <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-6">
                    Movimientos de ${nombreMes} (${kpis.dias})
                </h3>
                <div id="listaCierres" class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10"></div>
            </div>
        </div>
        `;

        setupEvents();
        pintarListaCierres();
    };

    // --- LOGICA DE EVENTOS ---
    const setupEvents = () => {
        // 1. Selector de Mes
        const monthPicker = container.querySelector("#monthPicker");
        
        monthPicker.onchange = (e) => {
            currentFilterDate = e.target.value;
            draw(); // Redibujar todo con los nuevos datos
        };

        container.querySelector("#btnPrevMonth").onclick = () => {
            let [y, m] = currentFilterDate.split('-').map(Number);
            m--; if(m === 0) { m = 12; y--; }
            currentFilterDate = `${y}-${String(m).padStart(2,'0')}`;
            draw();
        };

        container.querySelector("#btnNextMonth").onclick = () => {
            let [y, m] = currentFilterDate.split('-').map(Number);
            m++; if(m === 13) { m = 1; y++; }
            currentFilterDate = `${y}-${String(m).padStart(2,'0')}`;
            draw();
        };

        // 2. Lógica de Inputs (Calculadora)
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

        const refreshCalc = () => {
            const ventaEf = toCents(flds.vEf.value);
            const ventaTr = toCents(flds.vTr.value);
            const apps = toCents(flds.gl.value) + toCents(flds.de.value) + toCents(flds.ub.value) + toCents(flds.ma.value);
            const total = ventaEf + ventaTr + apps;
            
            txtTotal.innerText = (total / 100).toFixed(2) + "€";
            valVentaEf.innerText = (ventaEf / 100).toFixed(2) + "€";

            const fondoCaja = 30000; // 300.00€
            const esperado = fondoCaja + ventaEf;
            const real = toCents(flds.fis.value);
            
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

        Object.values(flds).forEach(f => { if(f && f.type === 'number') f.addEventListener("input", refreshCalc); });

        // 3. Botón Guardar
        container.querySelector("#btnGuardarCierre").onclick = async () => {
            const totalCents = refreshCalc();
            if(totalCents <= 0) return alert("Introduce algún importe para cerrar.");

            const fechaSeleccionada = inFecha.value;
            
            if(flds.chk.checked) {
                const concepto = prompt("¿Qué has pagado? (ej: Hielo, Taxi):");
                const importe = prompt("¿Cuánto has pagado (€)?:");
                if(concepto && importe) {
                    db.albaranes.push({
                        id: 'cash-'+Date.now(), date: fechaSeleccionada, prov: concepto, num: "CAJA",
                        total: parseFloat(importe), base: parseFloat(importe), taxes: 0,
                        paid: true, status: 'ok', notes: "Pagado con efectivo de caja (Cierre)"
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

            const idx = db.cierres.findIndex(c => c.date === fechaSeleccionada);
            if(idx >= 0) {
                if(!confirm(`Ya existe caja el ${fechaSeleccionada}. ¿Sobrescribir?`)) return;
                db.cierres[idx] = cierreData;
            } else {
                db.cierres.unshift(cierreData);
            }

            // Factura Z
            const zNum = `Z-${fechaSeleccionada.replace(/-/g,'')}`;
            const fIdx = db.facturas.findIndex(f => f.num === zNum);
            const fZ = {
                id: fIdx >= 0 ? db.facturas[fIdx].id : `z-${Date.now()}`,
                num: zNum, date: fechaSeleccionada, cliente: "Z DIARIO (Arume)",
                total: cierreData.totalVenta, base: Number((cierreData.totalVenta/1.10).toFixed(2)),
                tax: Number((cierreData.totalVenta - (cierreData.totalVenta/1.10)).toFixed(2)),
                paid: true, reconciled: false,
                notes: `Ef: ${cierreData.efectivo} | Tr: ${cierreData.tarjeta} | Apps: ${cierreData.apps}`
            };
            if(fIdx >= 0) db.facturas[fIdx] = fZ;
            else db.facturas.push(fZ);

            await saveFn(`Cierre del ${fechaSeleccionada} guardado ✅`);
            draw(); // Recargar todo para actualizar gráficos
        };
    };

    const pintarListaCierres = () => {
        // Filtrar SOLO los de este mes para la lista de abajo
        const filtrados = db.cierres
            .filter(c => c.date && c.date.startsWith(currentFilterDate))
            .sort((a,b) => new Date(b.date) - new Date(a.date));

        container.querySelector("#listaCierres").innerHTML = filtrados.map(c => `
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
        `).join('') || '<div class="col-span-full text-center py-10 text-slate-300 italic text-sm">No hay cierres en este mes.</div>';
    };

    window.borrarCierre = async (id) => {
        if(!confirm("¿Borrar cierre y Z?")) return;
        const c = db.cierres.find(x => x.id === id);
        if(c) {
            const zNum = `Z-${c.date.replace(/-/g,'')}`;
            db.facturas = db.facturas.filter(f => f.num !== zNum);
            db.cierres = db.cierres.filter(x => x.id !== id);
            await saveFn("Eliminado");
            draw();
        }
    };

    // Arrancar la primera vez
    draw();
}
