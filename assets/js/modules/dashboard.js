/* =============================================================
   📊 DASHBOARD v8.0 (Blindado + Lógica Real + UI Premium)
   ============================================================= */

const CONF = {
    META_VENTAS: 40000      
};

// --- HELPERS INTERNOS (Para que no falle si app.js tarda en cargar) ---
const U = {
    parseNum: (val) => {
        if (window.Num && window.Num.parse) return window.Num.parse(val);
        // Fallback de emergencia
        if (val == null || val === '') return 0;
        if (typeof val === 'number') return val;
        let s = String(val).replace(/[^\d,.-]/g, ''); 
        if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
        else if (s.includes(',')) s = s.replace(',', '.');
        return parseFloat(s) || 0;
    },
    parseDate: (val) => {
        if (window.DateUtil && window.DateUtil.parse) return window.DateUtil.parse(val);
        // Fallback de emergencia
        if (!val) return new Date();
        if (val instanceof Date) return val;
        return new Date(val); // ISO básica
    },
    fmt: (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val || 0)
};

export async function render(container, supabase, db, opts = {}) {
    
    // --- 1. CARGA SEGURA DE LIBRERÍAS (Chart.js) ---
    const ensureChartJS = async () => {
        if (window.Chart) return true;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('Error cargando gráficas'));
            document.head.appendChild(script);
        });
    };
    try { await ensureChartJS(); } catch(e) { console.error(e); }

    // --- 2. CALCULADORA MAESTRA ---
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();
    const diasDelMes = new Date(yearActual, mesActual + 1, 0).getDate();
    const diaHoy = hoy.getDate();

    // A. INGRESOS REALES (Caja Z + Facturas Extra)
    const ventasCierres = (db.diario || [])
        .filter(c => {
            const d = U.parseDate(c.date || c.fecha);
            return d.getMonth() === mesActual && d.getFullYear() === yearActual;
        })
        .reduce((acc, c) => acc + U.parseNum(c.totalCaja) + U.parseNum(c.totalTarjeta), 0);

    const ventasFacturas = (db.facturas || [])
        .filter(f => {
            const d = U.parseDate(f.date || f.fecha);
            return d.getMonth() === mesActual && 
                   d.getFullYear() === yearActual && 
                   !String(f.num || '').toUpperCase().startsWith('Z');
        })
        .reduce((acc, f) => acc + U.parseNum(f.total), 0);

    const ventasMes = ventasCierres + ventasFacturas;

    // B. GASTOS VARIABLES (Albaranes) con Desglose
    let gastosComida = 0, gastosBebida = 0, gastosOtros = 0;
    const albaranesMes = (db.albaranes || [])
        .filter(a => {
            const d = U.parseDate(a.date || a.fecha);
            return d.getMonth() === mesActual && d.getFullYear() === yearActual;
        });

    const gastosMes = albaranesMes.reduce((acc, a) => {
        const total = U.parseNum(a.total);
        const p = (a.prov || '').toLowerCase();
        // Lógica heurística para categorizar por proveedor
        if (p.match(/fruta|carne|pesca|makro|mercadona|pan|huevo|verdu|aliment|chef/)) gastosComida += total;
        else if (p.match(/estrella|mahou|coca|vino|bebida|licor|bodega|drinks|cerveza|agua/)) gastosBebida += total;
        else gastosOtros += total;
        return acc + total;
    }, 0);

    // C. GASTOS FIJOS (Estructura)
    const fijosMes = (db.gastos_fijos || []).filter(g => g.active !== false).reduce((acc, g) => {
        let val = U.parseNum(g.amount);
        if (g.freq === 'anual') val /= 12; 
        else if (g.freq === 'trimestral') val /= 3;
        else if (g.freq === 'bimensual') val /= 2;
        return acc + val;
    }, 0);

    // D. AMORTIZACIONES
    const amortizaciones = window.calcularAmortizacionMensual ? 
                           window.calcularAmortizacionMensual(db.activos) : 0;

    // E. RESULTADO NETO
    const totalGastos = gastosMes + fijosMes + amortizaciones;
    const beneficio = ventasMes - totalGastos;
    const margen = ventasMes > 0 ? (beneficio / ventasMes) * 100 : 0;

    // F. PROYECCIÓN (Forecast)
    let pesoTotalMes = 0, pesoLlevado = 0;
    for (let i = 1; i <= diasDelMes; i++) {
        const f = new Date(yearActual, mesActual, i);
        // Damos más peso a Viernes(5), Sábado(6) y Domingo(0)
        const peso = ([0, 5, 6].includes(f.getDay())) ? 1.4 : 1.0;
        pesoTotalMes += peso;
        if (i <= diaHoy) pesoLlevado += peso;
    }
    const forecastVentas = pesoLlevado > 0 ? (ventasMes / pesoLlevado) * pesoTotalMes : ventasMes;

    // G. DETECCIÓN DE INFLACIÓN (Comparar últimos precios)
    const subidas = [];
    if (db.priceHistory) {
        Object.keys(db.priceHistory).forEach(prod => {
            const hist = db.priceHistory[prod];
            if (hist && hist.length >= 2) {
                const last = hist[hist.length - 1];
                const prev = hist[hist.length - 2];
                // Si subió más de un 5% este mes
                const dLast = U.parseDate(last.date);
                if (dLast.getMonth() === mesActual && last.unit > (prev.unit * 1.05)) {
                    subidas.push({ prod, diff: ((last.unit - prev.unit) / prev.unit * 100).toFixed(1), old: prev.unit, new: last.unit });
                }
            }
        });
    }

    // --- 3. GRÁFICA SEMESTRAL (Datos Históricos) ---
    const labels = [], dataV = [], dataG = [], dataB = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(yearActual, mesActual - i, 1);
        const m = d.getMonth(), y = d.getFullYear();
        
        // Ventas Z + Facturas del mes 'm'
        const vZ = (db.diario||[]).filter(c => {const f=U.parseDate(c.date); return f.getMonth()===m && f.getFullYear()===y})
                   .reduce((a,c)=>a+U.parseNum(c.totalCaja)+U.parseNum(c.totalTarjeta),0);
        const vF = (db.facturas||[]).filter(f => {const dx=U.parseDate(f.date); return dx.getMonth()===m && dx.getFullYear()===y && !String(f.num).startsWith('Z')})
                   .reduce((a,f)=>a+U.parseNum(f.total),0);
        
        const gVar = (db.albaranes||[]).filter(a => {const f=U.parseDate(a.date); return f.getMonth()===m && f.getFullYear()===y})
                     .reduce((a,x)=>a+U.parseNum(x.total),0);

        labels.push(d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase());
        dataV.push(vZ + vF); 
        dataG.push(gVar); // Solo variable para gráfica limpia
        dataB.push((vZ+vF) - gVar); // Margen Bruto
    }

    const pctSafe = (v) => Math.min(100, Math.max(0, v || 0));

    // --- 4. RENDERIZADO VISUAL ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <div class="flex justify-between items-end px-2">
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">${hoy.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'})}</p>
                <h2 class="text-3xl font-black text-slate-800">Panel de Control</h2>
            </div>
            <div class="text-right cursor-pointer" onclick="document.getElementById('modalInflacion').classList.remove('hidden')">
                ${subidas.length > 0 ? `<div class="bg-rose-50 px-4 py-2 rounded-full border border-rose-100 animate-pulse text-rose-600 text-[10px] font-black uppercase">📈 ${subidas.length} Subidas</div>` : `<div class="bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase">🛡️ Precios OK</div>`}
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden md:col-span-2 group">
                <div class="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-[60px] opacity-30"></div>
                <div class="flex justify-between items-start relative z-10">
                    <div class="space-y-1">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Real (Z + Fra)</p>
                        <h3 class="text-5xl font-black tracking-tight">${U.fmt(ventasMes)}</h3>
                        <div class="flex items-center gap-2 mt-2 bg-white/10 px-3 py-1.5 rounded-lg w-fit backdrop-blur-md border border-white/10">
                            <span class="text-lg">🔮</span>
                            <p class="text-xs font-black text-white leading-none">Proyección ~${U.fmt(forecastVentas)}</p>
                        </div>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="flex justify-between text-[9px] font-bold text-slate-400 mb-1"><span>Objetivo (${U.fmt(CONF.META_VENTAS)})</span><span>${pctSafe(ventasMes/CONF.META_VENTAS*100).toFixed(0)}%</span></div>
                    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-indigo-400" style="width: ${pctSafe(ventasMes/CONF.META_VENTAS*100)}%"></div></div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase">Beneficio Neto</p>
                    <h3 class="text-3xl font-black ${beneficio >= 0 ? 'text-slate-800' : 'text-rose-500'}">${U.fmt(beneficio)}</h3>
                </div>
                <div class="mt-4 space-y-1 text-[10px] text-slate-400">
                    <div class="flex justify-between"><span>Gastos Var.</span><span class="font-bold text-rose-400">-${U.fmt(gastosMes)}</span></div>
                    <div class="flex justify-between"><span>Estructura</span><span class="font-bold text-amber-400">-${U.fmt(fijosMes + amortizaciones)}</span></div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Costes %</p>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1"><span>🥘 Comida</span><span>${(ventasMes>0?(gastosComida/ventasMes*100).toFixed(1):0)}%</span></div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-orange-400" style="width: ${pctSafe(gastosComida/ventasMes*100)}%"></div></div>
                    </div>
                    <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1"><span>🔧 Otros</span><span>${(ventasMes>0?(gastosOtros/ventasMes*100).toFixed(1):0)}%</span></div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-slate-400" style="width: ${pctSafe(gastosOtros/ventasMes*100)}%"></div></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 class="font-black text-slate-800 mb-4">Margen Bruto (Últimos 6 meses)</h3>
                <div class="h-64 w-full relative"><canvas id="chartSemestral"></canvas></div>
            </div>
            
            <div class="space-y-3">
                <div class="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-lg text-center cursor-pointer hover:bg-indigo-700 transition transform hover:scale-[1.02]" onclick="loadModule('diario')">
                    <span class="text-3xl">📠</span><p class="font-black text-sm uppercase mt-2">Cerrar Caja Z</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="loadModule('albaranes')" class="p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 transition flex flex-col items-center gap-2 font-black text-[10px] uppercase"><span>📸</span> Gasto</button>
                    <button onclick="loadModule('tesoreria')" class="p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 transition flex flex-col items-center gap-2 font-black text-[10px] uppercase"><span>⚖️</span> Deuda</button>
                </div>
            </div>
        </div>
    </div>

    <div id="modalInflacion" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
        <div class="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl relative animate-slide-up">
            <button onclick="document.getElementById('modalInflacion').classList.add('hidden')" class="absolute top-4 right-4 text-2xl text-slate-300 hover:text-slate-600">✕</button>
            <h3 class="text-xl font-black text-rose-500 mb-1">🔥 Alerta Inflación</h3>
            <div class="space-y-3 mt-4 max-h-[60vh] overflow-y-auto">
                ${subidas.map(s => `<div class="bg-rose-50 p-3 rounded-xl border border-rose-100 flex justify-between items-center"><div><p class="text-xs font-black text-slate-700 uppercase">${s.prod}</p><p class="text-[10px] text-slate-400">Antes: ${s.old.toFixed(2)}€ ➔ Ahora: ${s.new.toFixed(2)}€</p></div><span class="text-xs font-black text-rose-600">+${s.diff}%</span></div>`).join('') || '<p class="text-center text-slate-400 text-xs py-4">Todo estable. No hay subidas alarmantes.</p>'}
            </div>
        </div>
    </div>
    `;

    // --- 5. INICIALIZAR GRÁFICA CHART.JS ---
    setTimeout(() => {
        const chartEl = document.getElementById('chartSemestral');
        if (!chartEl) return;
        new Chart(chartEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Margen Bruto', data: dataB, type: 'line', borderColor: '#10b981', borderWidth: 3, tension: 0.4, order: 1, fill: false, pointRadius: 3 },
                    { label: 'Ventas', data: dataV, backgroundColor: '#6366f1', borderRadius: 6, order: 2, barPercentage: 0.6 },
                    { label: 'Gastos Var.', data: dataG, backgroundColor: '#fb7185', borderRadius: 6, order: 3, barPercentage: 0.6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v) => v >= 1000 ? (v/1000) + 'k€' : v + '€' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }, 200);
}
