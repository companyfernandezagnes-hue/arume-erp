/* =============================================================
   📊 DASHBOARD MASTER v11.0 (Definitivo: Lógica v8 + Motor v3)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    
    // --- 1. CARGA SEGURA DE LIBRERÍAS ---
    const ensureChartJS = async () => {
        if (window.Chart) return true;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => resolve(true);
            document.head.appendChild(script);
        });
    };
    try { await ensureChartJS(); } catch(e) {}

    // --- 2. DATOS MAESTROS (CEREBRO + CONFIG) ---
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();
    const meta = db.config.objetivoMensual || 40000;

    // A. Pedimos los datos reales al motor central (ArumeEngine v3.0)
    // Esto asegura que la "Caja Z" y los "Albaranes" estén sumados igual que en el cierre
    const kpis = window.ArumeEngine.getProfit(mesActual, yearActual);

    // B. Forecast Ponderado (Lógica rescatada de tu v8.0)
    const diasDelMes = new Date(yearActual, mesActual + 1, 0).getDate();
    const diaHoy = hoy.getDate();
    let pesoTotal = 0, pesoLlevado = 0;
    
    for (let i = 1; i <= diasDelMes; i++) {
        const f = new Date(yearActual, mesActual, i);
        const day = f.getDay();
        // Viernes(5) y Sábado(6) valen x1.5, Domingo(0) x1.3, resto x1.0
        const peso = (day===5 || day===6) ? 1.5 : (day===0 ? 1.3 : 1.0);
        pesoTotal += peso;
        if (i <= diaHoy) pesoLlevado += peso;
    }
    // Proyección inteligente
    const forecast = pesoLlevado > 0.5 ? (kpis.ingresos.total / pesoLlevado) * pesoTotal : kpis.ingresos.total;

    // C. Detección de Inflación (Lógica rescatada de tu v8.0)
    const subidas = [];
    if (db.priceHistory) {
        Object.keys(db.priceHistory).forEach(prod => {
            const hist = db.priceHistory[prod];
            if (hist && hist.length >= 2) {
                const last = hist[hist.length - 1];
                const prev = hist[hist.length - 2];
                // Si la última compra fue este mes y subió > 5%
                if (new Date(last.date).getMonth() === mesActual && last.unit > (prev.unit * 1.05)) {
                    subidas.push({ 
                        prod, 
                        diff: ((last.unit - prev.unit) / prev.unit * 100).toFixed(1), 
                        old: prev.unit, 
                        new: last.unit 
                    });
                }
            }
        });
    }

    // Helpers UI
    const fmt = (v) => window.Num.fmt(v); // Usa el formateador global
    const pct = (v) => Math.min(100, Math.max(0, v || 0)).toFixed(0) + '%';
    const numPct = (v) => (v||0).toFixed(1) + '%';

    // --- 3. PREPARACIÓN DE GRÁFICAS HISTÓRICAS ---
    const labels = [], dataVentas = [], dataBeneficio = [];
    for (let i = 5; i >= 0; i--) {
        let m = mesActual - i;
        let y = yearActual;
        if (m < 0) { m += 12; y -= 1; }
        
        const historico = window.ArumeEngine.getProfit(m, y);
        const d = new Date(y, m, 1);
        
        labels.push(d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase());
        dataVentas.push(historico.ingresos.total);
        dataBeneficio.push(historico.neto);
    }

    // --- 4. RENDERIZADO (UI PREMIUM) ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-28"> <div class="flex justify-between items-end px-2">
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">${hoy.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'})}</p>
                <h2 class="text-3xl font-black text-slate-800">Panel de Mando</h2>
            </div>
            <div class="text-right cursor-pointer" onclick="document.getElementById('modalInflacion').classList.remove('hidden')">
                ${subidas.length > 0 
                    ? `<div class="bg-rose-50 px-3 py-2 rounded-xl border border-rose-100 animate-pulse flex items-center gap-2 shadow-sm">
                         <span class="text-lg">🔥</span>
                         <div class="text-left">
                            <p class="text-[9px] font-black text-rose-600 uppercase leading-none">Inflación</p>
                            <p class="text-[9px] font-bold text-rose-400 leading-none">${subidas.length} avisos</p>
                         </div>
                       </div>` 
                    : `<div class="bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                         <span class="text-lg">🛡️</span>
                         <div class="text-left">
                            <p class="text-[9px] font-black text-emerald-600 uppercase leading-none">Precios</p>
                            <p class="text-[9px] font-bold text-emerald-400 leading-none">Estables</p>
                         </div>
                       </div>`
                }
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 w-48 h-48 bg-indigo-600 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                
                <div class="relative z-10">
                    <p class="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Facturación Real</p>
                    <h3 class="text-4xl font-black tracking-tight mb-4">${fmt(kpis.ingresos.total)}</h3>
                    
                    <div class="flex items-center gap-3 mb-4">
                        <div class="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                            <p class="text-[9px] text-indigo-200 uppercase font-bold">Meta</p>
                            <p class="text-xs font-black">${fmt(meta)}</p>
                        </div>
                        <div class="bg-indigo-500/20 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-indigo-500/30">
                            <p class="text-[9px] text-indigo-200 uppercase font-bold">Prev.</p>
                            <p class="text-xs font-black text-white">${fmt(forecast)}</p>
                        </div>
                    </div>

                    <div>
                        <div class="flex justify-between text-[9px] font-bold text-indigo-300 mb-1">
                            <span>Progreso mensual</span>
                            <span>${pct(kpis.ingresos.total/meta*100)}</span>
                        </div>
                        <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-indigo-400 to-purple-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]" style="width: ${pct(kpis.ingresos.total/meta*100)}%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-[10px] font-black text-slate-400 uppercase">Beneficio Neto</p>
                        <span class="text-[10px] font-bold px-2 py-1 rounded-md ${kpis.neto>=0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                            ${kpis.neto>=0 ? '🟢 GANANCIA' : '🔴 PÉRDIDA'}
                        </span>
                    </div>
                    <h3 class="text-3xl font-black ${kpis.neto>=0 ? 'text-slate-800' : 'text-rose-500'}">${fmt(kpis.neto)}</h3>
                </div>
                
                <div class="space-y-3 mt-4">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-slate-500">Gastos Totales</span>
                        <span class="font-black text-rose-500">-${fmt(kpis.gastos.total)}</span>
                    </div>
                    <div class="w-full h-px bg-slate-100"></div>
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Prime Cost</p>
                            <p class="text-[9px] text-slate-400">(Comida+Bebida+Personal)</p>
                        </div>
                        <p class="text-lg font-black ${kpis.ratios.primeCost>65 ? 'text-rose-500' : 'text-emerald-500'}">${kpis.ratios.primeCost.toFixed(0)}%</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-4">Eficiencia de Costes</p>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-[10px] font-bold mb-1">
                            <span class="text-slate-600">🥘 Comida (Food Cost)</span>
                            <span class="${kpis.ratios.foodCost>32?'text-rose-500':'text-emerald-600'}">${numPct(kpis.ratios.foodCost)}</span>
                        </div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-orange-400" style="width: ${pct(kpis.ratios.foodCost)}%"></div>
                        </div>
                        <p class="text-[8px] text-slate-300 mt-0.5 text-right">Obj: 30%</p>
                    </div>
                    <div>
                        <div class="flex justify-between text-[10px] font-bold mb-1">
                            <span class="text-slate-600">🍷 Bebida (Pour Cost)</span>
                            <span class="${kpis.ratios.drinkCost>22?'text-rose-500':'text-emerald-600'}">${numPct(kpis.ratios.drinkCost)}</span>
                        </div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-purple-400" style="width: ${pct(kpis.ratios.drinkCost)}%"></div>
                        </div>
                        <p class="text-[8px] text-slate-300 mt-0.5 text-right">Obj: 20%</p>
                    </div>
                    <div>
                        <div class="flex justify-between text-[10px] font-bold mb-1">
                            <span class="text-slate-600">👨‍🍳 Personal</span>
                            <span class="${kpis.ratios.staffCost>35?'text-rose-500':'text-emerald-600'}">${numPct(kpis.ratios.staffCost)}</span>
                        </div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-blue-500" style="width: ${pct(kpis.ratios.staffCost)}%"></div>
                        </div>
                        <p class="text-[8px] text-slate-300 mt-0.5 text-right">Obj: 35%</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-black text-slate-800 text-sm">📈 Evolución (6 Meses)</h3>
                    <div class="flex gap-3 text-[9px] font-bold uppercase">
                        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> Ventas</div>
                        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Ganancia</div>
                    </div>
                </div>
                <div class="h-64 w-full relative">
                    <canvas id="chartTendencia"></canvas>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                <h3 class="font-black text-slate-800 mb-4 text-sm w-full text-left">🍰 Reparto del Gasto</h3>
                <div class="h-48 w-full relative flex items-center justify-center">
                    <canvas id="chartDonut"></canvas>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-[9px] font-bold text-slate-400 uppercase">Total</span>
                        <span class="text-lg font-black text-slate-800">${fmt(kpis.gastos.total)}</span>
                    </div>
                </div>
                <div class="flex flex-wrap justify-center gap-2 mt-4 text-[9px]">
                    <span class="px-2 py-1 bg-orange-50 text-orange-600 rounded font-bold">Comida</span>
                    <span class="px-2 py-1 bg-purple-50 text-purple-600 rounded font-bold">Bebida</span>
                    <span class="px-2 py-1 bg-blue-50 text-blue-600 rounded font-bold">Personal</span>
                    <span class="px-2 py-1 bg-slate-100 text-slate-600 rounded font-bold">Fijos</span>
                </div>
            </div>
        </div>

        <div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl text-white p-2 rounded-3xl shadow-2xl flex items-center gap-2 z-50 border border-slate-700/50 animate-slide-up ring-1 ring-white/10">
            
            <button onclick="loadModule('diario')" class="flex flex-col items-center justify-center w-16 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-2xl transition shadow-lg group relative">
                <span class="text-xl group-hover:-translate-y-0.5 transition-transform">📠</span>
                <span class="text-[8px] font-black uppercase mt-1">Caja Z</span>
            </button>
            
            <div class="w-px h-8 bg-slate-700 mx-1"></div>
            
            <button onclick="loadModule('albaranes')" class="flex flex-col items-center justify-center w-14 h-14 hover:bg-white/10 rounded-2xl transition group">
                <span class="text-lg group-hover:scale-110 transition">📸</span>
                <span class="text-[8px] font-bold uppercase mt-1 text-slate-300 group-hover:text-white">Gasto</span>
            </button>
            
            <button onclick="loadModule('facturas')" class="flex flex-col items-center justify-center w-14 h-14 hover:bg-white/10 rounded-2xl transition group">
                <span class="text-lg group-hover:scale-110 transition">🧾</span>
                <span class="text-[8px] font-bold uppercase mt-1 text-slate-300 group-hover:text-white">Venta</span>
            </button>
            
            <button onclick="loadModule('tesoreria')" class="flex flex-col items-center justify-center w-14 h-14 hover:bg-white/10 rounded-2xl transition group">
                <span class="text-lg group-hover:scale-110 transition">🏦</span>
                <span class="text-[8px] font-bold uppercase mt-1 text-slate-300 group-hover:text-white">Banco</span>
            </button>
        </div>

    </div>

    <div id="modalInflacion" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative animate-slide-up">
            <button onclick="document.getElementById('modalInflacion').classList.add('hidden')" class="absolute top-6 right-6 text-2xl text-slate-300 hover:text-slate-600">✕</button>
            
            <div class="text-center mb-6">
                <span class="text-4xl">🔥</span>
                <h3 class="text-xl font-black text-slate-800 mt-2">Radar de Precios</h3>
                <p class="text-xs text-slate-400">Productos que han subido >5% en la última compra</p>
            </div>

            <div class="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                ${subidas.map(s => `
                    <div class="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex justify-between items-center group hover:bg-rose-100 transition">
                        <div>
                            <p class="text-xs font-black text-slate-800 uppercase group-hover:text-rose-800">${s.prod}</p>
                            <div class="flex gap-2 text-[10px] text-slate-500 mt-1">
                                <span class="line-through decoration-rose-400">${Number(s.old).toFixed(2)}€</span>
                                <span class="text-slate-400">➔</span>
                                <span class="font-bold text-slate-800">${Number(s.new).toFixed(2)}€</span>
                            </div>
                        </div>
                        <span class="text-xs font-black text-white bg-rose-500 px-3 py-1.5 rounded-xl shadow-sm">+${s.diff}%</span>
                    </div>
                `).join('') || '<div class="text-center py-10 opacity-50"><p class="font-bold text-slate-400">Sin alertas activas.</p></div>'}
            </div>
        </div>
    </div>
    `;

    // --- 5. GRÁFICAS (Inicialización) ---
    setTimeout(() => {
        // Gráfica 1: TENDENCIA (Barras Ventas + Línea Beneficio)
        const ctx1 = document.getElementById('chartTendencia');
        if (ctx1) {
            new Chart(ctx1.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { 
                            label: 'Beneficio', 
                            data: dataBeneficio, 
                            type: 'line', 
                            borderColor: '#10b981', // Emerald 500
                            backgroundColor: '#10b981',
                            borderWidth: 3, 
                            tension: 0.4, 
                            pointRadius: 4,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#10b981',
                            pointHoverRadius: 6,
                            order: 1 // Capa superior
                        },
                        { 
                            label: 'Ventas', 
                            data: dataVentas, 
                            backgroundColor: '#6366f1', // Indigo 500
                            borderRadius: 6, 
                            barPercentage: 0.5,
                            order: 2 
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            grid: { color: '#f1f5f9', drawBorder: false },
                            ticks: { font: {size: 10}, color: '#94a3b8', callback: (v) => v >= 1000 ? (v/1000) + 'k' : v }
                        },
                        x: { 
                            grid: { display: false },
                            ticks: { font: {size: 10, weight:'bold'}, color: '#64748b' }
                        }
                    }
                }
            });
        }

        // Gráfica 2: DONUT (Estructura de Gastos)
        const ctx2 = document.getElementById('chartDonut');
        if (ctx2) {
            const isEmpty = kpis.gastos.total === 0;
            new Chart(ctx2.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Comida', 'Bebida', 'Personal', 'Estructura', 'Amort.'],
                    datasets: [{
                        data: isEmpty ? [1] : [kpis.gastos.comida, kpis.gastos.bebida, kpis.gastos.personal, kpis.gastos.estructura + kpis.gastos.otros, kpis.gastos.amortizacion],
                        backgroundColor: isEmpty ? ['#f1f5f9'] : ['#fb923c', '#c084fc', '#3b82f6', '#94a3b8', '#cbd5e1'], // Naranja, Morado, Azul, Gris, GrisClaro
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: { legend: { display: false }, tooltip: { enabled: !isEmpty } }
                }
            });
        }
    }, 150);
}
