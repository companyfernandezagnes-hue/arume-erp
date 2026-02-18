/* =============================================================
   🔮 MÓDULO: PREVISIÓN DE LIQUIDEZ (Cashflow Realista)
   ============================================================= */

export async function render(container, sb, db) {
    
    // 1. ANÁLISIS DE SITUACIÓN ACTUAL
    const today = new Date();
    
    // A. Saldo Actual (Suma de todos los movimientos del banco)
    const saldoActual = (db.banco || []).reduce((acc, m) => acc + window.Num.parse(m.amount), 0);

    // B. Calcular Promedios Diarios (Basado en los últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // --- CORRECCIÓN CLAVE: Sumar Cierres Z + Facturas ---
    // Ingresos por Cierre Z (TPV)
    const ingresosCaja = (db.cierres || [])
        .filter(c => new Date(c.date) >= thirtyDaysAgo)
        .reduce((acc, c) => acc + window.Num.parse(c.totalVenta), 0);

    // Ingresos por Factura (Eventos)
    const ingresosFacturas = (db.facturas || [])
        .filter(f => new Date(f.date) >= thirtyDaysAgo && !String(f.num).startsWith('Z-'))
        .reduce((acc, f) => acc + window.Num.parse(f.total), 0);

    const promedioVentas = (ingresosCaja + ingresosFacturas) / 30 || 0;

    // B2. Promedio Compras Variables Diarias (Albaranes)
    const comprasUltimos30 = (db.albaranes || [])
        .filter(a => new Date(a.date) >= thirtyDaysAgo)
        .reduce((acc, a) => acc + window.Num.parse(a.total), 0);
    const promedioCompras = comprasUltimos30 / 30 || 0;

    // 2. MOTOR DE PROYECCIÓN (La Bola de Cristal)
    let saldoProyectado = saldoActual;
    let diasProyeccion = [];
    let saldoMinimo = saldoActual;
    let diaCritico = null;

    // Recorremos los próximos 30 días
    for (let i = 1; i <= 30; i++) {
        let fechaFutura = new Date();
        fechaFutura.setDate(today.getDate() + i);
        let diaMes = fechaFutura.getDate();

        // 1. Sumar Ventas Estimadas
        saldoProyectado += promedioVentas;

        // 2. Restar Compras Estimadas
        saldoProyectado -= promedioCompras;

        // 3. Restar Gastos Fijos (Si tocan hoy)
        const gastosHoy = (db.gastos_fijos || []).filter(g => {
            if (g.active === false) return false;
            // Asumimos que si el día de pago es el 31 y el mes tiene 30, se paga el 30 (simplificación)
            return (g.dia_pago || 1) === diaMes; 
        });

        let impactoFijos = 0;
        gastosHoy.forEach(g => {
            impactoFijos += window.Num.parse(g.amount);
        });

        saldoProyectado -= impactoFijos;

        // Guardar Datos
        if (saldoProyectado < saldoMinimo) saldoMinimo = saldoProyectado;
        if (saldoProyectado < 0 && !diaCritico) diaCritico = fechaFutura;

        diasProyeccion.push({
            dia: fechaFutura.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
            saldo: saldoProyectado,
            gastosFijos: impactoFijos 
        });
    }

    // Formateador Global
    const fmt = window.Num.fmt;

    // 3. RENDERIZADO UI
    container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Previsión de Caja</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Próximos 30 Días</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Saldo Actual</p>
                    <p class="text-3xl font-black ${saldoActual >= 0 ? 'text-slate-800' : 'text-rose-500'}">${fmt(saldoActual)}</p>
                </div>
            </header>

            ${saldoMinimo < 0 ? `
                <div class="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                    <span class="text-2xl">🚨</span>
                    <div>
                        <p class="text-xs font-black text-rose-600 uppercase">ALERTA DE LIQUIDEZ</p>
                        <p class="text-xs text-rose-800">
                            Según tu ritmo actual, entrarás en números rojos el <strong>${diaCritico?.toLocaleDateString()}</strong>.
                            Te faltarán unos ${fmt(saldoMinimo)}.
                        </p>
                    </div>
                </div>
            ` : `
                <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                    <span class="text-2xl">✅</span>
                    <div>
                        <p class="text-xs font-black text-emerald-600 uppercase">SALUD FINANCIERA OK</p>
                        <p class="text-xs text-emerald-800">
                            Tu previsión a 30 días es positiva. El punto más bajo será de ${fmt(saldoMinimo)}.
                        </p>
                    </div>
                </div>
            `}

            <div class="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 h-80 relative">
                <canvas id="chartLiquidez"></canvas>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-4 rounded-2xl border border-slate-100">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Entrada Diaria (Est.)</p>
                    <p class="text-lg font-black text-emerald-500">+${fmt(promedioVentas)}/día</p>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-100">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Salida Diaria (Est.)</p>
                    <p class="text-lg font-black text-rose-500">-${fmt(promedioCompras)}/día</p>
                </div>
            </div>

             <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 class="text-xs font-black text-slate-800 uppercase mb-4">Pagos Fijos Próximos (Detectados)</h3>
                <div class="space-y-2">
                    ${(db.gastos_fijos || [])
                        .filter(g => g.active !== false)
                        .sort((a,b) => {
                            let d1 = (a.dia_pago || 1) - today.getDate();
                            let d2 = (b.dia_pago || 1) - today.getDate();
                            if(d1 < 0) d1 += 30; 
                            if(d2 < 0) d2 += 30;
                            return d1 - d2;
                        })
                        .slice(0, 3) 
                        .map(g => `
                            <div class="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <div>
                                    <p class="font-bold text-slate-700 text-xs">${g.name}</p>
                                    <p class="text-[9px] text-slate-400">Día ${g.dia_pago} de cada mes</p>
                                </div>
                                <p class="font-black text-rose-500 text-xs">-${parseFloat(g.amount).toLocaleString()}€</p>
                            </div>
                        `).join('')}
                </div>
             </div>
        </div>
    `;

    // 4. INICIALIZAR GRÁFICO
    setTimeout(() => {
        const ctx = document.getElementById('chartLiquidez');
        if (ctx) {
            if (window.myLiquidezChart) window.myLiquidezChart.destroy();

            window.myLiquidezChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: diasProyeccion.map(d => d.dia),
                    datasets: [{
                        label: 'Saldo Proyectado',
                        data: diasProyeccion.map(d => d.saldo),
                        borderColor: '#4f46e5', 
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                            gradient.addColorStop(0, 'rgba(79, 70, 229, 0.2)');
                            gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
                            return gradient;
                        },
                        borderWidth: 3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            callbacks: {
                                label: (c) => c.parsed.y.toLocaleString('es-ES', {style:'currency', currency:'EUR', maximumFractionDigits: 0})
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 6 } },
                        y: { 
                            grid: { color: '#f1f5f9' }, 
                            ticks: { font: { size: 9 }, callback: (v) => v/1000 + 'k' }
                        }
                    }
                }
            });
        }
    }, 100);
}
