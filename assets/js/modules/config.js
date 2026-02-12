/* =============================================================
   ⚙️ MÓDULO: CONFIGURACIÓN Y SISTEMA (La Rueda Mecánica)
   ============================================================= */
export async function render(container, supabase, db) {
    
    container.innerHTML = `
        <div class="animate-fade-in p-6 space-y-6 max-w-2xl mx-auto">
            <header class="mb-8">
                <h2 class="text-2xl font-black text-slate-800">Configuración</h2>
                <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest">Ajustes del Sistema Arume</p>
            </header>

            <div class="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-4">
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mantenimiento de Datos</h3>
                
                <button id="btnSync" class="w-full flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 transition group">
                    <span class="font-bold text-slate-700 group-hover:text-indigo-600">Forzar Sincronización Cloud</span>
                    <span class="text-xl">🔄</span>
                </button>

                <button id="btnExportAll" class="w-full flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-emerald-50 transition group">
                    <span class="font-bold text-slate-700 group-hover:text-emerald-600">Copia de Seguridad Completa (JSON)</span>
                    <span class="text-xl">💾</span>
                </button>
            </div>

            <div class="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Objetivos de Negocio</h3>
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 ml-2">Ventas Estimadas / Mes (€)</label>
                        <input id="cfgSales" type="number" value="${db.config?.ventas_objetivo || 30000}" class="w-full p-4 bg-slate-50 rounded-2xl border-0 font-black mt-1">
                    </div>
                    <button id="btnSaveConfig" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR AJUSTES</button>
                </div>
            </div>

            <div class="text-center pt-10">
                <p class="text-[10px] font-black text-slate-300 uppercase">Arume V152 Diamond Edition</p>
                <p class="text-[9px] text-slate-300 italic">Última sincronización: ${new Date(db.lastSync).toLocaleString()}</p>
            </div>
        </div>
    `;

    // --- LÓGICA ---

    // 1. Forzar Sincronización
    container.querySelector("#btnSync").onclick = () => {
        location.reload(); // La forma más segura de refrescar todo desde Supabase
    };

    // 2. Exportar todo para el gestor o seguridad
    container.querySelector("#btnExportAll").onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "Arume_Backup_Total.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // 3. Guardar configuración
    container.querySelector("#btnSaveConfig").onclick = async () => {
        if (!db.config) db.config = {};
        db.config.ventas_objetivo = parseFloat(document.getElementById("cfgSales").value);
        
        await window.save("Configuración actualizada ✅");
        alert("Ajustes guardados. El Dashboard ahora usará estos objetivos.");
    };
}
