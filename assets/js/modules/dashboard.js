/* =============================================================
   📊 MÓDULO: DASHBOARD v5.0 (Enterprise Gold)
   ============================================================= */

// CONFIGURACIÓN ESTÁTICA (Ajustar según realidad del restaurante)
const CONF = {
    PERSONAL_ESTIMADO: 18000, // Coste mensual aprox de nóminas
    COMISION_TPV: 0.015,      // 1.5% de comisión media
    META_VENTAS: 40000        // Objetivo mensual
};

export async function render(container, supabase, db, opts = {}) {
    
    // --- 1. CARGA SEGURA DE LIBRERÍAS (CHART.JS) ---
    const ensureChartJS = async () => {
        if (window.Chart) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // --- 2. HELPERS ROBUSTOS ---
    const parseFechaSafe = (d) => {
        if (!d) return null;
        if (d instanceof Date) return d;
        if (typeof d === 'string') {
            // Caso DD/MM/YYYY
            if (d.includes('/')) {
                const parts = d.split('/');
                if (parts.length === 3) {
                    const y = parts[2].length === 2 ? '20'+parts[2] : parts[2];
                    return new Date(`${y}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
                }
            }
            // Caso YYYY-MM-DD
            return new Date(d);
        }
        return null;
    };

    const esMes = (d, m, y) => {
        const fecha = parseFechaSafe(d);
        return fecha && fecha.getMonth() === m && fecha.getFullYear() === y;
    };

    const fmt = (n) => Number(n).toLocaleString('es-ES', {style:'currency', currency:'EUR', maximumFractionDigits: 0});
    const pctSafe = (val) => Number.isFinite(val) ? Math.min(100, Math.max(0, val)) : 0;

    // --- 3. CALCULADORA FINANCIERA ---
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();
    const diasDelMes = new Date(yearActual, mesActual + 1, 0).getDate();
    const diaHoy = hoy.getDate();

    // A) VENTAS
    // Sumar cierres (caja diaria) + facturas extra (eventos fuera de caja)
    const ventasCierres = (db.cierres || []).filter(c => esMes(c.date, mesActual, yearActual)).reduce((acc, c) => acc + (parseFloat(c.totalVenta)||0), 0);
    const ventasFacturas = (db.facturas || []).filter(f => esMes(f.date, mesActual, yearActual) && !f.num.startsWith('Z-')).reduce((acc, f) => acc + (parseFloat(f.total)||0), 0);
    const ventasMes = ventasCierres + ventasFacturas;

    // B) GASTOS & FOOD COST
    let gastosComida = 0;
    let gastosBebida = 0;
    let gastosOtros = 0;

    const albaranesMes = (db.albaranes || []).filter(a => esMes(a.date, mesActual, yearActual));
    const gastosMes = albaranesMes.reduce((acc, a) => {
        const total = parseFloat(a.total) || 0;
        const p = (a.prov || '').toLowerCase();
        
        // Categorización inteligente
        if (p.match(/fruta|carne|pesca|makro|mercadona|pan|huevo|verdu/)) {
            gastosComida += total;
        } else if (p.match(/estrella|mahou|coca|vino|bebida|licor|bodega|drinks/)) {
            gastosBebida += total;
        } else {
            gastosOtros += total;
        }
        return acc + total;
    }, 0);

    // C) GASTOS FIJOS & ESTRUCTURA
    const fijosMes = (db.gastos_fijos || []).reduce((acc, g) => {
        let val = parseFloat(g.amount) || 0;
        if(g.freq === 'anual') val /= 12;
        else if(g.freq === 'trimestral') val /= 3;
        return acc + val;
    }, 0);

    const costePersonal = (db.config?.personalMensual || CONF.PERSONAL_ESTIMADO);
    const costeTPV = ventasCierres * CONF.COMISION_TPV; // Estimación comisiones banco

    // D) BENEFICIO NETO REAL
    const totalGastos = gastosMes + fijosMes + costePersonal + costeTPV;
    const beneficio = ventasMes - totalGastos;

    // E) FORECAST (IA LIGERA)
    let pesoTotal = 0, pesoLlevado = 0;
    for(let i=1; i<=diasDelMes; i++) {
        const d = new Date(yearActual, mesActual, i);
        const w = d.getDay();
        const peso = (w===5 || w===6 || w===0) ? 1.4 : 1.0; // Finde pesa más
        pesoTotal += peso;
        if (i <= diaHoy) pesoLlevado += peso;
    }
    const forecastVentas = pesoLlevado > 0 ? (ventasMes / pesoLlevado) * pesoTotal : 0;

    // F) ALERTAS INFLACIÓN
    const subidas = [];
    if (db.priceHistory) {
        Object.keys(db.priceHistory).forEach(prod => {
            const hist = db.priceHistory[prod];
            if (hist.length >= 2) {
                const last = hist[hist.length - 1];
                const prev = hist[hist.length - 2];
                // Solo si es de este mes y subió > 5%
                if (esMes(last.date, mesActual, yearActual) && last.unit > prev.unit * 1.05) {
                    const diff = ((last.unit - prev.unit) / prev.unit * 100).toFixed(1);
                    subidas.push({ prod, diff, old: prev.unit, new: last.unit });
                }
            }
        });
    }

    // --- 4. DATOS GRÁFICA SEMESTRAL ---
    const labels = [];
    const dataV = [], dataG = [], dataB = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(yearActual, mesActual - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        
        const v = (db.cierres||[]).filter(c=>esMes(c.date,m,y)).reduce((acc,c)=>acc+(parseFloat(c.totalVenta)||0),0) +
                  (db.facturas||[]).filter(f=>esMes(f.date,m,y) && !f.num.startsWith('Z-')).reduce((acc,f)=>acc+(parseFloat(f.total)||0),0);
        
        const g = (db.albaranes||[]).filter(a=>esMes(a.date,m,y)).reduce((acc,a)=>acc+(parseFloat(a.total)||0),0);
        
        // Beneficio histórico (aprox sin personal variable)
        const b = v - g - fijosMes - costePersonal;

        labels.push(d.toLocaleDateString('es-ES',{month:'short'}).toUpperCase());
        dataV.push(v);
        dataG.push(g);
        dataB.push(b);
    }

    // --- 5. RENDERIZADO ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <div class="flex justify-between items-end px-2">
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">${hoy.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'})}</p>
                <h2 class="text-3xl font-black text-slate-800">Panel de Control</h2>
            </div>
            <div class="text-right cursor-pointer" onclick="document.getElementById('modalInflacion').classList.remove('hidden')">
                ${subidas.length > 0 ? 
                    `<div class="flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-full border border-rose-100 shadow-sm animate-pulse">
                        <span class="text-xl">📈</span>
                        <div>
                            <p class="text-[9px] font-black text-rose-500 uppercase leading-none">Inflación</p>
                            <p class="text-[10px] font-bold text-rose-700 leading-none">${subidas.length} productos</p>
                        </div>
                    </div>` : 
                    `<div class="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 shadow-sm">
                        <span class="text-xl">🛡️</span>
                        <div>
                            <p class="text-[9px] font-black text-emerald-500 uppercase leading-none">Precios</p>
                            <p class="text-[10px] font-bold text-emerald-700 leading-none">Estables</p>
                        </div>
                    </div>`
                }
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden md:col-span-2 group">
                <div class="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-[60px] opacity-30 -mr-10 -mt-10 group-hover:opacity-50 transition duration-700"></div>
                <div class="flex justify-between items-start relative z-10">
                    <div class="space-y-1">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Real</p>
                        <h3 class="text-5xl font-black tracking-tight">${fmt(ventasMes)}</h3>
                        <div class="flex items-center gap-2 mt-2 bg-white/10 px-3 py-1.5 rounded-lg w-fit backdrop-blur-md border border-white/10">
                            <span class="text-lg">🔮</span>
                            <div>
                                <p class="text-[8px] font-bold text-indigo-200 uppercase leading-none">Proyección Fin de Mes</p>
                                <p class="text-xs font-black text-white leading-none">~${fmt(forecastVentas)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white/10 p-3 rounded-2xl backdrop-blur-sm"><span class="text-2xl">🚀</span></div>
                </div>
                <div class="mt-6">
                    <div class="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                        <span>Objetivo: ${fmt(CONF.META_VENTAS)}</span>
                        <span>${pctSafe(ventasMes/CONF.META_VENTAS*100).toFixed(0)}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-1000" style="width: ${pctSafe(ventasMes/CONF.META_VENTAS*100)}%"></div>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase">Beneficio Neto (Est.)</p>
                        <h3 class="text-3xl font-black ${beneficio >= 0 ? 'text-slate-800' : 'text-rose-500'}">${fmt(beneficio)}</h3>
                    </div>
                    <span class="text-2xl">💰</span>
                </div>
                <div class="mt-4 space-y-1">
                    <div class="flex justify-between text-[10px] text-slate-400">
                        <span>Gastos Var.</span> <span class="font-bold text-rose-400">-${fmt(gastosMes)}</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-slate-400">
                        <span>Fijos + Personal</span> <span class="font-bold text-amber-400">-${fmt(fijosMes + costePersonal)}</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
                        <div class="bg-emerald-500 h-full" style="width: ${pctSafe(beneficio/ventasMes*100)}%"></div>
                    </div>
                    <p class="text-[9px] text-right text-emerald-600 font-bold">Margen ${(ventasMes>0 ? (beneficio/ventasMes*100).toFixed(1) : 0)}%</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Costes Operativos</p>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                            <span>🥘 Food Cost</span>
                            <span>${(ventasMes>0 ? (gastosComida/ventasMes*100).toFixed(1) : 0)}%</span>
                        </div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full ${gastosComida/ventasMes > 0.35 ? 'bg-rose-500' : 'bg-orange-400'}" style="width: ${pctSafe(gastosComida/ventasMes*100)}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                            <span>🍷 Drink Cost</span>
                            <span>${(ventasMes>0 ? (gastosBebida/ventasMes*100).toFixed(1) : 0)}%</span>
                        </div>
                        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-purple-400" style="width: ${pctSafe(gastosBebida/ventasMes*100)}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-black text-slate-800">Evolución Semestral</h3>
                    <div class="flex gap-2">
                        <span class="text-[10px] font-bold text-indigo-500">● Ventas</span>
                        <span class="text-[10px] font-bold text-rose-400">● Gastos</span>
                        <span class="text-[10px] font-bold text-emerald-500">— Beneficio</span>
                    </div>
                </div>
                <div class="h-64 w-full relative">
                    <canvas id="chartSemestral"></canvas>
                </div>
            </div>

            <div class="space-y-3">
                <div class="bg-indigo-600 text-white p-5 rounded-[2rem] shadow-lg flex flex-col justify-center items-center text-center cursor-pointer hover:bg-indigo-700 transition" onclick="loadModule('cajas')">
                    <span class="text-3xl mb-2">📠</span>
                    <p class="font-black text-sm uppercase">Cerrar Caja</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="loadModule('albaranes')" class="p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 transition flex flex-col items-center gap-2">
                        <span class="text-xl">📸</span>
                        <span class="text-[10px] font-black uppercase">Gasto</span>
                    </button>
                    <button onclick="loadModule('tesoreria')" class="p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 transition flex flex-col items-center gap-2">
                        <span class="text-xl">🏦</span>
                        <span class="text-[10px] font-black uppercase">Banco</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="modalInflacion" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
        <div class="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl relative">
            <button onclick="document.getElementById('modalInflacion').classList.add('hidden')" class="absolute top-4 right-4 text-2xl text-slate-300 hover:text-slate-600">✕</button>
            <h3 class="text-xl font-black text-rose-500 mb-1">🔥 Alerta de Inflación</h3>
            <p class="text-xs text-slate-400 mb-6">Productos que han subido más de un 5% este mes.</p>
            <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                ${subidas.map(s => `
                    <div class="flex justify-between items-center bg-rose-50 p-3 rounded-xl border border-rose-100">
                        <div>
                            <p class="text-xs font-black text-slate-700 uppercase">${s.prod}</p>
                            <p class="text-[10px] text-slate-400">Antes: ${s.old.toFixed(2)}€ ➔ Ahora: ${s.new.toFixed(2)}€</p>
                        </div>
                        <span class="text-xs font-black text-rose-600 bg-white px-2 py-1 rounded-lg shadow-sm">+${s.diff}%</span>
                    </div>
                `).join('') || '<p class="text-center text-slate-400">No hay subidas registradas.</p>'}
            </div>
        </div>
    </div>
    `;

    // --- 6. INICIALIZAR GRÁFICA ---
    await ensureChartJS();
    setTimeout(() => {
        const ctx = document.getElementById('chartSemestral');
        if(ctx) {
            new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Ventas', data: dataV, backgroundColor: '#6366f1', borderRadius: 6, order: 2 },
                        { label: 'Gastos', data: dataG, backgroundColor: '#fb7185', borderRadius: 6, order: 3 },
                        { label: 'Beneficio', data: dataB, type: 'line', borderColor: '#10b981', borderWidth: 2, tension: 0.4, order: 1 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }, 100);
}
