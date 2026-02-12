/* =============================================================
   📊 MÓDULO: DASHBOARD DIAMOND (Runway + IVA Real + KPIs)
   ============================================================= */
export async function render(container, supabase, db) {
    // 1. DATA MINING (Fuentes de datos de tu caja fuerte)
    const facturas = db.facturas || [];     // Ventas / Ingresos [cite: 9, 33]
    const albaranes = db.albaranes || [];   // Compras / Gastos [cite: 9, 19]
    const diario = db.diario || [];         // Mix de cobros y TPV [cite: 13, 56]
    const fijos = db.gastos_fijos || [];    // Gastos fijos (La Mochila) [cite: 9, 52]

    // --- 2. CÁLCULOS DE IVA (REAL vs ESTIMADO) ---
    // Input: Lo que has pagado a proveedores (IVA Soportado real) [cite: 35]
    const ivaSoportado = albaranes.reduce((t, a) => t + (parseFloat(a.taxes || a.tax || 0)), 0); [cite: 35]

    // Output: Lo que has cobrado (IVA Repercutido)
    // Se estima al 10% (estándar hostelería) si no hay desglose en TPV [cite: 18, 35]
    const totalVentas = diario.reduce((t, d) => t + (parseFloat(d.total) || 0), 0); [cite: 57]
    const ivaRepercutido = totalVentas * (10 / 110); [cite: 18, 35]

    // --- 3. CÁLCULOS DE SUPERVIVENCIA (RUNWAY) ---
    // Caja actual (último registro del diario) [cite: 56, 57]
    const cajaActual = diario.length > 0 ? parseFloat(diario[diario.length - 1].cash || 0) : 0; [cite: 57]
    const gastosMes = albaranes.reduce((t, a) => t + (parseFloat(a.total) || 0), 0); [cite: 19, 34]
    
    // Runway: Meses de vida (Caja / Gastos Mensuales) [cite: 18]
    const runway = gastosMes > 0 ? (cajaActual / gastosMes) : 0; [cite: 18]

    // --- 4. PRIME COST (Food + Labor) ---
    // Objetivo sectorial: 55-60% [cite: 18]
    const foodCostPct = totalVentas > 0 ? (gastosMes / totalVentas) * 100 : 0; [cite: 18]
    const laborCostPct = 35; // Coste de personal estimado [cite: 18]
    const primeCost = foodCostPct + laborCostPct; [cite: 18]

    // 5. RENDERIZADO DE LA INTERFAZ
    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-5 rounded-[2rem] border flex items-center justify-between ${primeCost <= 60 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest opacity-70">Prime Cost</p>
                        <p class="text-xl font-black">${primeCost.toFixed(1)}%</p>
                    </div>
                    <span class="text-[10px] font-bold px-3 py-1 rounded-full bg-white/50">${primeCost <= 60 ? '🟢 SALUDABLE' : '🔴 REVISAR COSTES'}</span>
                </div>
                <div class="p-5 rounded-[2rem] border flex items-center justify-between ${runway >= 2 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-amber-50 border-amber-100 text-amber-700'}">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest opacity-70">Runway (Vida)</p>
                        <p class="text-xl font-black">${runway.toFixed(1)} meses</p>
                    </div>
                    <span class="text-[10px] font-bold px-3 py-1 rounded-full bg-white/50">${runway >= 2 ? '💎 SEGURO' : '⚠️ CAJA BAJA'}</span>
                </div>
            </div>

            <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div class="relative z-10">
                    <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Previsión Fiscal (Borrador 303)</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <p class="text-[10px] text-slate-500 font-bold uppercase">IVA Repercutido (Ventas)</p>
                            <p class="text-2xl font-black">${ivaRepercutido.toFixed(2)}€</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-500 font-bold uppercase">IVA Soportado (Compras)</p>
                            <p class="text-2xl font-black">${ivaSoportado.toFixed(2)}€</p>
                        </div>
                        <div class="bg-white/10 p-4 rounded-2xl border border-white/10">
                            <p class="text-[10px] text-indigo-300 font-bold uppercase">Resultado Neto</p>
                            <p class="text-2xl font-black text-emerald-400">${(ivaRepercutido - ivaSoportado).toFixed(2)}€</p>
                        </div>
                    </div>
                    <button id="btnDownload303" class="mt-8 text-[10px] font-black bg-white text-slate-900 px-8 py-3 rounded-xl hover:scale-105 transition uppercase tracking-widest">
                        Descargar Borrador 303 (CSV)
                    </button>
                </div>
            </div>

            <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 text-center">
                <h3 class="text-xs font-black text-slate-400 uppercase mb-6 tracking-widest">Balance de Operaciones</h3>
                <canvas id="chartFinanzas" height="200" role="img" aria-label="Gráfica de ingresos vs gastos"></canvas>
            </div>
        </div>
    `;

    // --- 6. EXPORTACIÓN BORRADOR 303 ---
    container.querySelector("#btnDownload303").onclick = () => {
        const rows = [
            ["Borrador Modelo 303", "Año " + year],
            ["Concepto", "Base Estimada", "IVA"],
            ["IVA Repercutido (Ventas)", totalVentas.toFixed(2), ivaRepercutido.toFixed(2)],
            ["IVA Soportado (Compras Real)", "", ivaSoportado.toFixed(2)],
            ["RESULTADO A INGRESAR", "", (ivaRepercutido - ivaSoportado).toFixed(2)]
        ];
        const csvContent = rows.map(e => e.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Borrador_303_${year}.csv`;
        link.click();
    };

    // --- 7. INICIALIZACIÓN DE GRÁFICA (Chart.js) ---
    setTimeout(() => {
        const ctx = document.getElementById('chartFinanzas');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ventas (Diario)', 'Compras (Albaranes)', 'Gastos Fijos'],
                datasets: [{
                    data: [totalVentas, gastosMes, 4000], // 4000 es el valor de gastos fijos por defecto [cite: 9]
                    backgroundColor: ['#4f46e5', '#f43f5e', '#facc15'],
                    borderRadius: 15
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { display: false }, ticks: { font: { weight: 'bold' } } },
                    x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
                }
            }
        });
    }, 150);
}
