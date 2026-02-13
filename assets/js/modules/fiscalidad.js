/* =============================================================
   ⚖️ MÓDULO: FISCALIDAD (Simulador de Impuestos / Modelo 303)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    // 1. Inicialización de Datos
    if (!db.facturas) db.facturas = [];
    if (!db.albaranes) db.albaranes = [];

    // Determinar Trimestre Actual
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    let currentQ = 1;
    if (currentMonth > 2) currentQ = 2;
    if (currentMonth > 5) currentQ = 3;
    if (currentMonth > 8) currentQ = 4;
    
    let selectedQ = currentQ;
    let selectedYear = today.getFullYear();

    // 2. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-20 -mr-16 -mt-16"></div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 class="text-2xl font-black">Fiscalidad & IVA</h2>
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Simulador Modelo 303</p>
                </div>

                <div class="flex bg-slate-800 p-1 rounded-xl">
                    <button class="q-btn px-4 py-2 rounded-lg text-xs font-black transition ${selectedQ===1?'bg-indigo-600 text-white':'text-slate-400'}" data-q="1">1T</button>
                    <button class="q-btn px-4 py-2 rounded-lg text-xs font-black transition ${selectedQ===2?'bg-indigo-600 text-white':'text-slate-400'}" data-q="2">2T</button>
                    <button class="q-btn px-4 py-2 rounded-lg text-xs font-black transition ${selectedQ===3?'bg-indigo-600 text-white':'text-slate-400'}" data-q="3">3T</button>
                    <button class="q-btn px-4 py-2 rounded-lg text-xs font-black transition ${selectedQ===4?'bg-indigo-600 text-white':'text-slate-400'}" data-q="4">4T</button>
                </div>
            </div>

            <div class="mt-8 text-center relative z-10">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resultado Estimado del Trimestre</p>
                <h3 id="lbl-resultado" class="text-5xl md:text-6xl font-black tracking-tight text-white mb-2">0.00€</h3>
                <span id="lbl-estado" class="px-4 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    A DEVOLVER (HACIENDA TE PAGA)
                </span>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">📈</div>
                <h4 class="text-xs font-black text-slate-400 uppercase mb-4">IVA Repercutido (Ventas)</h4>
                <div class="flex justify-between items-end mb-2">
                    <span class="text-3xl font-black text-slate-800" id="lbl-iva-ventas">0€</span>
                    <span class="text-xs font-bold text-slate-400 mb-1">Lo que has cobrado</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div id="bar-ventas" class="h-full bg-indigo-500 w-0 transition-all duration-1000"></div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">📉</div>
                <h4 class="text-xs font-black text-slate-400 uppercase mb-4">IVA Soportado (Gastos)</h4>
                <div class="flex justify-between items-end mb-2">
                    <span class="text-3xl font-black text-slate-800" id="lbl-iva-gastos">0€</span>
                    <span class="text-xs font-bold text-slate-400 mb-1">Lo que deduces</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div id="bar-gastos" class="h-full bg-emerald-500 w-0 transition-all duration-1000"></div>
                </div>
            </div>
        </div>

        <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-80">
            <canvas id="chartFiscal"></canvas>
        </div>
        
        <div class="text-center p-4">
            <p class="text-[10px] text-slate-400">Nota: Cálculo aproximado basado en Facturas emitidas y Albaranes registrados.</p>
        </div>
    </div>
    `;

    // 3. LÓGICA DE CÁLCULO
    let chartInstance = null;

    const calcular = () => {
        // Rango de fechas del trimestre seleccionado
        const startMonth = (selectedQ - 1) * 3;
        const endMonth = startMonth + 2;
        
        // 1. CALCULAR IVA REPERCUTIDO (VENTAS/FACTURAS)
        const facturasQ = db.facturas.filter(f => {
            const d = new Date(f.date);
            return d.getFullYear() === selectedYear && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
        });

        // Si la factura no tiene 'tax' guardado explícitamente, lo calculamos (Asumiendo 10% hostelería por defecto si falta)
        const totalVentasBruto = facturasQ.reduce((acc, f) => acc + (parseFloat(f.total)||0), 0);
        const totalVentasBase = facturasQ.reduce((acc, f) => acc + (f.base || (parseFloat(f.total)/1.10)), 0);
        const ivaRepercutido = totalVentasBruto - totalVentasBase;

        // 2. CALCULAR IVA SOPORTADO (GASTOS/ALBARANES)
        const albaranesQ = db.albaranes.filter(a => {
            const d = new Date(a.date);
            return d.getFullYear() === selectedYear && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
        });

        const ivaSoportado = albaranesQ.reduce((acc, a) => acc + (parseFloat(a.taxes) || 0), 0);
        
        // 3. RESULTADO
        const resultado = ivaRepercutido - ivaSoportado;

        // 4. PINTAR DATOS
        container.querySelector("#lbl-iva-ventas").innerText = ivaRepercutido.toLocaleString('es-ES', {style:'currency', currency:'EUR'});
        container.querySelector("#lbl-iva-gastos").innerText = ivaSoportado.toLocaleString('es-ES', {style:'currency', currency:'EUR'});
        
        const lblRes = container.querySelector("#lbl-resultado");
        const lblState = container.querySelector("#lbl-estado");

        lblRes.innerText = resultado.toLocaleString('es-ES', {style:'currency', currency:'EUR'});
        
        if (resultado > 0) {
            lblRes.className = "text-5xl md:text-6xl font-black tracking-tight text-rose-400 mb-2";
            lblState.className = "px-4 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30";
            lblState.innerText = "A PAGAR (HACIENDA COBRA)";
        } else {
            lblRes.className = "text-5xl md:text-6xl font-black tracking-tight text-emerald-400 mb-2";
            lblState.className = "px-4 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
            lblState.innerText = "A DEVOLVER / COMPENSAR";
        }

        // Animación barras
        const max = Math.max(ivaRepercutido, ivaSoportado) || 1;
        setTimeout(() => {
            container.querySelector("#bar-ventas").style.width = `${(ivaRepercutido/max)*100}%`;
            container.querySelector("#bar-gastos").style.width = `${(ivaSoportado/max)*100}%`;
        }, 100);

        renderChart(ivaRepercutido, ivaSoportado);
    };

    // 4. GRÁFICA CHART.JS
    const renderChart = (ventas, gastos) => {
        const ctx = container.querySelector('#chartFiscal').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['IVA Repercutido (Cobrado)', 'IVA Soportado (Pagado)'],
                datasets: [{
                    label: 'Impuestos (€)',
                    data: [ventas, gastos],
                    backgroundColor: ['#6366f1', '#10b981'],
                    borderRadius: 20,
                    barThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    };

    // Eventos Trimestres
    container.querySelectorAll('.q-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.q-btn').forEach(b => {
                b.classList.remove('bg-indigo-600', 'text-white');
                b.classList.add('text-slate-400');
            });
            btn.classList.remove('text-slate-400');
            btn.classList.add('bg-indigo-600', 'text-white');
            selectedQ = parseInt(btn.dataset.q);
            calcular();
        };
    });

    // Iniciar
    calcular();
}
