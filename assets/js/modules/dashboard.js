/* =============================================================
   📊 MÓDULO: DASHBOARD (Centro de Mando "Diamond")
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    // 1. CALCULADORA DE DATOS EN TIEMPO REAL
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();

    // Filtros de fecha
    const esMesActual = (d) => { const x = new Date(d); return x.getMonth() === mesActual && x.getFullYear() === yearActual; };
    
    // A) VENTAS (Facturas + Caja)
    // Nota: Aquí sumamos facturas emitidas. Si usas caja diaria, deberías sumar 'diario' también.
    // Para este ejemplo sumamos facturas emitidas en el mes.
    const ventasMes = (db.facturas || []).filter(f => esMesActual(f.date)).reduce((acc, f) => acc + (parseFloat(f.total)||0), 0);
    
    // B) GASTOS VARIABLES (Albaranes)
    const gastosMes = (db.albaranes || []).filter(a => esMesActual(a.date)).reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);
    
    // C) GASTOS FIJOS (Prorrateo Mensual)
    const fijosMes = (db.gastos_fijos || []).reduce((acc, g) => {
        let val = parseFloat(g.amount) || 0;
        if(g.freq === 'anual') val /= 12;
        if(g.freq === 'trimestral') val /= 3;
        return acc + val;
    }, 0);

    // D) BENEFICIO NETO ESTIMADO
    const beneficio = ventasMes - gastosMes - fijosMes;

    // E) FISCALIDAD (Estimación rápida)
    const ivaRepercutido = (db.facturas || []).reduce((acc, f) => {
        const base = f.base || (parseFloat(f.total)/1.10); 
        return acc + (parseFloat(f.total) - base);
    }, 0);
    const ivaSoportado = (db.albaranes || []).reduce((acc, a) => acc + (parseFloat(a.taxes)||0), 0);
    const deudaHacienda = ivaRepercutido - ivaSoportado;

    // F) OBJETIVOS
    const meta = db.config?.objetivoMensual || 30000;
    const porcentajeMeta = Math.min((ventasMes / meta) * 100, 100).toFixed(0);

    // 2. INTERFAZ BENTO GRID
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-20">
        
        <div class="flex justify-between items-end px-2">
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">${hoy.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'})}</p>
                <h2 class="text-3xl font-black text-slate-800">Hola, Gerencia 👋</h2>
            </div>
            <div class="text-right">
                <p class="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    🟢 SISTEMA ONLINE
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden md:col-span-2">
                <div class="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-[60px] opacity-30 -mr-10 -mt-10"></div>
                
                <div class="flex justify-between items-start relative z-10">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ventas este Mes</p>
                        <h3 class="text-4xl font-black mb-4">${fmt(ventasMes)}</h3>
                        
                        <div class="w-full max-w-[200px]">
                            <div class="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                                <span>Progreso</span>
                                <span>${porcentajeMeta}% de ${fmt(meta)}</span>
                            </div>
                            <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-1000" style="width: ${porcentajeMeta}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                        <span class="text-2xl">🏆</span>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase">Beneficio Neto (Est.)</p>
                        <h3 class="text-2xl font-black ${beneficio >= 0 ? 'text-slate-800' : 'text-rose-500'}">${fmt(beneficio)}</h3>
                    </div>
                    <span class="text-2xl group-hover:scale-110 transition">🚀</span>
                </div>
                <div class="mt-4 space-y-1">
                    <div class="flex justify-between text-[10px] text-slate-400">
                        <span>Gastos Var.</span>
                        <span class="font-bold text-rose-400">-${fmt(gastosMes)}</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-slate-400">
                        <span>Fijos (Est.)</span>
                        <span class="font-bold text-amber-400">-${fmt(fijosMes)}</span>
                    </div>
                </div>
            </div>

            <div onclick="loadModule('fiscalidad')" class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50 transition relative overflow-hidden">
                <div class="absolute bottom-0 left-0 w-full h-1 ${deudaHacienda > 0 ? 'bg-rose-500' : 'bg-emerald-500'}"></div>
                <div class="flex justify-between items-start mb-2">
                    <p class="text-[10px] font-black text-slate-400 uppercase">Situación IVA Global</p>
                    <span class="text-xl">⚖️</span>
                </div>
                <h3 class="text-2xl font-black ${deudaHacienda > 0 ? 'text-rose-500' : 'text-emerald-500'}">
                    ${deudaHacienda > 0 ? 'A Pagar' : 'A Devolver'}
                </h3>
                <p class="text-sm font-bold text-slate-600">${fmt(Math.abs(deudaHacienda))}</p>
                <p class="text-[9px] text-slate-400 mt-2">Pulsa para ver detalle</p>
            </div>

        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="font-black text-slate-800">Últimos Movimientos</h3>
                    <button onclick="loadModule('banco')" class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full hover:bg-indigo-100 transition">VER TODO</button>
                </div>
                
                <div class="space-y-3">
                    ${(db.banco || []).slice(0, 3).map(b => `
                        <div class="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition border-b border-slate-50 last:border-0">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${b.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                                    ${b.amount > 0 ? '↓' : '↑'}
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-slate-700 truncate w-40 md:w-60">${b.desc}</p>
                                    <p class="text-[9px] text-slate-400">${b.date}</p>
                                </div>
                            </div>
                            <span class="text-xs font-black ${b.amount > 0 ? 'text-emerald-600' : 'text-slate-800'}">${fmt(b.amount)}</span>
                        </div>
                    `).join('') || '<p class="text-center text-xs text-slate-300 italic py-4">Sin movimientos bancarios recientes</p>'}
                </div>
            </div>

            <div class="space-y-3">
                <button onclick="loadModule('albaranes')" class="w-full p-4 bg-indigo-600 text-white rounded-[2rem] shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition flex items-center justify-between group">
                    <span class="text-xs font-black uppercase ml-2">Escanear Factura</span>
                    <span class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm group-hover:rotate-12 transition">📸</span>
                </button>

                <button onclick="loadModule('facturas')" class="w-full p-4 bg-white border border-slate-200 text-slate-700 rounded-[2rem] hover:bg-slate-50 active:scale-95 transition flex items-center justify-between">
                    <span class="text-xs font-black uppercase ml-2">Crear Venta</span>
                    <span class="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm">📄</span>
                </button>
                
                <div class="bg-amber-50 p-4 rounded-[2rem] border border-amber-100">
                    <p class="text-[9px] font-black text-amber-400 uppercase mb-1">Recordatorio</p>
                    <p class="text-xs font-bold text-amber-800 leading-tight">Revisa los ${(db.albaranes||[]).filter(a=>!a.invoiced).length} albaranes pendientes de facturar.</p>
                </div>
            </div>

        </div>
    </div>
    `;

    function fmt(n) { return Number(n).toLocaleString('es-ES', {style:'currency', currency:'EUR'}); }
}
