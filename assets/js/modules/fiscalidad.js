/* =============================================================
   ⚖️ MÓDULO: FISCALIDAD PRO (IVA 303 + IRPF 130)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    // 1. Setup
    if (!db.facturas) db.facturas = [];
    if (!db.albaranes) db.albaranes = [];

    const today = new Date();
    let selectedQ = Math.ceil((today.getMonth() + 1) / 3);
    let selectedYear = today.getFullYear();

    // 2. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Impuestos & Modelos</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Simulación Trimestral</p>
            </div>
            <div class="flex bg-slate-100 p-1 rounded-xl mt-4 md:mt-0">
                ${[1,2,3,4].map(q => `
                    <button class="q-btn px-4 py-2 rounded-lg text-xs font-black transition ${selectedQ===q?'bg-slate-900 text-white':'text-slate-400'}" data-q="${q}">${q}T</button>
                `).join('')}
            </div>
        </header>

        <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center">
            <div class="absolute top-0 right-0 w-64 h-64 bg-rose-500 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16"></div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Estimado a Pagar (IVA + IRPF)</p>
            <h3 id="total-pain" class="text-5xl md:text-6xl font-black tracking-tight mb-2">0.00€</h3>
            <p class="text-xs text-slate-400">Previsión para el final del trimestre</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div class="flex justify-between items-center mb-6">
                    <span class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase">Modelo 303</span>
                    <span class="text-2xl">⚖️</span>
                </div>
                
                <div class="space-y-4">
                    <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                        <span class="text-xs font-bold text-slate-400">IVA Repercutido (Ventas)</span>
                        <span id="val-iva-rep" class="text-lg font-black text-slate-800">0.00€</span>
                    </div>
                    <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                        <span class="text-xs font-bold text-slate-400">IVA Soportado (Compras)</span>
                        <span id="val-iva-sop" class="text-lg font-black text-emerald-500">-0.00€</span>
                    </div>
                    <div class="flex justify-between items-end pt-2">
                        <span class="text-xs font-black text-slate-800 uppercase">Resultado IVA</span>
                        <span id="res-iva" class="text-2xl font-black text-indigo-600">0.00€</span>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div class="flex justify-between items-center mb-6">
                    <span class="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase">Modelo 130 (IRPF)</span>
                    <span class="text-2xl">💰</span>
                </div>
                
                <div class="space-y-4">
                    <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                        <span class="text-xs font-bold text-slate-400">Beneficio Neto (Trimestre)</span>
                        <span id="val-beneficio" class="text-lg font-black text-slate-800">0.00€</span>
                    </div>
                    <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                        <span class="text-xs font-bold text-slate-400">Tipo Impositivo</span>
                        <span class="text-lg font-black text-slate-400">20%</span>
                    </div>
                    <div class="flex justify-between items-end pt-2">
                        <span class="text-xs font-black text-slate-800 uppercase">Cuota a Pagar</span>
                        <span id="res-irpf" class="text-2xl font-black text-rose-500">0.00€</span>
                    </div>
                </div>
                <p class="text-[9px] text-slate-300 mt-4 italic">*Calculado como el 20% del rendimiento neto positivo.</p>
            </div>

        </div>
    </div>
    `;

    // 3. CÁLCULOS
    const calcular = () => {
        const startMonth = (selectedQ - 1) * 3;
        const endMonth = startMonth + 2;
        
        // FILTROS
        const inPeriod = (d) => {
            const x = new Date(d);
            return x.getFullYear() === selectedYear && x.getMonth() >= startMonth && x.getMonth() <= endMonth;
        };

        // 1. DATOS IVA
        const facturasQ = db.facturas.filter(f => inPeriod(f.date));
        const albaranesQ = db.albaranes.filter(a => inPeriod(a.date));

        const totalVentas = facturasQ.reduce((a,f) => a + parseFloat(f.total), 0);
        const baseVentas = facturasQ.reduce((a,f) => a + (f.base || parseFloat(f.total)/1.1), 0);
        const ivaRep = totalVentas - baseVentas;

        const ivaSop = albaranesQ.reduce((a,alb) => a + (parseFloat(alb.taxes)||0), 0);
        
        // Resultado IVA
        const resultadoIVA = ivaRep - ivaSop;

        // 2. DATOS IRPF (Modelo 130)
        // Beneficio = Base Ventas - Base Compras - Gastos Fijos (Trimestrales)
        const baseCompras = albaranesQ.reduce((a,alb) => {
            return a + (parseFloat(alb.total) - (parseFloat(alb.taxes)||0));
        }, 0);

        // Estimación de Fijos para el trimestre
        const fijosQ = (db.gastos_fijos || []).reduce((acc, g) => {
            let val = parseFloat(g.amount) || 0;
            if(g.freq === 'mensual') val *= 3; // 3 meses
            // si es trimestral se suma tal cual, si es anual se divide entre 4... (simplificado)
            return acc + val;
        }, 0);

        const beneficio = baseVentas - baseCompras - fijosQ;
        
        // El IRPF es el 20% si hay beneficios, 0 si hay pérdidas
        const cuotaIRPF = beneficio > 0 ? beneficio * 0.20 : 0;

        // 3. PINTAR
        const fmt = (n) => n.toLocaleString('es-ES', {style:'currency', currency:'EUR'});

        container.querySelector("#val-iva-rep").innerText = fmt(ivaRep);
        container.querySelector("#val-iva-sop").innerText = fmt(ivaSop);
        container.querySelector("#res-iva").innerText = fmt(resultadoIVA);
        container.querySelector("#res-iva").className = `text-2xl font-black ${resultadoIVA > 0 ? 'text-rose-500' : 'text-emerald-500'}`;

        container.querySelector("#val-beneficio").innerText = fmt(beneficio);
        container.querySelector("#res-irpf").innerText = fmt(cuotaIRPF);

        // TOTAL PAIN
        const totalPagar = (resultadoIVA > 0 ? resultadoIVA : 0) + cuotaIRPF;
        container.querySelector("#total-pain").innerText = fmt(totalPagar);
    };

    // Eventos
    container.querySelectorAll('.q-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.q-btn').forEach(b => {
                b.classList.remove('bg-slate-900', 'text-white');
                b.classList.add('text-slate-400');
            });
            btn.classList.remove('text-slate-400');
            btn.classList.add('bg-slate-900', 'text-white');
            selectedQ = parseInt(btn.dataset.q);
            calcular();
        };
    });

    calcular();
}
