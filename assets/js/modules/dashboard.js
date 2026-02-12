/* =============================================================
   📊 MÓDULO: DASHBOARD PRO DIAMOND (IVA, Runway y Ticket Medio)
   ============================================================= */

export async function render(container, supabase, db) {
    // --- 1. EXTRACCIÓN DE DATOS ---
    const facturas = db.facturas || [];
    const albaranes = db.albaranes || [];
    const diario = db.diario || [];
    
    // --- 2. CÁLCULOS FINANCIEROS ---
    const totalVentas = diario.reduce((t, d) => t + (parseFloat(d.total) || 0), 0);
    const totalCompras = albaranes.reduce((t, a) => t + (parseFloat(a.total) || 0), 0);
    
    // IVA Real: Soportado (compras) vs Repercutido (ventas estim. 10%)
    const ivaSoportado = albaranes.reduce((t, a) => t + (parseFloat(a.taxes || a.tax || 0)), 0);
    const ivaRepercutido = totalVentas * (10 / 110);
    const ivaNeto = ivaRepercutido - ivaSoportado;

    // Ticket Medio: Ventas / Comensales (si no hay dato de pax, estimamos 1 para no dar error)
    const totalPax = diario.reduce((t, d) => t + (parseInt(d.pax || d.clientes || 0)), 0);
    const ticketMedio = totalPax > 0 ? (totalVentas / totalPax) : 0;

    // Runway y Prime Cost
    const cajaActual = diario.length > 0 ? parseFloat(diario[diario.length - 1].cash || 0) : 0;
    const runway = totalCompras > 0 ? (cajaActual / (totalCompras / (diario.length || 1) * 30)) : 0;
    const primeCost = totalVentas > 0 ? ((totalCompras / totalVentas) * 100) + 35 : 0;

    // --- 3. DISEÑO DE LA INTERFAZ (BENTO GRID) ---
    container.innerHTML = `
        <div class="animate-fade-in space-y-6 p-2">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-5 rounded-[2rem] border flex items-center justify-between ${primeCost <= 60 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest opacity-60">Salud Operativa (Prime)</p>
                        <p class="text-xl font-black">${primeCost.toFixed(1)}%</p>
                    </div>
                    <span class="text-[9px] font-black px-3 py-1 rounded-full bg-white shadow-sm">${primeCost <= 60 ? 'IDEAL' : 'REVISAR'}</span>
                </div>
                <div class="p-5 rounded-[2rem] border flex items-center justify-between ${runway >= 1.5 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-amber-50 border-amber-100 text-amber-700'}">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest opacity-60">Supervivencia (Runway)</p>
                        <p class="text-xl font-black">${runway.toFixed(1)} meses</p>
                    </div>
                    <span class="text-[9px] font-black px-3 py-1 rounded-full bg-white shadow-sm">${runway >= 1.5 ? 'SEGURO' : 'RIESGO'}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Ventas Brutas</p>
                    <p class="text-2xl font-black text-slate-800">${totalVentas.toLocaleString()}€</p>
                </div>
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Ticket Medio</p>
                    <p class="text-2xl font-black text-indigo-600">${ticketMedio.toFixed(2)}€</p>
                </div>
                <div class="col-span-2 lg:col-span-1 bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Previsión IVA 303</p>
                    <p class="text-2xl font-black ${ivaNeto > 0 ? 'text-rose-400' : 'text-emerald-400'}">${ivaNeto.toFixed(2)}€</p>
                    <button onclick="window.export303()" class="mt-2 text-[8px] font-black uppercase bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition">Descargar CSV</button>
                </div>
            </div>

            <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
                <h3 class="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-[0.2em] text-center">Análisis de Flujo de Caja</h3>
                <canvas id="chartFinance" height="220"></canvas>
            </div>
        </div>
    `;

    // --- 4. LÓGICA DE EXPORTACIÓN ---
    window.export303 = () => {
        const rows = [
            ["Borrador Modelo 303 - Resumen"],
            ["Concepto", "Base Imponible", "Cuota IVA"],
            ["Ventas Repercutido (10%)", (totalVentas / 1.1).toFixed(2), ivaRepercutido.toFixed(2)],
            ["Compras Soportado (Real)", "", ivaSoportado.toFixed(2)],
            ["Resultado Neto", "", ivaNeto.toFixed(2)]
        ];
        const csv = rows.map(r => r.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Arume_IVA_303.csv";
        link.click();
    };

    // --- 5. GRÁFICA DE BARRAS (Chart.js) ---
    setTimeout(() => {
        const ctx = document.getElementById('chartFinance');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ingresos', 'Compras', 'Personal (Est.)', 'Gastos Fijos'],
                datasets: [{
                    data: [totalVentas, totalCompras, totalVentas * 0.35, 4000],
                    backgroundColor: ['#4f46e5', '#f43f5e', '#10b981', '#facc15'],
                    borderRadius: 12,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { weight: 'bold' } } },
                    x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
                }
            }
        });
    }, 100);
}
