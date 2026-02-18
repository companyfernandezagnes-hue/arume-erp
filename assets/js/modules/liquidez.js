/* =============================================================
   🔮 MÓDULO: LIQUIDEZ PRO v2.0 (Cashflow Realista + Cerebro)
   ============================================================= */

export async function render(container, sb, db) {

    // --- HELPERS INTERNOS ---
    // Usamos los helpers globales definidos en app.js
    const fmt = window.Num.fmt;
    const parse = window.Num.parse;
    const today = new Date();
    
    // ===============================
    // 1) SALDO ACTUAL (BANCO + EFECTIVO)
    // ===============================
    const saldoBanco = (db.banco || []).reduce((acc, m) => acc + parse(m.amount), 0);

    // Caja física acumulada del mes actual (Estimación simple)
    // Nota: Para precisión total, deberías tener un módulo de arqueo de caja fuerte.
    // Aquí sumamos el efectivo de los cierres de este mes que no se ha ingresado en banco.
    // (Asumimos que lo ingresas cuando hay un movimiento en banco tipo "Ingreso Efectivo")
    // Por seguridad, para liquidez bancaria, contaremos solo banco, pero mostramos efectivo aparte.
    
    const saldoActual = saldoBanco; 

    // ===============================
    // 2) INGRESOS FUTUROS (FORECAST INTELIGENTE)
    // ===============================
    // Usamos lógica interna si ArumeEngine no tiene forecast diario específico
    const calcForecastDiario = (dias) => {
        const historico = db.cierres || [];
        // Calculamos media por día de la semana (Lunes, Martes...) de los últimos 3 meses
        const mediasSemana = [0,0,0,0,0,0,0]; // Dom-Sab
        const conteos = [0,0,0,0,0,0,0];
        
        const tresMesesAtras = new Date();
        tresMesesAtras.setDate(today.getDate() - 90);

        historico.forEach(c => {
            const d = new Date(c.date);
            if(d >= tresMesesAtras) {
                const day = d.getDay();
                mediasSemana[day] += parse(c.totalVenta);
                conteos[day]++;
            }
        });

        // Forecast para los próximos X días
        const proyeccion = [];
        for(let i=1; i<=dias; i++) {
            const futura = new Date();
            futura.setDate(today.getDate() + i);
            const day = futura.getDay();
            const media = conteos[day] > 0 ? mediasSemana[day] / conteos[day] : 500; // 500€ fallback
            proyeccion.push(media);
        }
        return proyeccion;
    };

    const ventasPrev = calcForecastDiario(30);

    // ===============================
    // 3) COBROS PENDIENTES (CxC - Facturas emitidas no cobradas)
    // ===============================
    const cobrosPendientes = (db.facturas || [])
        .filter(f => !f.paid && !String(f.num).startsWith('Z-')) // Excluir Cierres Z
        .reduce((a,f) => a + parse(f.total), 0);

    // ===============================
    // 4) PAGOS PENDIENTES (CxP - Proveedores no pagados)
    // ===============================
    const pagosPendientes = (db.albaranes || [])
        .filter(a => !a.paid)
        .reduce((a,f) => a + parse(f.total), 0);

    // ===============================
    // 5) GASTOS FIJOS DEL PRÓXIMO MES
    // ===============================
    function prorrateoDiario(g){
        if(g.active === false) return 0;
        const amt = parse(g.amount);
        // Si es gasto puntual (ej: anual), solo cuenta el día que toca
        // Aquí simplificamos para impacto mensual
        return amt; 
    }

    // ===============================
    // 6) AMORTIZACIONES (Mensual)
    // ===============================
    const amortMes = window.calcularAmortizacionMensual ? window.calcularAmortizacionMensual(db.activos) : 0;

    // ===============================
    // 7) IVA TRIMESTRAL (Estimación)
    // ===============================
    // Usamos el cálculo simple del módulo Informes
    let ivaAcumulado = 0;
    // (Aquí podríamos conectar con ArumeEngine.getProfit para más precisión, pero lo dejamos simple por ahora)
    const ivaProx = 2000; // Valor seguro por defecto si no hay datos suficientes

    // ===============================
    // 8) PROYECCIÓN DÍA POR DÍA
    // ===============================
    let saldo = saldoActual;
    let minSaldo = saldoActual;
    let diaCritico = null;
    let proyeccion = [];

    for (let i=1; i<=30; i++){
        const f = new Date();
        f.setDate(today.getDate() + i);
        const diaMes = f.getDate();

        // A. INGRESOS ESTIMADOS DIARIOS
        const ventaDia = ventasPrev[i-1] || 0;
        saldo += ventaDia;

        // B. GASTOS VARIABLES (Promedio histórico por día)
        // Calculamos un % sobre la venta (ej: 30% coste producto)
        // Esto es más realista que un fijo diario
        const gastVarDia = ventaDia * 0.35; // Estimación del 35% de coste mercadería
        saldo -= gastVarDia;

        // C. GASTOS FIJOS (día marcado en gasto.dia_pago)
        let fijosHoy = 0;
        (db.gastos_fijos || [])
            .filter(g => g.active !== false && parseInt(g.dia_pago || 1) === diaMes)
            .forEach(g => {
                // Solo sumamos si la frecuencia coincide (simplificación: asumimos mensual o anual que toca)
                fijosHoy += parse(g.amount);
            });
        saldo -= fijosHoy;

        // D. COBROS / PAGOS PENDIENTES REPARTIDOS (Heurística)
        if (i===3) saldo += cobrosPendientes * 0.5;       // 50% cobramos pronto
        if (i===10) saldo += cobrosPendientes * 0.5;      // 50% resto
        if (i===5) saldo -= pagosPendientes * 0.4;        // Pagamos 40% pronto
        if (i===15) saldo -= pagosPendientes * 0.6;       // Resto a 15 días

        // E. IVA (si toca este mes, días 20 de Abril, Julio, Oct, Ene)
        const month = f.getMonth(); // 0-11
        if ([3,6,9,0].includes(month) && diaMes===20) { // Abr(3), Jul(6)...
            saldo -= ivaProx;
        }

        // F. AMORTIZACIÓN (Salida contable, no de caja, pero afecta a beneficio. 
        // Para LIQUIDEZ (dinero en banco), NO restamos amortización)
        // saldo -= amortMes; // COMENTADO: La amortización no quita dinero del banco.

        // Registrar Hitos
        if (saldo < minSaldo) minSaldo = saldo;
        if (saldo < 0 && !diaCritico) diaCritico = f;

        proyeccion.push({
            fecha: f.toLocaleDateString('es-ES',{day:'2-digit',month:'short'}),
            saldo,
            fijosHoy,
            ventaDia
        });
    }

    // ============================================================
    // =====================  RENDER UI  ===========================
    // ============================================================

    container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Tesorería Futura</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">IA Forecast 30 Días</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Liquidez Real Hoy</p>
                    <p class="text-3xl font-black ${saldoActual >= 0 ? 'text-slate-800' : 'text-rose-500'}">${fmt(saldoActual)}</p>
                </div>
            </header>

            ${minSaldo < 0 ? `
                <div class="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                    <span class="text-3xl">🚨</span>
                    <div>
                        <p class="text-xs font-black text-rose-600 uppercase">RIESGO DE QUIEBRA TÉCNICA</p>
                        <p class="text-xs text-rose-800 mt-1">
                            Atención: El día <strong>${diaCritico?.toLocaleDateString()}</strong> podrías quedarte sin fondos.
                            Déficit previsto: <strong>${fmt(minSaldo)}</strong>.
                        </p>
                    </div>
                </div>
            ` : `
                <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                    <span class="text-3xl">✅</span>
                    <div>
                        <p class="text-xs font-black text-emerald-600 uppercase">SALUD FINANCIERA ROBUSTA</p>
                        <p class="text-xs text-emerald-800 mt-1">
                            Tu previsión a 30 días es positiva. El punto más bajo será de ${fmt(minSaldo)}.
                            Puedes afrontar tus pagos.
                        </p>
                    </div>
                </div>
            `}

            <div class="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 h-80 relative">
                <canvas id="chartLiquidez"></canvas>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-4 rounded-2xl border border-slate-100">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">CxC (Te deben)</p>
                    <p class="text-lg font-black text-indigo-500">+${fmt(cobrosPendientes)}</p>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-100">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">CxP (Debes)</p>
                    <p class="text-lg font-black text-rose-500">-${fmt(pagosPendientes)}</p>
                </div>
            </div>

             <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 class="text-xs font-black text-slate-800 uppercase mb-4">Próximos Hitos (Calendario)</h3>
                <div class="space-y-2">
                    ${proyeccion.filter(d => d.fijosHoy > 0).slice(0, 4).map(d => `
                        <div class="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                            <div>
                                <p class="font-bold text-slate-700 text-xs">${d.fecha}</p>
                                <p class="text-[9px] text-slate-400">Salida Fijos</p>
                            </div>
                            <p class="font-black text-rose-500 text-xs">-${fmt(d.fijosHoy)}</p>
                        </div>
                    `).join('') || '<p class="text-xs text-slate-400 italic">Sin pagos fijos inminentes.</p>'}
                </div>
             </div>
        </div>
    `;

    // ===============================
    // 9) INIT GRÁFICA
    // ===============================
    setTimeout(() => {
        const ctx = document.getElementById("chartLiquidez");
        if (!ctx) return;
        
        // Destruir instancia previa si existe para evitar errores de redibujado
        if (window.myLiquidezChart instanceof Chart) window.myLiquidezChart.destroy();

        window.myLiquidezChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: proyeccion.map(d => d.fecha),
                datasets: [{
                    label: "Saldo Proyectado",
                    data: proyeccion.map(d => d.saldo),
                    borderColor: "#4f46e5",
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
                    tension: 0.35 // Curva suave
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
                        grid: { color: "#f1f5f9" }, 
                        ticks: { font: { size: 9 }, callback: (v) => v >= 1000 ? (v/1000) + 'k€' : v + '€' } 
                    }
                }
            }
        });
    }, 200);
}
