// Ejemplo de cómo pintar la vista de Amortizaciones
function renderAmortizaciones() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="animate-fade-in space-y-6">
            <header class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Amortizaciones</h2>
                    <p class="text-xs text-slate-500 uppercase tracking-widest">Control de Activos e Inmovilizado</p>
                </div>
                <button onclick="abrirModalNuevoActivo()" class="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg">
                    + NUEVO ACTIVO
                </button>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase">Gasto Mensual Actual</p>
                    <p class="text-3xl font-black text-indigo-600" id="total-amortizacion">0.00€</p>
                </div>
            </div>

            <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="p-4 text-[10px] font-black text-slate-400 uppercase">Activo</th>
                            <th class="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Importe</th>
                            <th class="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Cuota Mensual</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-activos" class="divide-y divide-slate-50">
                        </tbody>
                </table>
            </div>
        </div>
    `;
}
