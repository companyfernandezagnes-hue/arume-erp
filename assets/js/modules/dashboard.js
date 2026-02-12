/* =============================================================
   📊 MÓDULO: DASHBOARD PRO DIAMOND (PC & MOBILE)
   ============================================================= */

export async function render(container, supabase, db) {
    // 1. EXTRACCIÓN Y LIMPIEZA DE DATOS
    const diario = db.diario || [];
    const albaranes = db.albaranes || [];
    const fijos = db.gastos_fijos || [];
    
    // Totales principales
    const totalVentas = diario.reduce((t, d) => t + (parseFloat(d.total) || 0), 0);
    const totalCompras = albaranes.reduce((t, a) => t + (parseFloat(a.total) || 0), 0);
    
    // Cálculo de Fijos Prorrateados Reales
    const totalFijosMensual = fijos.reduce((t, g) => {
        const imp = parseFloat(g.amount || 0);
        return t + (g.freq === 'anual' ? imp / 12 : g.freq === 'trimestral' ? imp / 3 : imp);
    }, 0);

    const personalEst = totalVentas * 0.35; // Estimación 35%
    const beneficioNeto = totalVentas - totalCompras - totalFijosMensual - personalEst;

    // IVA (10% ventas vs IVA real albaranes)
    const ivaSoportado = albaranes.reduce((t, a) => t + (parseFloat(a.taxes || 0)), 0);
    const ivaRepercutido = totalVentas * (10 / 110);
    const ivaNeto = ivaRepercutido - ivaSoportado;

    // KPIs Inteligentes
    const totalPax = diario.reduce((t, d) => t + (parseInt(d.pax || 0)), 0);
    const ticketMedio = totalPax > 0 ? (totalVentas / totalPax) : 0;
    const breakEvenDiario = (totalFijosMensual / 0.65) / 30; // Considerando 65% margen bruto est.

    // 2. INTERFAZ BENTO GRID PRO
    container.innerHTML = `
        <div class="animate-fade-in p-4 space-y-6 max-w-7xl mx-auto">
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resultado Estimado</p>
                    <p class="text-3xl font-black ${beneficioNeto > 0 ? 'text-emerald-400' : 'text-rose-400'}">
                        ${beneficioNeto.toLocaleString('es-ES', {minimumFractionDigits: 2})}€
                    </p>
                    <p class="text-[9px] mt-2 text-slate-500 font-bold">Tras compras, fijos y personal (est.)</p>
                </div>
                
                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punto de Equilibrio/Día</p>
                    <p class="text-3xl font-black text-slate-800">${breakEvenDiario.toFixed(2)}€</p>
                    <div class="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div class="bg-indigo-500 h-full" style="width: ${Math.min((totalVentas/(breakEvenDiario*30))*100, 100)}%"></div>
                    </div>
                </div>

                <div class="bg-indigo-600 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                    <p class="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">IVA Neto a Pagar</p>
                    <p class="text-3xl font-black">${ivaNeto.toFixed(2)}€</p>
                    <button onclick="window.export303()" class="mt-3 text-[9px] font-black bg-white/20 px-4 py-2 rounded-xl hover:bg-white/30 transition">GENERAR MODELO 303</button>
                    <span class="absolute -right-4 -bottom-4 text-7xl opacity-10">⚖️</span>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Balance de Operaciones</h3>
                        <span class="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full">Mensual</span>
                    </div>
                    <div class="h-[250px]">
                        <canvas id="chartMain"></canvas>
                    </div>
                </div>

                <div class="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Estructura de Costes (Real)</h3>
                    <div class="h-[250px] flex items-center justify-center">
                        <canvas id="chartDonut"></canvas>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white p-5 rounded-[2rem] border border-slate-100 text-center">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Ticket Medio</p>
                    <p class="text-xl font-black text-indigo-600">${ticketMedio.toFixed(2)}€</p>
                </div>
                <div class="bg-white p-5 rounded-[2rem] border border-slate-100 text-center">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Comensales</p>
                    <p class="text-xl font-black text-slate-800">${totalPax}</p>
                </div>
                <div class="bg-white p-5 rounded-[2rem] border border-slate-100 text-center">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Food Cost %</p>
                    <p class="text-xl font-black text-rose-500">${totalVentas > 0 ? ((totalCompras/totalVentas)*100).toFixed(1) : 0}%</p>
                </div>
                <div class="bg-white p-5 rounded-[2rem] border border-slate-100 text-center">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Mochila Fija</p>
                    <p class="text-xl font-black text-slate-800">${totalFijosMensual.toFixed(0)}€</p>
                </div>
            </div>
        </div>
    `;

    // --- 3. LÓGICA DE GRÁFICAS (Chart.js) ---
    setTimeout(() => {
        // Gráfica de Barras
        new Chart(document.getElementById('chartMain'), {
            type: 'bar',
            data: {
                labels: ['Ventas', 'Compras', 'Personal', 'Fijos'],
                datasets: [{
                    data: [totalVentas, totalCompras, personalEst, totalFijosMensual],
                    backgroundColor: ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'],
                    borderRadius: 20,
                    barPercentage: 0.5
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { display: false }, x: { grid: { display: false } } }
            }
        });

        // Gráfica Donut
        new Chart(document.getElementById('chartDonut'), {
            type: 'doughnut',
            data: {
                labels: ['Compras', 'Personal', 'Fijos'],
                datasets: [{
                    data: [totalCompras, personalEst, totalFijosMensual],
                    backgroundColor: ['#f43f5e', '#10b981', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { weight: 'bold', size: 10 } } } }
            }
        });
    }, 100);

    // Exportación 303
    window.export303 = () => {
        const rows = [
            ["Borrador Modelo 303"],
            ["Concepto", "IVA"],
            ["Repercutido (Ventas)", ivaRepercutido.toFixed(2)],
            ["Soportado (Compras)", ivaSoportado.toFixed(2)],
            ["Neto", ivaNeto.toFixed(2)]
        ];
        const csv = rows.map(r => r.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "IVA_ARUME.csv";
        link.click();
    };
}
