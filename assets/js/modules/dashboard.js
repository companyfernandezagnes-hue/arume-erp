/* =============================================================
   📊 MÓDULO: DASHBOARD
   ============================================================= */
export async function render(container, supabase) {
  container.innerHTML = `
    <section class="p-6 bg-white rounded-3xl shadow text-center mb-6">
      <h2 class="text-xl font-black mb-3">Dashboard Financiero</h2>
      <p class="text-sm text-slate-500">Resumen general de tu actividad</p>
    </section>

    <div id="dashCards" class="grid grid-cols-2 gap-4 mb-6"></div>
    <canvas id="chartBalances" class="bg-white rounded-3xl shadow p-4"></canvas>
  `;

  try {
    const [facturas, albaranes] = await Promise.all([
      supabase.from("facturas").select("*"),
      supabase.from("albaranes").select("*")
    ]);

    const ingresos = facturas.data ? facturas.data.reduce((t, f) => t + (parseFloat(f.total) || 0), 0) : 0;
    const gastos = albaranes.data ? albaranes.data.reduce((t, a) => t + (parseFloat(a.total) || 0), 0) : 0;
    const balance = ingresos - gastos;

    document.getElementById("dashCards").innerHTML = `
      <div class="bg-emerald-50 text-emerald-600 p-4 rounded-2xl shadow text-center">
        <p class="text-xs uppercase font-bold">Ingresos</p>
        <p class="text-2xl font-black">${ingresos.toLocaleString("es-ES", {minimumFractionDigits:2})}€</p>
      </div>
      <div class="bg-rose-50 text-rose-600 p-4 rounded-2xl shadow text-center">
        <p class="text-xs uppercase font-bold">Gastos</p>
        <p class="text-2xl font-black">${gastos.toLocaleString("es-ES", {minimumFractionDigits:2})}€</p>
      </div>
      <div class="col-span-2 bg-indigo-50 text-indigo-600 p-4 rounded-2xl shadow text-center">
        <p class="text-xs uppercase font-bold">Balance</p>
        <p class="text-3xl font-black">${balance.toLocaleString("es-ES", {minimumFractionDigits:2})}€</p>
      </div>
    `;

    drawChart(ingresos, gastos);
  } catch (error) {
    console.error(error);
    container.innerHTML += `<p class="text-center text-red-500 mt-4">⚠️ Error cargando datos del dashboard</p>`;
  }
}

/* =============================================================
   📉 GRÁFICA DE BALANCE
   ============================================================= */
function drawChart(ingresos, gastos) {
  const ctx = document.getElementById("chartBalances");
  if (!ctx) return;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Ingresos", "Gastos"],
      datasets: [
        {
          data: [ingresos, gastos],
          backgroundColor: ["#34d399", "#f87171"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}
