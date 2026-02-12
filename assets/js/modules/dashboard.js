// assets/js/modules/dashboard.js

export function render(container, supabase, db) {
    // Usamos los nombres de carpetas que vimos en tu consola
    const facturas = db.facturas || [];
    const albaranes = db.albaranes || [];

    const ingresos = facturas.reduce((t, f) => t + (parseFloat(f.total) || 0), 0);
    const gastos = albaranes.reduce((t, a) => t + (parseFloat(a.total) || 0), 0);
    const balance = ingresos - gastos;

    container.innerHTML = `
        <section style="background:white; border-radius:20px; padding:20px; text-align:center; margin-bottom:20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="font-weight:800; margin-bottom:5px;">Dashboard Financiero</h2>
            <p style="color:#64748b; font-size:14px;">Resumen de tu actividad real</p>
        </section>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
            <div style="background:#ecfdf5; color:#059669; padding:20px; border-radius:15px; text-align:center;">
                <p style="font-size:12px; font-weight:700; text-transform:uppercase;">Ingresos</p>
                <p style="font-size:24px; font-weight:900;">${ingresos.toLocaleString()}€</p>
            </div>
            <div style="background:#fff1f2; color:#e11d48; padding:20px; border-radius:15px; text-align:center;">
                <p style="font-size:12px; font-weight:700; text-transform:uppercase;">Gastos</p>
                <p style="font-size:24px; font-weight:900;">${gastos.toLocaleString()}€</p>
            </div>
            <div style="grid-column: span 2; background:#eef2ff; color:#4f46e5; padding:20px; border-radius:15px; text-align:center;">
                <p style="font-size:12px; font-weight:700; text-transform:uppercase;">Balance Total</p>
                <p style="font-size:32px; font-weight:900;">${balance.toLocaleString()}€</p>
            </div>
        </div>

        <canvas id="chartBalances" style="background:white; border-radius:20px; padding:15px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"></canvas>
    `;

    // Dibujar la gráfica
    setTimeout(() => {
        const ctx = document.getElementById('chartBalances');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ingresos', 'Gastos'],
                datasets: [{
                    data: [ingresos, gastos],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '70%', plugins: { legend: { position: 'bottom' } } }
        });
    }, 100);
}
