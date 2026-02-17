/* =============================================================
   📊 MÓDULO: DASHBOARD v5.5 (Arume Master Edition - Corregido)
   ============================================================= */

const CONF = {
    PERSONAL_ESTIMADO: 18000, 
    COMISION_TPV: 0.015,      
    META_VENTAS: 40000        
};

export async function render(container, supabase, db, opts = {}) {
    
    // --- 1. CARGA SEGURA DE LIBRERÍAS ---
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

    // --- 2. HELPERS ---
    const parseFechaSafe = (d) => {
        if (!d) return null;
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date((d - 25569) * 86400 * 1000);
        if (typeof d === 'string') {
            const s = d.trim();
            if (s.includes('/')) {
                const parts = s.split('/');
                if (parts.length === 3) {
                    const y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                    return new Date(`${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                }
            }
            const t = new Date(s);
            return isNaN(t) ? null : t;
        }
        return null;
    };

    const esMes = (d, m, y) => {
        const fecha = parseFechaSafe(d);
        return fecha && fecha.getMonth() === m && fecha.getFullYear() === y;
    };

    const fmt = (n) => {
        const val = parseFloat(n) || 0;
        return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    };

    const pctSafe = (val) => {
        if (!Number.isFinite(val) || isNaN(val)) return 0;
        return Math.min(100, Math.max(0, val));
    };

    // --- 3. CALCULADORA ---
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();
    const diasDelMes = new Date(yearActual, mesActual + 1, 0).getDate();
    const diaHoy = hoy.getDate();

    const ventasCierres = (db.cierres || []).filter(c => c && c.date && esMes(c.date, mesActual, yearActual)).reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0);
    const ventasFacturas = (db.facturas || []).filter(f => f && f.date && esMes(f.date, mesActual, yearActual) && !String(f.num || '').startsWith('Z-')).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
    const ventasMes = ventasCierres + ventasFacturas;

    let gastosComida = 0, gastosBebida = 0, gastosOtros = 0;
    const albaranesMes = (db.albaranes || []).filter(a => a && a.date && esMes(a.date, mesActual, yearActual));
    const gastosMes = albaranesMes.reduce((acc, a) => {
        const total = parseFloat(a.total) || 0;
        const p = (a.prov || '').toLowerCase();
        if (p.match(/fruta|carne|pesca|makro|mercadona|pan|huevo|verdu|aliment/)) gastosComida += total;
        else if (p.match(/estrella|mahou|coca|vino|bebida|licor|bodega|drinks|cerveza/)) gastosBebida += total;
        else gastosOtros += total;
        return acc + total;
    }, 0);

    const fijosMes = (db.gastos_fijos || []).reduce((acc, g) => {
        let val = parseFloat(g.amount) || 0;
        if (g.freq === 'anual') val /= 12; else if (g.freq === 'trimestral') val /= 3;
        return acc + val;
    }, 0);

    const costePersonal = (db.config?.personalMensual || CONF.PERSONAL_ESTIMADO);
    const costeTPV = ventasCierres * CONF.COMISION_TPV;
    const beneficio = ventasMes - (gastosMes + fijosMes + costePersonal + costeTPV);

    let pesoTotalMes = 0, pesoLlevado = 0;
    for (let i = 1; i <= diasDelMes; i++) {
        const f = new Date(yearActual, mesActual, i);
        const peso = ([0, 5, 6].includes(f.getDay())) ? 1.4 : 1.0;
        pesoTotalMes += peso;
        if (i <= diaHoy) pesoLlevado += peso;
    }
    const forecastVentas = pesoLlevado > 0 ? (ventasMes / pesoLlevado) * pesoTotalMes : ventasMes;

    const subidas = [];
    if (db.priceHistory) {
        Object.keys(db.priceHistory).forEach(prod => {
            const hist = db.priceHistory[prod];
            if (hist && hist.length >= 2) {
                const last = hist[hist.length - 1];
                const prev = hist[hist.length - 2];
                if (last.date && esMes(last.date, mesActual, yearActual) && last.unit > (prev.unit * 1.05)) {
                    subidas.push({ prod, diff: ((last.unit - prev.unit) / prev.unit * 100).toFixed(1), old: prev.unit, new: last.unit });
                }
            }
        });
    }

    // --- 4. GRÁFICA SEMESTRAL ---
    const labels = [], dataV = [], dataG = [], dataB = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(yearActual, mesActual - i, 1);
        const m = d.getMonth(), y = d.getFullYear();
        const v = (db.cierres || []).filter(c => c && c.date && esMes(c.date, m, y)).reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0) + (db.facturas || []).filter(f => f && f.date && esMes(f.date, m, y) && !String(f.num || '').startsWith('Z-')).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
        const g = (db.albaranes || []).filter(a => a && a.date && esMes(a.date, m, y)).reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);
        labels.push(d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase());
        dataV.push(v); dataG.push(g); dataB.push(v - g - fijosMes - costePersonal);
    }

    // --- 5. RENDERIZADO (DISEÑO VISUAL) ---
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
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Real</p>
                        <h3 class="text-5xl font-black tracking-tight">${fmt(ventasMes)}</h3>
                        <div class="flex items-center gap-2 mt-2 bg-white/10 px-3 py-1.5 rounded-lg w-fit backdrop-blur-md border border-white/10">
                            <span class="text-lg">🔮</span>
                            <p class="text-xs font-black text-white leading-none">Proyección ~${fmt(forecastVentas)}</p>
                        </div>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="flex justify-between text-[9px] font-bold text-slate-400 mb-1"><span>Objetivo</span><span>${pctSafe(ventasMes/CONF.META_VENTAS*100).toFixed(0)}%</span></div>
                    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-indigo-400" style="width: ${pctSafe(ventasMes/CONF.META_VENTAS*100)}%"></div></div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div><p class="text-[10px] font-black text-slate-400 uppercase">Beneficio Est.</p><h3 class="text-3xl font-black ${beneficio >= 0 ? 'text-slate-800' : 'text-rose-500'}">${fmt(beneficio)}</h3></div>
                <div class="mt-4 space-y-1 text-[10px] text-slate-400">
                    <div class="flex justify-between"><span>Gastos</span><span class="font-bold text-rose-400">-${fmt(gastosMes)}</span></div>
                    <div class="flex justify-between"><span>Estructura</span><span class="font-bold text-amber-400">-${fmt(fijosMes+costePersonal)}</span></div>
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
                        <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1"><span>🍷 Bebida</span><span>${(ventasMes>0?(gastosBebida/ventasMes*100).toFixed(1):0)}%</span></div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-purple-400" style="width: ${pctSafe(gastosBebida/ventasMes*100)}%"></div></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 class="font-black text-slate-800 mb-4">Evolución Semestral</h3>
                <div class="h-64 w-full relative"><canvas id="chartSemestral"></canvas></div>
            </div>
            <div class="space-y-3">
                <div class="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-lg text-center cursor-pointer hover:bg-indigo-700 transition" onclick="loadModule('cajas')">
                    <span class="text-3xl">📠</span><p class="font-black text-sm uppercase mt-2">Cerrar Caja</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="loadModule('albaranes')" class="p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 transition flex flex-col items-center gap-2 font-black text-[10px] uppercase"><span>📸</span> Gasto</button>
                    <button onclick="loadModule('tesoreria')" class="p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 transition flex flex-col items-center gap-2 font-black text-[10px] uppercase"><span>🏦</span> Banco</button>
                </div>
            </div>
        </div>
    </div>

    <div id="modalInflacion" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
        <div class="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl relative">
            <button onclick="document.getElementById('modalInflacion').classList.add('hidden')" class="absolute top-4 right-4 text-2xl text-slate-300 hover:text-slate-600">✕</button>
            <h3 class="text-xl font-black text-rose-500 mb-1">🔥 Alerta Inflación</h3>
            <div class="space-y-3 mt-4 max-h-[60vh] overflow-y-auto">
                ${subidas.map(s => `<div class="bg-rose-50 p-3 rounded-xl border border-rose-100 flex justify-between items-center"><div><p class="text-xs font-black text-slate-700 uppercase">${s.prod}</p><p class="text-[10px] text-slate-400">Antes: ${s.old.toFixed(2)}€ ➔ Ahora: ${s.new.toFixed(2)}€</p></div><span class="text-xs font-black text-rose-600">+${s.diff}%</span></div>`).join('') || '<p class="text-center text-slate-400 text-xs py-4">Todo estable.</p>'}
            </div>
        </div>
    </div>
    `;

    // --- 6. INICIALIZAR GRÁFICA ---
    setTimeout(() => {
        const chartEl = document.getElementById('chartSemestral');
        if (!chartEl) return;
        new Chart(chartEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Beneficio', data: dataB, type: 'line', borderColor: '#10b981', borderWidth: 3, tension: 0.4, order: 1, fill: false, pointRadius: 3 },
                    { label: 'Ventas', data: dataV, backgroundColor: '#6366f1', borderRadius: 6, order: 2, barPercentage: 0.6 },
                    { label: 'Gastos', data: dataG, backgroundColor: '#fb7185', borderRadius: 6, order: 3, barPercentage: 0.6 }
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
