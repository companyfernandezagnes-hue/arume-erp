/* =============================================================
   📦 MÓDULO: STOCK (Recuperación de Inventario)
   ============================================================= */
export function render(container, supabase, db) {
    // 1. Extraemos los ingredientes de la base de datos descargada
    const lista = db.ingredientes || [];

    // 2. Creamos la estructura visual
    container.innerHTML = `
        <div class="animate-fade-in">
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Almacén</h2>
                    <p class="text-sm text-slate-500">${lista.length} productos en total</p>
                </div>
            </header>

            <div class="grid gap-3">
                ${lista.length === 0 ? `
                    <div class="p-10 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <p class="text-slate-400 font-bold">No hay datos en la carpeta 'ingredientes'</p>
                    </div>
                ` : lista.sort((a,b) => a.n.localeCompare(b.n)).map(i => `
                    <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div>
                            <p class="font-bold text-slate-800 text-base">${i.n}</p>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${i.fam || 'General'}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-black text-indigo-600 text-lg">${parseFloat(i.stock).toFixed(2)} <span class="text-xs text-slate-400 font-normal">${i.unit}</span></p>
                            <p class="text-[10px] font-bold text-slate-400">${(parseFloat(i.cost) || 0).toFixed(2)}€/ud</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
