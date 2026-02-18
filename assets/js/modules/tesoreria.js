/* =============================================================
   💸 MÓDULO: TESORERÍA PRO v3.0
   Cuentas por Pagar & Cobrar con Riesgo Real
   Integrado con Banco + Liquidez + ArumeEngine
   ============================================================= */

export async function render(container, sb, db) {
    const saveFn = window.save || (async()=>{});
    
    // Helpers Globales (Aseguramos compatibilidad)
    const parse = window.Num.parse;
    const fmt = window.Num.fmt;

    // Inicialización segura de datos
    if(!db.albaranes) db.albaranes = [];
    if(!db.facturas) db.facturas = [];
    if(!db.banco) db.banco = [];

    // ==========================
    // 1. NORMALIZACIÓN DE DATOS
    // ==========================
    db.albaranes.forEach(a => {
        if(a.paid === undefined) a.paid = false;
        if(!a.dueDate){
            const d = new Date(a.date);
            // Si el proveedor tiene días de crédito guardados en 'proveedores', usarlos. Si no, 30.
            // (Aquí simplificamos a 30 por defecto o lo que traiga el objeto)
            const dias = a.creditDays || 30;   
            d.setDate(d.getDate() + dias);
            a.dueDate = d.toISOString().split('T')[0];
        }
    });

    db.facturas.forEach(f => {
        if(f.paid === undefined) f.paid = false;
        if(!f.dueDate){
            // Facturas B2B: normalmente pago a 30 días
            const d = new Date(f.date);
            d.setDate(d.getDate() + 30);
            f.dueDate = d.toISOString().split('T')[0];
        }
    });

    // ==========================
    // 2. EXTRAER PENDIENTES
    // ==========================
    // Excluímos facturas que sean Cierres Z (ya que eso es caja diaria, no deuda de clientes)
    const pendientesCobrar = db.facturas.filter(f => !f.paid && !String(f.num).startsWith('Z-'));
    const pendientesPagar  = db.albaranes.filter(a => !a.paid);

    const totalCobrar = pendientesCobrar.reduce((t,f) => t + parse(f.total), 0);
    const totalPagar  = pendientesPagar.reduce((t,a) => t + parse(a.total), 0);
    const posicionNeta = totalCobrar - totalPagar;

    // ==========================
    // 3. CÁLCULO DE RIESGO
    // ==========================
    const hoy = new Date();

    function riesgo(fecha){
        const d = new Date(fecha);
        const diff = Math.ceil((d - hoy)/(1000*60*60*24));
        
        if(diff < 0) return {label: `Vencido hace ${Math.abs(diff)} días`, cls: 'text-rose-600 font-black animate-pulse', icon: '🔥'};
        if(diff <= 3) return {label: `Vence en ${diff} días`, cls: 'text-orange-500 font-bold', icon: '🟠'};
        if(diff <= 10) return {label: `Vence en ${diff} días`, cls: 'text-amber-500 font-bold', icon: '🟡'};
        return {label: `Vence en ${diff} días`, cls: 'text-slate-400', icon: '🟢'};
    }

    // ==========================
    // 4. PANEL PROVEEDORES CRÍTICOS
    // ==========================
    const mapaProveedores = {};
    pendientesPagar.forEach(a => {
        const key = a.prov || 'Varios';
        if(!mapaProveedores[key]) mapaProveedores[key] = {total:0, count:0, urgencias:[]};
        
        mapaProveedores[key].total += parse(a.total);
        mapaProveedores[key].count++;
        mapaProveedores[key].urgencias.push(riesgo(a.dueDate));
    });

    const proveedoresOrdenados = Object.entries(mapaProveedores)
        .sort(([,A],[,B]) => B.total - A.total)
        .slice(0, 3); // top 3 más críticos

    // ==========================
    // 5. RENDER UI
    // ==========================

    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Tesoreria Operativa</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Saldo Futuro · Riesgo · Obligaciones</p>
            </div>
            <div class="text-right">
                <p class="text-[9px] font-bold text-slate-400 uppercase">Posición Neta</p>
                <p class="text-3xl font-black ${posicionNeta >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
                    ${fmt(posicionNeta)}
                </p>
            </div>
        </header>

        <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 class="text-xs font-black text-slate-800 uppercase mb-4">Top Proveedores Críticos</h3>
            ${proveedoresOrdenados.map(([prov,info]) => `
                <div class="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition px-2 rounded-lg">
                    <div>
                        <div class="flex items-center gap-2">
                             <span class="text-lg">${info.urgencias.some(u=>u.icon==='🔥') ? '🔥' : (info.urgencias.some(u=>u.icon==='🟠') ? '🟠' : '🟢')}</span>
                             <p class="font-bold text-slate-700 text-sm">${prov}</p>
                        </div>
                        <p class="text-[9px] text-slate-400 mt-1 ml-7">${info.count} facturas pendientes</p>
                    </div>
                    <p class="font-black text-rose-500 text-sm">${fmt(info.total)}</p>
                </div>
            `).join('') || '<p class="text-xs text-slate-400 italic text-center py-4">No hay deudas críticas 🎉</p>'}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
                <div class="flex justify-between items-center px-2 mb-2">
                    <h3 class="font-black text-emerald-600 text-sm uppercase flex items-center gap-2">
                        ⬇️ Por Cobrar <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">${pendientesCobrar.length}</span>
                    </h3>
                    <span class="font-bold text-emerald-600 text-xs">${fmt(totalCobrar)}</span>
                </div>
                <div class="bg-emerald-50/50 p-2 rounded-3xl border border-emerald-100 min-h-[150px] space-y-2">
                    ${pendientesCobrar.length === 0 
                        ? `<div class="text-center py-10 text-emerald-300 text-xs font-bold italic">Todo cobrado ✅</div>` 
                        : pendientesCobrar.map(f => {
                            const r = riesgo(f.dueDate);
                            return `
                            <div class="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex justify-between items-center relative overflow-hidden">
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                                <div>
                                    <p class="font-bold text-slate-700 text-sm">${f.cliente || f.prov || 'Cliente'}</p>
                                    <p class="text-[9px] ${r.cls} uppercase mt-0.5">${r.label}</p>
                                    <p class="text-[8px] text-slate-400 font-mono">Ref: ${f.num}</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-black text-emerald-600 text-lg">${fmt(f.total)}</p>
                                    <button onclick="window.cobrar('${f.id}')" class="text-[9px] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-black mt-1 hover:bg-emerald-600 hover:text-white transition shadow-sm">
                                        COBRAR
                                    </button>
                                </div>
                            </div>`;
                        }).join('')
                    }
                </div>
            </div>

            <div>
                <div class="flex justify-between items-center px-2 mb-2">
                    <h3 class="font-black text-rose-500 text-sm uppercase flex items-center gap-2">
                        ⬆️ Por Pagar <span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px]">${pendientesPagar.length}</span>
                    </h3>
                    <span class="font-bold text-rose-500 text-xs">${fmt(totalPagar)}</span>
                </div>
                <div class="bg-rose-50/50 p-2 rounded-3xl border border-rose-100 min-h-[150px] space-y-2">
                    ${pendientesPagar.length === 0 
                        ? `<div class="text-center py-10 text-rose-300 text-xs font-bold italic">Sin deudas ✅</div>` 
                        : pendientesPagar.map(a => {
                            const r = riesgo(a.dueDate);
                            return `
                            <div class="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex justify-between items-center relative overflow-hidden">
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-400"></div>
                                <div>
                                    <p class="font-bold text-slate-700 text-sm">${a.prov}</p>
                                    <p class="text-[9px] ${r.cls} uppercase mt-0.5">${r.label}</p>
                                    <p class="text-[8px] text-slate-400 font-mono">Ref: ${a.num}</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-black text-rose-600 text-lg">${fmt(a.total)}</p>
                                    <button onclick="window.pagar('${a.id}')" class="text-[9px] bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg font-black mt-1 hover:bg-rose-600 hover:text-white transition shadow-sm">
                                        PAGAR
                                    </button>
                                </div>
                            </div>`;
                        }).join('')
                    }
                </div>
            </div>

        </div>
    </div>
    `;

    // ============================================================
    // 6. ACCIONES: COBRAR / PAGAR (INTEGRACIÓN TOTAL)
    // ============================================================

    window.cobrar = async (id) => {
        const fac = db.facturas.find(x => x.id === id);
        if(!fac) return;

        if(!confirm(`¿Confirmas COBRAR factura ${fac.num} por ${fmt(fac.total)}?\n\nSe creará un ingreso en el Banco.`)) return;

        fac.paid = true;
        // Integración con Banco
        db.banco.unshift({
            id: 'mov-' + Date.now(),
            date: new Date().toISOString().slice(0,10),
            desc: `Cobro factura ${fac.num} (${fac.cliente || fac.prov})`,
            amount: parse(fac.total),
            status: 'matched',
            linkType: 'FACTURA',
            linkId: fac.id
        });

        await saveFn("Cobro registrado y conciliado ✅");
        render(container, sb, db);
    };

    window.pagar = async (id) => {
        const alb = db.albaranes.find(x => x.id === id);
        if(!alb) return;

        if(!confirm(`¿Confirmas PAGAR albarán de ${alb.prov} por ${fmt(alb.total)}?\n\nSe descontará del Banco.`)) return;

        alb.paid = true;
        // Integración con Banco
        db.banco.unshift({
            id: 'mov-' + Date.now(),
            date: new Date().toISOString().slice(0,10),
            desc: `Pago proveedor ${alb.prov} (Ref: ${alb.num})`,
            amount: -Math.abs(parse(alb.total)),
            status: 'matched',
            linkType: 'ALBARAN',
            linkId: alb.id
        });

        await saveFn("Pago realizado y registrado ✅");
        render(container, sb, db);
    };
}
