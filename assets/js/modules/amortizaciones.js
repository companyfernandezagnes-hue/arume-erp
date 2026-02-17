/* =============================================================
   📦 MÓDULO: AMORTIZACIONES (assets/js/modules/amortizaciones.js)
   ============================================================= */

export async function render(container, sb, db) {
    // 1. Inicializar array si no existe
    if (!db.activos) db.activos = [];

    // 2. Calcular total mensual dinámico
    // Usamos la lógica de (Importe / Vida / 12)
    const totalMensual = db.activos.reduce((acc, a) => acc + (a.cuota || 0), 0);

    // 3. Renderizar la Interfaz (UI Diamond)
    container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            <header class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Amortizaciones</h2>
                    <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Inmovilizado & Maquinaria
                    </p>
                </div>
                <button onclick="window.abrirModalNuevoActivo()" 
                    class="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition transform hover:scale-105">
                    + NUEVO ACTIVO
                </button>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Mensual (Gasto)</p>
                    <p class="text-3xl font-black text-indigo-600">${totalMensual.toFixed(2)}€</p>
                    <p class="text-[9px] text-slate-400 mt-2">Este importe se restará de tu beneficio mensual.</p>
                </div>
            </div>

            <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="p-5 text-[9px] font-black text-slate-400 uppercase tracking-wider">Activo</th>
                                <th class="p-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Valor Compra</th>
                                <th class="p-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Vida (Años)</th>
                                <th class="p-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Cuota Mes</th>
                                <th class="p-5"></th>
                            </tr>
                        </thead>
                        <tbody id="tabla-activos" class="divide-y divide-slate-50">
                            ${db.activos.length === 0 ? `
                                <tr><td colspan="5" class="p-8 text-center text-xs text-slate-400 italic">No tienes activos registrados. Añade tu maquinaria (Horno, Neveras...).</td></tr>
                            ` : db.activos.map(a => `
                                <tr class="hover:bg-slate-50 transition">
                                    <td class="p-5">
                                        <p class="font-bold text-slate-700 text-sm">${a.nombre}</p>
                                        <p class="text-[9px] text-slate-400">${a.fecha || 'Sin fecha'}</p>
                                    </td>
                                    <td class="p-5 text-right font-mono text-xs text-slate-600">${parseFloat(a.importe).toFixed(2)}€</td>
                                    <td class="p-5 text-center font-bold text-xs text-slate-500">${a.vida}</td>
                                    <td class="p-5 text-right font-mono text-xs font-black text-indigo-600">-${parseFloat(a.cuota).toFixed(2)}€</td>
                                    <td class="p-5 text-right">
                                        <button onclick="window.eliminarActivo('${a.id}')" 
                                            class="w-8 h-8 rounded-full flex items-center justify-center bg-rose-50 text-rose-500 hover:bg-rose-100 hover:scale-110 transition">
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // 4. Funciones Globales (Para que los onclick funcionen)
    
    // Función: Eliminar
    window.eliminarActivo = async (id) => {
        if (!confirm("¿Seguro que quieres dar de baja este activo?")) return;
        db.activos = db.activos.filter(a => a.id !== id);
        await window.save("Activo eliminado"); // Usamos tu window.save global
        render(container, sb, db); // Recargamos la vista
    };

    // Función: Abrir Modal
    window.abrirModalNuevoActivo = () => {
        // Evitar abrirlo dos veces
        if(document.getElementById('modalNuevoActivo')) return;

        const modal = document.createElement('div');
        modal.id = "modalNuevoActivo";
        modal.className = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in";
        
        modal.innerHTML = `
            <div class="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative animate-slide-up">
                <button onclick="document.getElementById('modalNuevoActivo').remove()" class="absolute top-5 right-5 text-slate-300 hover:text-slate-600 transition">✕</button>
                
                <h3 class="text-xl font-black text-slate-800 mb-1">Nuevo Activo</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase mb-6">Alta de Inmovilizado</p>

                <div class="space-y-4">
                    <div>
                        <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-2">Nombre del equipo</label>
                        <input id="act-nombre" class="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" placeholder="Ej. Horno Rational">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-2">Coste (€)</label>
                            <input id="act-importe" type="number" class="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-2">Vida (Años)</label>
                            <input id="act-vida" type="number" class="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition" placeholder="Ej. 10">
                        </div>
                    </div>

                    <button onclick="window.guardarActivo()" class="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition mt-2">
                        GUARDAR ACTIVO
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    // Función: Guardar (Lógica interna del modal)
    window.guardarActivo = async () => {
        const nombre = document.getElementById('act-nombre').value;
        const importe = parseFloat(document.getElementById('act-importe').value);
        const vida = parseInt(document.getElementById('act-vida').value);

        if (!nombre || isNaN(importe) || isNaN(vida) || vida <= 0) {
            alert("⚠️ Por favor revisa los datos. La vida útil debe ser mayor a 0.");
            return;
        }

        // Cálculo de la cuota mensual lineal
        const cuota = importe / (vida * 12);

        db.activos.push({
            id: Date.now().toString(),
            nombre,
            importe,
            vida,
            cuota,
            fecha: new Date().toISOString().split('T')[0] // Fecha de hoy YYYY-MM-DD
        });

        await window.save("Activo guardado correctamente");
        
        // Cerrar y recargar
        document.getElementById('modalNuevoActivo').remove();
        render(container, sb, db);
    };
}
