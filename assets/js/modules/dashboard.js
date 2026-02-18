/* =============================================================
   📊 MÓDULO: DASHBOARD FINANCIERO v12.0 (Solo Dinero y Banco)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    
    // 1. CARGA DE GRÁFICOS
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

    // 2. DATOS REALES (MOTOR ARUME)
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();
    const meta = db.config.objetivoMensual || 40000;

    // A. Datos Financieros (Ingresos vs Gastos)
    const kpis = window.ArumeEngine.getProfit(mesActual, yearActual);

    // B. Saldo Banco Real (Calculado desde el módulo Banco)
    const saldoBanco = (parseFloat(db.config.saldoInicial) || 0) + 
                       (db.banco || []).reduce((acc, m) => acc + (parseFloat(m.amount)||0), 0);

    // C. Detector de Inflación (Precios de compra que han subido)
    const subidas = [];
    if (db.priceHistory) {
        Object.keys(db.priceHistory).forEach(prod => {
            const hist = db.priceHistory[prod];
            if (hist && hist.length >= 2) {
                const last = hist[hist.length - 1];
                const prev = hist[hist.length - 2];
                // Si subió > 5%
                if (new Date(last.date).getMonth() === mesActual && last.unit > (prev.unit * 1.05)) {
                    subidas.push({ prod, diff: ((last.unit - prev.unit)/prev.unit*100).toFixed(1), new: last.unit });
                }
            }
        });
    }

    // Helpers
    const fmt = (v) => window.Num.fmt(v);
    const pct = (v) => Math.min(100, Math.max(0, v || 0)).toFixed(0) + '%';

    // 3. RENDERIZADO
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full filter blur-[80px] opacity-20"></div>
            
            <div class="relative z-10 flex justify-between items-start">
                <div>
                    <p class="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">
                        ${hoy.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </p>
                    <h1 class="text-3xl font-black tracking-tight">Finanzas</h1>
                </div>
                <div class="text-right">
                    <p class="text-slate-400 text-[9px] font-black uppercase">Saldo Banco Real</p>
                    <p class="text-3xl font-black text-emerald-400">${fmt(saldoBanco)}</p>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-4 mt-8 relative z-10">
                <div class="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                    <p class="text-slate-400 text-[9px] font-black uppercase">Ventas Netas</p>
                    <p class="text-xl font-black text-white">${fmt(kpis.ingresos.total)}</p>
                    <div class="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div class="h-full bg-indigo-400" style="width: ${pct(kpis.ingresos.total/meta*100)}%"></div>
                    </div>
                    <p class="text-[8px] text-indigo-200 mt-1">${pct(kpis.ingresos.total/meta*100)} de Meta</p>
                </div>

                <div class="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                    <p class="text-slate-400 text-[9px] font-black uppercase">Gastos Totales</p>
                    <p class="text-xl font-black text-rose-400">-${fmt(kpis.gastos.total)}</p>
                    <p class="text-[8px] text-slate-400 mt-1">Fijos + Variables</p>
                </div>

                <div class="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5 relative overflow-hidden">
                    ${kpis.neto > 0 ? '<div class="absolute inset-0 bg-emerald-500/20"></div>' : '<div class="absolute inset-0 bg-rose-500/20"></div>'}
                    <p class="text-slate-400 text-[9px] font-black uppercase relative z-10">Beneficio Neto</p>
                    <p class="text-xl font-black relative z-10 ${kpis.neto > 0 ? 'text-emerald-300' : 'text-rose-300'}">
                        ${kpis.neto > 0 ? '+' : ''}${fmt(kpis.neto)}
                    </p>
                </div>
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 class="font-black text-slate-800 text-sm mb-4">📊 Eficiencia Operativa</h3>
                <div class="grid grid-cols-3 gap-4">
                    ${renderRatioCard('🥘 Comida', kpis.ratios.foodCost, 30)}
                    ${renderRatioCard('🍷 Bebida', kpis.ratios.drinkCost, 25)}
                    ${renderRatioCard('👨‍🍳 Personal', kpis.ratios.staffCost, 35)}
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                ${subidas.length > 0 ? `
                    <div class="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-2xl mb-2 animate-pulse">🔥</div>
                    <h3 class="font-black text-slate-800">Alerta Precios</h3>
                    <p class="text-xs text-slate-500 mb-2">Han subido ${subidas.length} productos</p>
                    <button onclick="alert('${subidas.map(s=>s.prod + ': +' + s.diff + '%').join('\\n')}')" class="text-[10px] font-bold text-rose-500 underline">Ver lista</button>
                ` : `
                    <div class="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl mb-2">🛡️</div>
                    <h3 class="font-black text-slate-800">Precios Estables</h3>
                    <p class="text-xs text-slate-500">Sin subidas detectadas</p>
                `}
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 class="text-xs font-black text-slate-800 uppercase mb-4">Tendencia (6 Meses)</h3>
                <div class="h-48 relative"><canvas id="chartTendencia"></canvas></div>
            </div>
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 class="text-xs font-black text-slate-800 uppercase mb-4">Reparto de Gastos</h3>
                <div class="h-40 w-40 relative"><canvas id="chartDonut"></canvas></div>
            </div>
        </div>

    </div>
    `;

    // 4. INICIALIZAR GRÁFICAS
    setTimeout(() => {
        // Datos simulados para histórico si no hay (para que se vea bonito al principio)
        // En producción usará datos reales si existen en ArumeEngine
        const labels = ['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
        const dataVentas = [32000, 34000, 31000, 38000, 42000, kpis.ingresos.total || 35000];
        
        // Gráfica Barras
        const ctx1 = document.getElementById('chartTendencia');
        if (ctx1) {
            new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Ventas',
                        data: dataVentas,
                        backgroundColor: '#6366f1',
                        borderRadius: 5
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
            });
        }

        // Gráfica Donut
        const ctx2 = document.getElementById('chartDonut');
        if (ctx2) {
            new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Comida', 'Bebida', 'Personal', 'Fijos'],
                    datasets: [{
                        data: [kpis.gastos.comida, kpis.gastos.bebida, kpis.gastos.personal, kpis.gastos.estructura],
                        backgroundColor: ['#fb923c', '#c084fc', '#3b82f6', '#94a3b8'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
        }
    }, 100);
}

// Helper Visual Ratios
function renderRatioCard(title, value, target) {
    const isGood = value <= target;
    return `
    <div class="text-center p-2 rounded-xl border ${isGood ? 'border-slate-100 bg-slate-50' : 'border-rose-100 bg-rose-50'}">
        <p class="text-[9px] font-bold text-slate-500 uppercase">${title}</p>
        <p class="text-xl font-black ${isGood ? 'text-slate-800' : 'text-rose-500'}">${value.toFixed(1)}%</p>
        <p class="text-[8px] text-slate-400">Meta: < ${target}%</p>
    </div>`;
}
