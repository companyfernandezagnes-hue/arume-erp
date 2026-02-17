/* =============================================================
   💰 MÓDULO: CAJAS (Versión Híbrida: Dashboard Mensual + Lista Completa)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. INICIALIZACIÓN
    if (!db.cierres) db.cierres = [];
    if (!db.facturas) db.facturas = [];
    if (!db.albaranes) db.albaranes = [];

    // --- 🛠️ TRADUCTOR UNIVERSAL (PARCHE DE COMPATIBILIDAD) ---
    // Esto arregla tus datos de Enero automáticamente al cargar
    db.cierres.forEach(c => {
        // 1. Recuperar Totales Antiguos (Mapeo de nombres viejos a nuevos)
        // Antes se llamaba 'total', ahora 'totalVenta'
        if (c.totalVenta === undefined && c.total !== undefined) c.totalVenta = c.total;
        
        // Antes se llamaba 'totalCaja', ahora 'efectivo'
        if (c.efectivo === undefined && c.totalCaja !== undefined) c.efectivo = c.totalCaja;
        
        // Antes se llamaba 'totalTarjeta', ahora 'tarjeta'
        if (c.tarjeta === undefined && c.totalTarjeta !== undefined) c.tarjeta = c.totalTarjeta;

        // 2. Arreglar Fechas (Si están en formato DD/MM/YYYY pasarlas a YYYY-MM-DD)
        if (c.date && c.date.includes('/')) {
            const parts = c.date.split('/'); // Ej: 25/01/2026
            if (parts.length === 3) {
                // Convertir a 2026-01-25 para que el ordenador lo entienda
                let y = parts[2];
                if (y.length === 2) y = '20' + y;
                c.date = `${y}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
        }
    });
    // (Los datos arreglados se guardarán la próxima vez que pulses un botón de guardar)

    // Estado del filtro para el Dashboard (Por defecto: Mes Actual)
    let currentFilterDate = new Date().toISOString().slice(0, 7); 

    // --- HELPERS ---
    const toCents = (n) => Math.round((Number(n) || 0) * 100);
    const localISODate = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // --- CÁLCULO DE KPIS (SOLO PARA LAS TARJETAS DE ARRIBA) ---
    const getKpis = () => {
        // Aquí SÍ filtramos por mes para que los números de arriba tengan sentido
        const cierresMes = db.cierres.filter(c => c.date && c.date.startsWith(currentFilterDate));
        
        const total = cierresMes.reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0);
        const dias = cierresMes.length;
        const media = dias > 0 ? total / dias : 0;
        
        const efec = cierresMes.reduce((acc, c) => acc + (parseFloat(c.efectivo) || 0), 0);
        const tarj = cierresMes.reduce((acc, c) => acc + (parseFloat(c.tarjeta) || 0), 0);
        const apps = cierresMes.reduce((acc, c) => acc + (parseFloat(c.apps) || 0), 0);

        return { total, media, dias, efec, tarj, apps };
    };

    // --- INTERFAZ ---
    const draw = () => {
        const kpis = getKpis();
        const [year, month] = currentFilterDate.split('-');
        const nombreMes = new Date(year, month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
                <div>
                    <h2 class="text-xl font-black text-slate-800 tracking-tight">Control de Caja</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Estadísticas Mensuales</p>
                </div>
                
                <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button id="btnPrevMonth" class="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-600 shadow-sm hover:bg-indigo-50 transition font-bold text-lg">‹</button>
                    <input id="monthPicker" type="month" value="${currentFilterDate}" class="bg-transparent border-0 text-sm font-black text-slate-700 uppercase outline-none text-center w-36 cursor-pointer">
                    <button id="btnNextMonth" class="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-600 shadow-sm hover:bg-indigo-50 transition font-bold text-lg">›</button>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación ${nombreMes}</p>
                    <p class="text-4xl font-black mt-2">${kpis.total.toLocaleString('es-ES', {minimumFractionDigits: 0})}€</p>
                    <p class="text-[10px] text-emerald-400 mt-1 font-bold">Media diaria: ${kpis.media.toFixed(0)}€</p>
                </div>

                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                        <span>💳 Tarjeta</span> <span>${kpis.tarj.toLocaleString()}€</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div class="h-full bg-indigo-500" style="width: ${(kpis.total > 0 ? (kpis.tarj/kpis.total)*100 : 0)}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                        <span>💵 Efectivo</span> <span>${kpis.efec.toLocaleString()}€</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-500" style="width: ${(kpis.total > 0 ? (kpis.efec/kpis.total)*100 : 0)}%"></div>
                    </div>
                </div>

                <div class="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 shadow-sm">
                    <p class="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Delivery</p>
                    <p class="text-3xl font-black text-orange-600 mt-2">${kpis.apps.toLocaleString()}€</p>
                </div>
            </div>

            <div class="space-y-4 mt-4">
                <div class="flex justify-between items-center px-6">
                    <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Historial Completo</h3>
                    <div class="relative">
                        <span class="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                        <input id="searchHistorial" type="text" placeholder="Buscar fecha..." class="pl-8 pr-4 py-2 bg-white border border-slate-100 rounded-full text-[10px] font-bold outline-none shadow-sm w-48">
                    </div>
                </div>
                <div id="listaCierres" class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10"></div>
            </div>

            <div class="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden mt-8">
                <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-emerald-400"></div>
                <h3 class="text-xl font-black text-slate-800 mb-6">Nuevo Cierre</h3>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div class="space-y-4">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Fecha y Caja</h4>
                        <input id="inFechaCierre" type="date" value="${localISODate()}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none">
                        <input id="inVentaEfectivo" type="number" step="0.01" placeholder="Efectivo Z" class="w-full p-4 bg-slate-50 rounded-2xl text-lg font-black outline-none">
                    </div>
                    <div class="space-y-4">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Bancos y Apps</h4>
                        <input id="inVentaTarjeta" type="number" step="0.01" placeholder="Tarjeta TPV" class="w-full p-4 bg-slate-50 rounded-2xl text-lg font-black outline-none">
                        <div class="grid grid-cols-2 gap-2">
                            <input id="inGlovo" type="number" placeholder="Glovo" class="p-3 bg-orange-50/50 rounded-xl font-bold text-sm outline-none">
                            <input id="inUber" type="number" placeholder="Uber" class="p-3 bg-indigo-50/50 rounded-xl font-bold text-sm outline-none">
                            <input id="inMadisa" type="number" placeholder="Madisa" class="p-3 bg-rose-50/50 rounded-xl font-bold text-sm outline-none">
                            <input id="inDeliveroo" type="number" placeholder="Deliveroo" class="p-3 bg-teal-50/50 rounded-xl font-bold text-sm outline-none">
                        </div>
                    </div>
                    <div class="space-y-4">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Arqueo y Notas</h4>
                        <input id="inCajaFisica" type="number" placeholder="Dinero Real Caja" class="w-full p-4 bg-slate-900 rounded-2xl text-2xl font-black text-emerald-400 outline-none">
                        <input id="inNotas" type="text" placeholder="Notas..." class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none">
                        <div class="text-right">
                            <span id="txtTotalCierre" class="text-3xl font-black text-indigo-600 tracking-tighter">0.00€</span>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-3 mt-6">
                    <div class="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100 mb-2">
                        <input type="checkbox" id="chkGastoCaja" class="w-5 h-5 accent-amber-500 cursor-pointer">
                        <label for="chkGastoCaja" class="text-[10px] font-black text-amber-700 uppercase cursor-pointer">¿Pagos con efectivo?</label>
                    </div>
                    <button id="btnGuardarCierre" class="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">
                        REGISTRAR CIERRE Z
                    </button>
                </div>
            </div>
        </div>
        `;

        setupEvents();
        pintarListaCierres(); // Pintar la lista SIN filtrar por mes
    };

    // --- LOGICA DE EVENTOS ---
    const setupEvents = () => {
        // Selector de Mes (Solo refresca el dashboard de arriba)
        container.querySelector("#monthPicker").onchange = (e) => {
            currentFilterDate = e.target.value;
            draw();
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

        // Inputs del Formulario
        const flds = {
            vEf: container.querySelector("#inVentaEfectivo"),
            vTr: container.querySelector("#inVentaTarjeta"),
            gl: container.querySelector("#inGlovo"),
            de: container.querySelector("#inDeliveroo"),
            ub: container.querySelector("#inUber"),
            ma: container.querySelector("#inMadisa"),
            fis: container.querySelector("#inCajaFisica"),
            not: container.querySelector("#inNotas"),
            chk: container.querySelector("#chkGastoCaja")
        };
        const txtTotal = container.querySelector("#txtTotalCierre");

        const refreshCalc = () => {
            const ventaEf = toCents(flds.vEf.value);
            const ventaTr = toCents(flds.vTr.value);
            const apps = toCents(flds.gl.value) + toCents(flds.de.value) + toCents(flds.ub.value) + toCents(flds.ma.value);
            const total = ventaEf + ventaTr + apps;
            txtTotal.innerText = (total / 100).toFixed(2) + "€";
            return total;
        };

        Object.values(flds).forEach(f => { if(f && f.type === 'number') f.addEventListener("input", refreshCalc); });

        // Guardar
        container.querySelector("#btnGuardarCierre").onclick = async () => {
            const totalCents = refreshCalc();
            if(totalCents <= 0) return alert("Introduce algún importe.");

            const fechaSeleccionada = container.querySelector("#inFechaCierre").value;
            
            if(flds.chk.checked) {
                const concepto = prompt("¿Qué has pagado? (ej: Hielo):");
                const importe = prompt("¿Cuánto has pagado (€)?:");
                if(concepto && importe) {
                    db.albaranes.push({
                        id: 'cash-'+Date.now(), date: fechaSeleccionada, prov: concepto, num: "CAJA",
                        total: parseFloat(importe), base: parseFloat(importe), taxes: 0,
                        paid: true, status: 'ok', notes: "Pagado con efectivo de caja"
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
                descuadre: (toCents(flds.fis.value) - (toCents(flds.vEf.value) + 30000)) / 100, // Suponiendo fondo 300
                notas: flds.not.value
            };

            const idx = db.cierres.findIndex(c => c.date === fechaSeleccionada);
            if(idx >= 0) db.cierres[idx] = cierreData;
            else db.cierres.unshift(cierreData);

            // Generar Z
            const zNum = `Z-${fechaSeleccionada.replace(/-/g,'')}`;
            const fIdx = db.facturas.findIndex(f => f.num === zNum);
            const fZ = {
                id: fIdx >= 0 ? db.facturas[fIdx].id : `z-${Date.now()}`,
                num: zNum, date: fechaSeleccionada, cliente: "Z DIARIO",
                total: cierreData.totalVenta, base: Number((cierreData.totalVenta/1.10).toFixed(2)),
                tax: Number((cierreData.totalVenta - (cierreData.totalVenta/1.10)).toFixed(2)),
                paid: true, reconciled: false
            };
            if(fIdx >= 0) db.facturas[fIdx] = fZ;
            else db.facturas.push(fZ);

            await saveFn(`Cierre ${fechaSeleccionada} guardado ✅`);
            draw();
        };
    };

    const pintarListaCierres = () => {
        // AQUÍ ESTÁ EL TRUCO: NO FILTRAMOS POR FECHA, MOSTRAMOS TODO (limitado a 50)
        // Solo filtramos si el usuario escribe en el buscador
        const term = (container.querySelector("#searchHistorial")?.value || "").toLowerCase();
        
        const filtrados = db.cierres
            .filter(c => !term || c.date.includes(term) || (c.notas && c.notas.toLowerCase().includes(term)))
            .sort((a,b) => new Date(b.date) - new Date(a.date));

        container.querySelector("#listaCierres").innerHTML = filtrados.slice(0, 50).map(c => `
            <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center group relative hover:shadow-md transition">
                <div>
                    <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg w-fit mb-2">${c.date}</p>
                    <div class="flex flex-wrap gap-2 text-xs text-slate-500 font-bold">
                        <span>💵 ${parseFloat(c.efectivo||0).toFixed(2)}</span>
                        <span>💳 ${parseFloat(c.tarjeta||0).toFixed(2)}</span>
                    </div>
                    ${c.notas ? `<p class="text-[9px] text-slate-400 italic mt-1 border-l-2 border-slate-200 pl-2">"${c.notas}"</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="text-xl font-black text-slate-800">${parseFloat(c.totalVenta).toFixed(2)}€</p>
                    <button onclick="window.borrarCierre('${c.id}')" class="text-[8px] text-rose-300 font-bold uppercase hover:text-rose-500 opacity-0 group-hover:opacity-100 transition mt-1">Borrar</button>
                </div>
            </div>
        `).join('') || '<div class="col-span-full text-center py-10 text-slate-300 italic text-sm">No hay registros.</div>';
    };

    window.borrarCierre = async (id) => {
        if(!confirm("¿Borrar cierre?")) return;
        const c = db.cierres.find(x => x.id === id);
        if(c) {
            const zNum = `Z-${c.date.replace(/-/g,'')}`;
            db.facturas = db.facturas.filter(f => f.num !== zNum);
            db.cierres = db.cierres.filter(x => x.id !== id);
            await saveFn("Cierre eliminado");
            draw();
        }
    };

    const searchInput = container.querySelector("#searchHistorial");
    if(searchInput) searchInput.oninput = pintarListaCierres;

    draw();
}
