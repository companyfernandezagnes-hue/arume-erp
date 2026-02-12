/* =============================================================
   📊 MÓDULO: DASHBOARD (Adaptado a nueva estructura)
   ============================================================= */
export function render(container, supabase, db) {
  // 1. ESTRUCTURA HTML
  container.innerHTML = `
    <div class="animate-fade-in">
        <section class="p-6 bg-white rounded-3xl shadow text-center mb-6">
            <h2 class="text-xl font-black mb-1">Dashboard Financiero</h2>
            <p class="text-sm text-slate-500">Resumen general de tu actividad</p>
        </section>

        <div id="dashCards" class="grid grid-cols-2 gap-4 mb-6">
            </div>

        <div class="bg-white rounded-3xl shadow p-4">
            <h3 class="text-xs font-bold text-slate-400 uppercase mb-4 text-center">Distribución</h3>
            <canvas id="chartBalances"></canvas>
        </div>
    </div>
  `;

  // 2. CÁLCULO DE DATOS
  // En lugar de llamar a Supabase, usamos 'db' que ya tiene los datos
  const facturas = db.facturas || [];
  const albaranes = db.albaranes || [];

  // Sumatorios
  const ingresos = facturas.reduce((t, f) => t + (parseFloat(f.total) || 0), 0);
  const gastos = albaranes.reduce((t, a) => t + (parseFloat(a.total) || 0), 0);
  const balance = ingresos - gastos;

  // Formateador de moneda
  const fmt = (num) => num.toLocaleString("es-ES", {minimumFractionDigits:2, maximumFractionDigits:2}) + '€';

  // 3. PINTAR TARJETAS
  const cardsContainer = document.getElementById("dashCards");
  if(cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="bg-emerald-50 text-emerald-600 p-4 rounded-2xl shadow text-center border border-emerald-100">
            <p class="text-xs uppercase font-bold">Ingresos</p>
            <p class="text-2xl font-black mt-1">${fmt(ingresos)}</p>
        </div>
        <div class="bg-rose-50 text-rose-600 p-4 rounded-2xl shadow text-center border border-rose-100">
            <p class="text-xs uppercase font-bold">Gastos</p>
            <p class="text-2xl font-black mt-1">${fmt(gastos)}</p>
        </div>
        <div class="col-span-2 bg-indigo-50 text-indigo-600 p-4 rounded-2xl shadow text-center border border-indigo-100">
            <p class="text-xs uppercase font-bold">Balance Total</p>
            <p class="text-4xl font-black mt-1">${fmt(balance)}</p>
        </div>
      `;
  }

  // 4. DIBUJAR GRÁFICA (Con pequeño retardo para asegurar que el canvas existe)
  setTimeout(() => {
      drawChart(ingresos, gastos);
  }, 100);
}

/* =============================================================
   📉 FUNCIÓN DE GRÁFICA (Chart.js)
   ============================================================= */
function drawChart(ingresos, gastos) {
  const ctx = document.getElementById("chartBalances");
  
  // Si no hay datos, mostramos gráfico vacío o salimos
  if (!ctx) return;
  
  // Destruir gráfico previo si existe (para evitar errores al recargar)
  if (window.myDashboardChart) {
      window.myDashboardChart.destroy();
  }

  // Crear nuevo gráfico
  window.myDashboardChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Ingresos", "Gastos"],
      datasets: [
        {
          data: [ingresos, gastos],
          backgroundColor: ["#34d399", "#f87171"], // Colores Emerald y Rose
          hoverOffset: 4,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: '70%', // Hace el agujero del donut más grande
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}
