/* =============================================================
   📈 MÓDULO: INFORMES & P&L PRO (Inteligencia Fiscal)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. OBTENCIÓN DE DATOS CENTRALIZADOS
    const albaranes = db.albaranes || []; // Tus Compras (IVA Soportado)
    const cierres = db.cierres || [];     // Tus Ventas (IVA Repercutido)
    const fijos = db.gastosFijos || [];   // Gastos Estructurales

    // Filtros de Tiempo
    let year = new Date().getFullYear();
    // Calculamos trimestre actual (1, 2, 3, 4)
    let trimActual = Math.ceil((new Date().getMonth() + 1) / 3);
    let trimestre = "T" + trimActual;

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Inteligencia Financiera</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">P&L + Liquidación IVA</p>
            </div>
            
            <div class="flex items-center gap-4">
                <div class="flex bg-slate-100 p-1 rounded-xl">
                    <button onclick="window.changeTrim('T1')" class="trim-btn px-3 py-1 rounded-lg text-[10px] font-bold ${trimestre=='T1'?'bg-white shadow text-indigo-600':'text-slate-400'}">T1</button>
                    <button onclick="window.changeTrim('T2')" class="trim-btn px-3 py-1 rounded-lg text-[10px] font-bold ${trimestre=='T2'?'bg-white shadow text-indigo-600':'text-slate-400'}">T2</button>
                    <button onclick="window.changeTrim('T3')" class="trim-btn px-3 py-1 rounded-lg text-[10px] font-bold ${trimestre=='T3'?'bg-white shadow text-indigo-600':'text-slate-400'}">T3</button>
                    <button onclick="window.changeTrim('T4')" class="trim-btn px-3 py-1 rounded-lg text-[10px] font-bold ${trimestre=='T4'?'bg-white shadow text-indigo-600':'text-slate-400'}">T4</button>
                </div>
                <div class="font-black text-slate-300 text-xl">${year}</div>
            </div>
        </header>

        <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <div class="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
            
            <div class="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <h3 class="text-sm font-bold text-slate-400 uppercase mb-1">🏛️ Liquidación IVA Estimada</h3>
                    <p class="text-[10px] text-slate-500">Diferencia entre IVA cobrado y pagado</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] font-bold text-slate-300 uppercase mb-1">A PAGAR / DEVOLVER</p>
                    <p class="text-4xl font-black text-white" id="kpi-iva-resultado">0.00€</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 relative z-10">
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p class="text-[9px] text-emerald-400 uppercase font-bold mb-1">IVA REPERCUTIDO (+)</p>
                    <p class="text-lg font-black" id="kpi-iva-rep">0.00€</p>
                    <p class="text-[8px] text-slate-500 mt-1">Cobrado a clientes (Caja)</p>
                </div>
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p class="text-[9px] text-rose-400 uppercase font-bold mb-1">IVA SOPORTADO (-)</p>
                    <p class="text-lg font-black" id="kpi-iva-sop">0.00€</p>
                    <p class="text-[8px] text-slate-500 mt-1">Pagado a proveedores (Albaranes)</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 class="text-xs font-black text-slate-800 uppercase mb-4">💰 Resultado Neto (P&L)</h3>
                <div class="space-y-3">
                    <div class="flex justify-between text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-500 font-bold">Ventas Netas (Sin IVA)</span>
                        <span class="font-black text-slate-900" id="pnl-ventas">0.00€</span>
                    </div>
                    <div class="flex justify-between text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-500 font-bold">Compras (Sin IVA)</span>
                        <span class="font-black text-rose-500" id="pnl-compras">-0.00€</span>
                    </div>
                    <div class="flex justify-between text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-500 font-bold">Gastos Fijos</span>
                        <span class="font-black text-rose-500" id="pnl-fijos">-0.00€</span>
                    </div>
                    
                    <div class="pt-4 flex justify-between items-center">
                        <div class="flex flex-col">
                            <span class="font-black text-slate-800 uppercase text-[10px]">Beneficio</span>
                            <span class="text-[9px] text-slate-400" id="pnl-margen-pct">0% Margen</span>
                        </div>
                        <span class="font-black text-2xl text-indigo-600" id="pnl-beneficio">0.00€</span>
                    </div>
                </div>
            </div>

            <div class="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-indigo-200"></div>
                <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Food Cost Real</p>
                <div class="w-28 h-28 rounded-full border-8 border-white flex flex-col items-center justify-center bg-indigo-500 text-white shadow-xl mb-3">
                    <span class="font-black text-2xl" id="kpi-foodcost">0%</span>
                    <span class="text-[8px] opacity-80">DE VENTA</span>
                </div>
                <p class="text-[9px] text-indigo-400 px-4 leading-tight">
                    Porcentaje de tus ventas netas destinado a la compra de materia prima.
                    <br><strong>Objetivo ideal: < 30%</strong>
                </p>
            </div>
        </div>

    </div>
    `;

    // --- CEREBRO FINANCIERO ---
    const calcularDatos = () => {
        // 1. Definir rango de fechas del trimestre
        const mesesTrimestre = { 'T1': [0,1,2], 'T2': [3,4,5], 'T3': [6,7,8], 'T4': [9,10,11] };
        const meses = mesesTrimestre[trimestre];

        const isInTrim = (dateStr) => {
            if(!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === year && meses.includes(d.getMonth());
        };

        // --- A. CÁLCULO DE VENTAS (CIERRES Z) ---
        // Sumamos lo que has facturado realmente
        let ventasBrutas = 0; // Con IVA
        cierres.forEach(c => {
            if(isInTrim(c.date)) {
                // Sumamos Efectivo + Tarjeta de cada cierre
                const diaTotal = (parseFloat(c.totalCaja)||0) + (parseFloat(c.totalTarjeta)||0);
                ventasBrutas += diaTotal;
            }
        });

        // Desglose fiscal Ventas (Estimación Estándar Hostelería: 10% IVA)
        // Si tuvieras datos exactos de IVA por cierre, los usaríamos, pero esto es una gran aproximación.
        const ventasBase = ventasBrutas / 1.10;
        const ivaRepercutido = ventasBrutas - ventasBase;

        // --- B. CÁLCULO DE COMPRAS (ALBARANES) ---
        // Aquí usamos los datos exactos que guardas en el módulo Albaranes
        let comprasBase = 0;
        let ivaSoportado = 0;

        albaranes.forEach(a => {
            if(isInTrim(a.date)) {
                // Si guardamos el desglose exacto (versión nueva), lo usamos
                if(a.base && a.taxes) {
                    comprasBase += parseFloat(a.base);
                    ivaSoportado += parseFloat(a.taxes);
                } else {
                    // Si es un albarán viejo, estimamos al 10%
                    const total = parseFloat(a.total) || 0;
                    const baseEst = total / 1.10;
                    comprasBase += baseEst;
                    ivaSoportado += (total - baseEst);
                }
            }
        });

        // --- C. GASTOS FIJOS (OPEX) ---
        // Calculamos el coste fijo del trimestre (3 meses x Gasto Mensual)
        let totalFijos = 0;
        fijos.forEach(f => {
            const importe = parseFloat(f.amount) || 0;
            // Si es mensual, lo multiplicamos por 3 para el trimestre
            if(f.freq === 'mensual') totalFijos += (importe * 3);
            else if(f.freq === 'anual') totalFijos += (importe / 4);
            else totalFijos += importe; // Asumimos trimestral por defecto
        });

        // --- PINTAR TARJETA FISCAL (IVA) ---
        const diffIva = ivaRepercutido - ivaSoportado;
        
        container.querySelector("#kpi-iva-rep").innerText = ivaRepercutido.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        container.querySelector("#kpi-iva-sop").innerText = ivaSoportado.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        
        const elTotalIva = container.querySelector("#kpi-iva-resultado");
        elTotalIva.innerText = diffIva.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        
        // Semáforo Fiscal
        if(diffIva > 0) {
            elTotalIva.classList.remove('text-emerald-400');
            elTotalIva.classList.add('text-rose-400'); // Toca pagar
        } else {
            elTotalIva.classList.remove('text-rose-400');
            elTotalIva.classList.add('text-emerald-400'); // Te devuelven
        }

        // --- PINTAR P&L (BENEFICIO) ---
        const beneficio = ventasBase - comprasBase - totalFijos;
        const margen = ventasBase > 0 ? ((beneficio / ventasBase) * 100) : 0;

        container.querySelector("#pnl-ventas").innerText = ventasBase.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        container.querySelector("#pnl-compras").innerText = "-" + comprasBase.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        container.querySelector("#pnl-fijos").innerText = "-" + totalFijos.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        
        const elBen = container.querySelector("#pnl-beneficio");
        elBen.innerText = beneficio.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
        if(beneficio >= 0) elBen.className = "font-black text-2xl text-emerald-500";
        else elBen.className = "font-black text-2xl text-rose-500";

        container.querySelector("#pnl-margen-pct").innerText = `${margen.toFixed(1)}% Margen Neto`;

        // --- PINTAR FOOD COST ---
        const foodCost = ventasBase > 0 ? (comprasBase / ventasBase) * 100 : 0;
        container.querySelector("#kpi-foodcost").innerText = foodCost.toFixed(1) + "%";
    };

    // Controladores de UI
    window.changeTrim = (t) => {
        trimestre = t;
        // Actualizar visualmente los botones
        container.querySelectorAll(".trim-btn").forEach(b => {
            if(b.innerText === t) b.className = "trim-btn px-3 py-1 rounded-lg text-[10px] font-bold bg-white shadow text-indigo-600 transition";
            else b.className = "trim-btn px-3 py-1 rounded-lg text-[10px] font-bold text-slate-400 transition";
        });
        calcularDatos();
    };

    // Inicializar
    calcularDatos();
}
