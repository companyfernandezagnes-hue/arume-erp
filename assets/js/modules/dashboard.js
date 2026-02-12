/* =============================================================
   📊 MÓDULO: DASHBOARD PRO (KPIs, IVA Real y Salud Financiera)
   ============================================================= */
export function render(container, supabase, db) {
    // 1. DATA MINING (Fuentes de datos Diamond)
    const facturas = db.facturas || [];     // Ventas / Ingresos [cite: 9]
    const albaranes = db.albaranes || [];   // Compras / Gastos [cite: 9]
    const diario = db.diario || [];         // Mix de cobros y TPV [cite: 13]
    const fijos = db.gastos_fijos || [];    // Gastos fijos (Mochila) [cite: 9]

    // 2. CÁLCULOS FINANCIEROS CLAVE
    const totalIngresos = facturas.reduce((t, f) => t + (parseFloat(f.total) || 0), 0);
    const totalCompras = albaranes.reduce((t, a) => t + (parseFloat(a.total) || 0), 0);
    const totalFijos = fijos.reduce((acc, g) => {
        return acc + (g.freq === 'anual' ? (parseFloat(g.amount) || 0) / 12 : (parseFloat(g.amount) || 0));
    }, 0); [cite: 9, 52]

    // Prime Cost (% Food + Labor estimado)
    const foodCost = (totalCompras / totalIngresos) * 100 || 0;
    const laborCostPct = 35; // Objetivo estándar 
    const primeCost = foodCost + laborCostPct;
    
    // IVA (Input Real vs Output Estimado 10%)
    const ivaSoportado = facturas.reduce((t, f) => t + (parseFloat(f.tax) || 0), 0);
    const ivaRepercutidoEst = totalIngresos * (10 / 110); // 10% hostelería

    // 3. ESTRUCTURA UI (Bento Grid Style)
    container.innerHTML = `
        <div class="animate-fade-in space-y-6 p-4">
            <div class="flex justify-between items-end bg-white p-6 rounded-[2.5rem] shadow-sm">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Dashboard de Gerencia</h2>
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado de Salud del Negocio</p>
                </div>
                <div class="flex gap-2">
                    ${primeCost > 62 ? '<span class="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">⚠️ ALTO PRIME COST</span>' : '<span class="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black">✅ COSTES SANOS</span>'}
                </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Ventas Totales</p>
                    <p class="text-2xl font-black text-slate-800">${totalIngresos.toLocaleString()}€</p>
                </div>
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Compras (Food)</p>
                    <p class="text-2xl font-black text-slate-800">${totalCompras.toLocaleString()}€</p>
                </div>
                <div class="bg-indigo-50 p-6 rounded-[2rem] shadow-sm border border-indigo-100">
                    <p class="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Prime Cost</p>
                    <p class="text-2xl font-black text-indigo-700">${primeCost.toFixed(1)}%</p>
                    <p class="text-[9px] font-bold text-indigo-400">Objetivo: 55-60%</p>
                </div>
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Punto de Equilibrio</p>
                    <p class="text-2xl font-black text-slate-800">${(totalFijos / 0.65).toLocaleString(undefined, {maximumFractionDigits:0})}€</p>
                    <p class="text-[9px] font-bold text-slate-400">Venta mínima mensual</p>
                </div>
            </div>

            <div class="grid lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
                    <h3 class="text-xs font-black text-slate-400 uppercase mb-6 tracking-widest">Distribución de Gastos</h3>
                    <canvas id="chartBalances" role="img" aria-label="Gráfica de ingresos vs gastos" height="250"></canvas>
                </div>
                
                <div class="space-y-4">
                    <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                        <h3 class="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Previsión IVA (Borrador 303)</h3>
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm"><span>IVA Repercutido (10%)</span> <span>${ivaRepercutidoEst.toFixed(2)}€</span></div>
                            <div class="flex justify-between text-sm border-b border-slate-700 pb-2"><span>IVA Soportado (Real)</span> <span>${ivaSoportado.toFixed(2)}€</span></div>
                            <div class="flex justify-between text-lg font-black pt-2 text-emerald-400"><span>A Ingresar</span> <span>${(ivaRepercutidoEst - ivaSoportado).toFixed(2)}€</span></div>
                        </div>
                        <button onclick="window.dl303()" class="w-full mt-6 bg-white/10 hover:bg-white/20 py-2 rounded-xl text-[10px] font-black transition uppercase">Exportar Borrador CSV</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 4. FUNCIONALIDAD EXTRA: Exportar Modelo 303
    window.dl303 = () => {
        const rows = [
            ['Concepto', 'Base Estimada', 'IVA'],
            ['IVA Repercutido (Hostelería)', totalIngresos.toFixed(2), ivaRepercutidoEst.toFixed(2)],
            ['IVA Soportado (Proveedores)', '', ivaSoportado.toFixed(2)],
            ['Diferencia Neto', '', (ivaRepercutidoEst - ivaSoportado).toFixed(2)]
        ];
        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Borrador_303_${new Date().getFullYear()}.csv`;
        a.click();
    };

    // 5. RENDER GRÁFICA (Chart.js con accesibilidad)
    setTimeout(() => {
        const ctx = document.getElementById('chartBalances');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ventas', 'Compras', 'Costes Fijos'],
                datasets: [{
                    data: [totalIngresos, totalCompras, totalFijos],
                    backgroundColor: ['#4f46e5', '#f43f5e', '#facc15'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '80%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 11 } } }
                }
            }
        });
    }, 100);
}
