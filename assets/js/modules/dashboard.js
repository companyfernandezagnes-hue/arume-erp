/* =============================================================
   📊 MÓDULO: DASHBOARD (Adaptado a nueva estructura)
   ============================================================= */
export function render(container, supabase, db) {
  // Limpiamos cualquier intervalo previo si existiera para evitar bucles
  if (window.dashInterval) clearInterval(window.dashInterval);

  // 1. Extraemos los datos según tu consola
  const facturas = db.facturas || [];
  const albaranes = db.albaranes || [];
  const ventas = db.sales_history || [];

  // 2. Cálculos precisos
  const totalIngresos = facturas.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
  const totalGastos = albaranes.reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);
  const balance = totalIngresos - totalGastos;

  // 3. Renderizado del HTML
  container.innerHTML = `
    <div class="animate-fade-in space-y-6">
      <header class="text-center py-4">
        <h2 class="text-2xl font-black text-slate-800">Resumen Financiero</h2>
        <p class="text-xs text-slate-500 font-bold uppercase tracking-tighter">Sincronizado con Supabase</p>
      </header>

      <div class="grid grid-cols-2 gap-4">
        <div class="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl shadow-sm">
          <p class="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest">Ingresos</p>
          <p class="text-2xl font-black text-emerald-700">${totalIngresos.toLocaleString('es-ES')}€</p>
        </div>
        <div class="bg-rose-50 border border-rose-100 p-5 rounded-3xl shadow-sm">
          <p class="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest">Gastos</p>
          <p class="text-2xl font-black text-rose-700">${totalGastos.toLocaleString('es-ES')}€</p>
        </div>
      </div>

      <div class="bg-slate-900 p-8 rounded-[2rem] shadow-2xl text-center transform hover:scale-[1.02] transition-transform">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">Balance Neto</p>
        <p class="text-5xl font-black ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${balance.toLocaleString('es-ES')}€
        </p>
      </div>

      <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <canvas id="chartBalances" height="200"></canvas>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="bg-slate-50 p-3 rounded-2xl text-center">
          <p class="text-[9px] font-bold text-slate-400 uppercase">Recetas</p>
          <p class="font-black text-slate-700">${db.recetas?.length || 0}</p>
        </div>
        <div class="bg-slate-50 p-3 rounded-2xl text-center">
          <p class="text-[9px] font-bold text-slate-400 uppercase">Stock</p>
          <p class="font-black text-slate-700">${db.ingredientes?.length || 0}</p>
        </div>
        <div class="bg-slate-50 p-3 rounded-2xl text-center">
          <p class="text-[9px] font-bold text-slate-400 uppercase">Ventas</p>
          <p class="font-black text-slate-700">${ventas.length}</p>
        </div>
      </div>
    </div>
  `;

  // 4. Gráfica
  setTimeout(() => {
    const ctx = document.getElementById('chartBalances');
    if (!ctx) return;
    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Ingresos', 'Gastos'],
        datasets: [{
          data: [totalIngresos, totalGastos],
          backgroundColor: ['#10b981', '#f43f5e'],
          hoverOffset: 10,
          borderWidth: 0
        }]
      },
      options: { 
        cutout: '80%', 
        plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 10 } } } } 
      }
    });
  }, 100);
}
