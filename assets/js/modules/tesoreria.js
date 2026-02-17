/* =============================================================
   💸 MÓDULO: TESORERÍA OPERATIVA (Cuentas por Pagar/Cobrar)
   ============================================================= */

export async function render(container, sb, db) {
    const saveFn = window.save || (async () => {});

    // 1. DATA FIX: Asegurar estado de pago en Albaranes
    if (!db.albaranes) db.albaranes = [];
    db.albaranes.forEach(a => {
        // Si es antiguo y no tiene campo 'paid', asumimos false por defecto
        if (a.paid === undefined) a.paid = false;
        // Si no tiene fecha de vencimiento, asumimos 30 días fecha factura
        if (!a.dueDate) {
            const d = new Date(a.date);
            d.setDate(d.getDate() + 30);
            a.dueDate = d.toISOString().split('T')[0];
        }
    });

    // 2. FILTRAR PENDIENTES
    const cobrosPendientes = (db.facturas || []).filter(f => !f.paid).sort((a,b) => a.date.localeCompare(b.date));
    const pagosPendientes = db.albaranes.filter(a => !a.paid).sort((a,b) => a.dueDate.localeCompare(b.dueDate));

    // Totales
    const totalCobrar = cobrosPendientes.reduce((acc, f) => acc + f.total, 0);
    const totalPagar = pagosPendientes.reduce((acc, a) => acc + a.total, 0);
    const saldoNeto = totalCobrar - totalPagar;

    // Formateador
    const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    const dateFmt = (d) => {
        const date = new Date(d);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    // 3. RENDERIZADO
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Gestión de Deuda</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">CxC (Clientes) vs CxP (Proveedores)</p>
            </div>
            <div class="text-right">
                <p class="text-[9px] font-bold text-slate-400 uppercase">Posición Neta</p>
                <p class="text-3xl font-black ${saldoNeto >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${fmt(saldoNeto)}</p>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div class="space-y-4">
                <div class="flex justify-between items-center px-2">
                    <h3 class="font-black text-emerald-600 text-sm uppercase flex items-center gap-2">
                        ⬇️ Por Cobrar <span class="bg-emerald-100 text-emerald-700 px-2 rounded-full text-[10px]">${cobrosPendientes.length}</span>
                    </h3>
                    <span class="font-bold text-emerald-600 text-xs">${fmt(totalCobrar)}</span>
                </div>

                <div class="bg-emerald-50/50 rounded-2xl p-2 border border-emerald-100 min-h-[200px]">
                    ${cobrosPendientes.length === 0 
                        ? `<div class="text-center py-10 text-emerald-300 text-xs font-bold italic">Todo cobrado ✅</div>` 
                        : cobrosPendientes.map(f => `
                        <div class="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm mb-2 flex justify-between items-center group relative overflow-hidden">
                            <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                            <div>
                                <div class="font-bold text-slate-700 text-sm">${f.prov || 'Cliente Varios'}</div>
                                <div class="text-[10px] text-slate-400 font-mono">Fra: ${f.num} · ${dateFmt(f.date)}</div>
                            </div>
                            <div class="text-right">
                                <div class="font-black text-emerald-600">${fmt(f.total)}</div>
                                <button onclick="window.saldarCobro('${f.id}', ${f.total})" class="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold hover:bg-emerald-600 hover:text-white transition mt-1">
                                    COBRAR
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="space-y-4">
                <div class="flex justify-between items-center px-2">
                    <h3 class="font-black text-rose-500 text-sm uppercase flex items-center gap-2">
                        ⬆️ Por Pagar <span class="bg-rose-100 text-rose-700 px-2 rounded-full text-[10px]">${pagosPendientes.length}</span>
                    </h3>
                    <span class="font-bold text-rose-500 text-xs">${fmt(totalPagar)}</span>
                </div>

                <div class="bg-rose-50/50 rounded-2xl p-2 border border-rose-100 min-h-[200px]">
                    ${pagosPendientes.length === 0 
                        ? `<div class="text-center py-10 text-rose-300 text-xs font-bold italic">Sin deudas pendientes ✅</div>` 
                        : pagosPendientes.map(a => {
                            // Alerta de vencimiento
                            const due = new Date(a.dueDate);
                            const today = new Date();
                            const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                            let urgency = 'text-slate-400';
                            if(diffDays < 0) urgency = 'text-red-600 font-black animate-pulse'; // Vencido
                            else if(diffDays < 3) urgency = 'text-orange-500 font-bold'; // Urgente

                            return `
                            <div class="bg-white p-3 rounded-xl border border-rose-100 shadow-sm mb-2 flex justify-between items-center relative overflow-hidden">
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-400"></div>
                                <div>
                                    <div class="font-bold text-slate-700 text-sm">${a.prov}</div>
                                    <div class="text-[10px] ${urgency}">
                                        ${diffDays < 0 ? `Venció hace ${Math.abs(diffDays)} días` : `Vence en ${diffDays} días`}
                                    </div>
                                    <div class="text-[9px] text-slate-400 mt-0.5">Ref: ${a.num}</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-black text-rose-500">${fmt(a.total)}</div>
                                    <button onclick="window.saldarPago('${a.id}', '${a.prov.replace(/'/g,"\\'")}', ${a.total})" class="text-[9px] bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold hover:bg-rose-600 hover:text-white transition mt-1">
                                        PAGAR
                                    </button>
                                </div>
                            </div>
                        `}).join('')}
                </div>
            </div>

        </div>
    </div>
    `;

    // 4. LÓGICA DE COBRO (Ingreso en Banco)
    window.saldarCobro = async (id, amount) => {
        if(!confirm(`¿Marcar factura como COBRADA?\nSe añadirá un ingreso de ${amount}€ al Banco.`)) return;
        
        // 1. Marcar factura
        const f = db.facturas.find(x => x.id === id);
        if(f) f.paid = true;

        // 2. Mover dinero al banco
        if (!db.banco) db.banco = [];
        db.banco.unshift({
            id: 'cobro-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            desc: `Cobro Factura ${f.num} (${f.prov})`,
            amount: amount, // Positivo
            cat: 'Ventas',
            status: 'conciliado_auto'
        });

        await saveFn("Cobro registrado y conciliado ✅");
        render(container, sb, db);
    };

    // 5. LÓGICA DE PAGO (Salida de Banco)
    window.saldarPago = async (id, prov, amount) => {
        if(!confirm(`¿Marcar albarán como PAGADO?\nSe descontarán ${amount}€ del Banco.`)) return;

        // 1. Marcar albarán
        const a = db.albaranes.find(x => x.id === id);
        if(a) a.paid = true;

        // 2. Mover dinero del banco
        if (!db.banco) db.banco = [];
        db.banco.unshift({
            id: 'pago-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            desc: `Pago Proveedor: ${prov} (Ref: ${a.num})`,
            amount: -Math.abs(amount), // Negativo
            cat: 'Compras',
            status: 'conciliado_auto'
        });

        await saveFn("Pago realizado y registrado ✅");
        render(container, sb, db);
    };
}
