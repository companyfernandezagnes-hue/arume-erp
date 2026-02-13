/* =============================================================
   📊 MÓDULO: INFORMES FINANCIEROS (P&L - Cuenta de Resultados)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    // 1. Asegurar datos
    const facts = db.facturas || [];
    const albs = db.albaranes || [];
    const fijos = db.gastos_fijos || [];

    let year = new Date().getFullYear();

    // 2. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Cuenta de Resultados</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Profit & Loss (P&L)</p>
            </div>
            <div class="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button id="btnPrevYear" class="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-slate-600 shadow-sm font-bold hover:text-indigo-600 transition">‹</button>
                <span id="lblYear" class="font-black text-slate-800 w-12 text-center text-sm">${year}</span>
                <button id="btnNextYear" class="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-slate-600 shadow-sm font-bold hover:text-indigo-600 transition">›</button>
            </div>
        </header>

        <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">RESULTADO NETO (BENEFICIO)</p>
            <h3 id="net-profit" class="text-5xl font-black tracking-tight mb-4">0.00€</h3>
            <div id="net-margin-badge" class="inline-block px-4 py-1 rounded-full bg-white/10 text-white text-[10px] font-black uppercase border border-white/20">
                0% MARGEN NETO
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4">
            
            <div class="bg-white p-6 rounded-[2rem] border border-emerald-100 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">💰</span>
                        <h4 class="font-black text-slate-800">(+) VENTAS TOTALES</h4>
                    </div>
                    <span id="val-ventas" class="text-xl font-black text-emerald-600">0.00€</span>
                </div>
                <p class="text-[10px] text-slate-400 pl-10">Facturación sin IVA</p>
            </div>

            <div class="bg-white p-6 rounded-[2rem] border border-rose-50 shadow-sm relative">
                <div class="absolute left-8 -top-3 h-4 w-0.5 bg-slate-200"></div> <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs">📦</span>
                        <h4 class="font-black text-slate-800">(-) MERCADERÍAS</h4>
                    </div>
                    <span id="val-cos" class="text-xl font-black text-rose-500">0.00€</span>
                </div>
                <p class="text-[10px] text-slate-400 pl-10">Albaranes y Compras (Sin IVA)</p>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center mx-4">
                <span class="text-xs font-black text-slate-500 uppercase">= MARGEN BRUTO</span>
                <span id="val-gross" class="text-lg font-black text-slate-700">0.00€</span>
            </div>

            <div class="bg-white p-6 rounded-[2rem] border border-amber-50 shadow-sm relative">
                <div class="absolute left-8 -top-6 h-8 w-0.5 bg-slate-200"></div>
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">🏢</span>
                        <h4 class="font-black text-slate-800">(-) ESTRUCTURA</h4>
                    </div>
                    <span id="val-opex" class="text-xl font-black text-amber-600">0.00€</span>
                </div>
                <p class="text-[10px] text-slate-400 pl-10">Personal, Alquiler, Suministros (Fijos)</p>
            </div>

            <div class="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm flex justify-between items-center relative overflow-hidden">
                <div class="relative z-10">
                    <h4 class="font-black text-indigo-900 text-lg">EBITDA</h4>
                    <p class="text-[9px] text-indigo-400 font-bold uppercase">Resultado Operativo</p>
                </div>
                <span id="val-ebitda" class="text-3xl font-black text-indigo-600 relative z-10">0.00€</span>
            </div>

        </div>
    </div>
    `;

    // 3. LÓGICA DE CÁLCULO
    const calcular = () => {
        // Filtramos por año seleccionado
        const isYear = (d) => new Date(d).getFullYear() === year;

        // A) VENTAS (Base Imponible de Facturas)
        // Si la factura tiene campo 'base', usamos eso. Si no, calculamos base = total / 1.10 (aprox)
        const ventas = facts.filter(f => isYear(f.date)).reduce((acc, f) => {
            const base = f.base || (parseFloat(f.total) / 1.10); 
            return acc + base;
        }, 0);

        // B) COSTE DE MERCANCÍAS (Base Imponible de Albaranes)
        // Albaranes siempre restan el IVA (taxes) para tener el coste real
        const cogs = albs.filter(a => isYear(a.date)).reduce((acc, a) => {
            const total = parseFloat(a.total) || 0;
            const tax = parseFloat(a.taxes) || 0;
            return acc + (total - tax);
        }, 0);

        // C) MARGEN BRUTO
        const grossMargin = ventas - cogs;

        // D) GASTOS FIJOS (OPEX)
        // Calculamos el coste anual de la "Mochila"
        // Si el usuario mete "Alquiler 1000 mensual", son 12.000 al año
        const opex = fijos.reduce((acc, g) => {
            let amount = parseFloat(g.amount) || 0;
            if(g.freq === 'mensual') amount *= 12;
            if(g.freq === 'trimestral') amount *= 4;
            return acc + amount;
        }, 0);

        // E) EBITDA
        const ebitda = grossMargin - opex;

        // --- PINTAR RESULTADOS ---
        const fmt = (n) => n.toLocaleString('es-ES', {style:'currency', currency:'EUR'});
        
        container.querySelector("#lblYear").innerText = year;
        
        container.querySelector("#val-ventas").innerText = fmt(ventas);
        container.querySelector("#val-cos").innerText = fmt(cogs);
        container.querySelector("#val-gross").innerText = fmt(grossMargin);
        
        // OPEX es una estimación anual basada en los fijos actuales
        // Para ser más precisos, si estamos en el año actual, podríamos prorratear, 
        // pero para P&L anual, proyectamos el coste anual.
        container.querySelector("#val-opex").innerText = fmt(opex);
        
        container.querySelector("#val-ebitda").innerText = fmt(ebitda);
        container.querySelector("#net-profit").innerText = fmt(ebitda); // Asumimos Net = EBITDA (sin impuestos sociedad aun)

        // Color EBITDA
        const ebitdaEl = container.querySelector("#val-ebitda");
        if(ebitda >= 0) ebitdaEl.className = "text-3xl font-black text-indigo-600 relative z-10";
        else ebitdaEl.className = "text-3xl font-black text-rose-500 relative z-10";

        // Margen %
        const marginPct = ventas > 0 ? ((ebitda / ventas) * 100).toFixed(1) : 0;
        container.querySelector("#net-margin-badge").innerText = `${marginPct}% MARGEN EBITDA`;
        
        // Color Resultado Header
        const headerRes = container.querySelector("#net-profit");
        if(ebitda >= 0) headerRes.classList.remove('text-rose-300');
        else headerRes.classList.add('text-rose-300');
    };

    // Navegación Años
    container.querySelector("#btnPrevYear").onclick = () => { year--; calcular(); };
    container.querySelector("#btnNextYear").onclick = () => { year++; calcular(); };

    calcular();
}
