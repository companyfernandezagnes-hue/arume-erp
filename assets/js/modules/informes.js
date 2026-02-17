/* =============================================================
   📈 MÓDULO: INFORMES & FISCALIDAD (P&L + IVA 303 + KPIs)
   ============================================================= */

export async function render(container, sb, db) {
    
    // --- ESTADO INTERNO ---
    let activeTab = 'pnl'; // pnl | fiscal | kpis
    const today = new Date();
    
    // Filtros de fecha (Inicial: Mes actual)
    let filters = {
        month: today.getMonth(),
        year: today.getFullYear(),
        trimestre: Math.ceil((today.getMonth() + 1) / 3) // 1, 2, 3, 4
    };

    // Helpers de Formato
    const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
    const pct = (n) => (n || 0).toFixed(1) + '%';
    const num = (n) => new Intl.NumberFormat('es-ES').format(n || 0);

    // =========================================================
    // 🧠 1. MOTOR DE CÁLCULO FISCAL (Desglose IVA)
    // =========================================================
    const calcularModelo303 = () => {
        // Definir meses del trimestre seleccionado
        const t = filters.trimestre;
        const monthsInTrim = [(t-1)*3, (t-1)*3+1, (t-1)*3+2];
        
        const inPeriod = (dateStr) => {
            const d = window.DateUtil.parse(dateStr);
            return d.getFullYear() === filters.year && monthsInTrim.includes(d.getMonth());
        };

        // A. IVA DEVENGADO (VENTAS)
        // Asumimos que la gran mayoría de hostelería va al 10%
        let devengado = { base: 0, iva: 0, total: 0 };
        
        // Sumar Cajas Z (Diario)
        (db.diario||[]).filter(z => inPeriod(z.date)).forEach(z => {
            const total = window.Num.parse(z.totalVenta);
            const base = total / 1.10; // Estándar hostelería 10%
            devengado.base += base;
            devengado.iva += (total - base);
            devengado.total += total;
        });

        // Sumar Facturas Extra
        (db.facturas||[]).filter(f => inPeriod(f.date) && !String(f.num).startsWith('Z')).forEach(f => {
            const total = window.Num.parse(f.total);
            // Si tienes desglose guardado úsalo, si no estima al 10% (o 21% si es evento alcohol)
            const base = total / 1.10; 
            devengado.base += base;
            devengado.iva += (total - base);
            devengado.total += total;
        });

        // B. IVA DEDUCIBLE (GASTOS)
        // Aquí intentamos ser listos con las categorías
        let deducible = { 
            base4: 0, iva4: 0,
            base10: 0, iva10: 0,
            base21: 0, iva21: 0,
            total: 0
        };

        (db.albaranes||[]).filter(a => inPeriod(a.date)).forEach(a => {
            const total = window.Num.parse(a.total);
            const prov = (a.prov || '').toLowerCase();
            let tipo = 10; // Por defecto alimentación

            if (prov.match(/luz|agua|tel|gestor|seguro|alquiler|reparacion|maquinaria|limpieza/)) tipo = 21;
            else if (prov.match(/pan|leche|huevo|fruta|verdura|harina/)) tipo = 4;
            else if (prov.match(/alcohol|bebida|vino|cerveza/)) tipo = 21;

            const div = 1 + (tipo/100);
            const base = total / div;
            const quota = total - base;

            if(tipo===4) { deducible.base4+=base; deducible.iva4+=quota; }
            if(tipo===10) { deducible.base10+=base; deducible.iva10+=quota; }
            if(tipo===21) { deducible.base21+=base; deducible.iva21+=quota; }
            deducible.total += total;
        });

        // Sumar también Gastos Fijos que tengan factura (Alquileres, suministros...)
        (db.gastos_fijos||[]).filter(g => g.active !== false).forEach(g => {
            // Prorrateo trimestral
            let amount = window.Num.parse(g.amount);
            if(g.freq === 'mensual') amount *= 3;
            if(g.freq === 'anual') amount /= 4;
            
            // Estimación IVA gastos fijos (casi todo es 21% servicios)
            if (g.cat !== 'personal') { // Personal no lleva IVA
                const base = amount / 1.21;
                deducible.base21 += base;
                deducible.iva21 += (amount - base);
                deducible.total += amount;
            }
        });

        const totalSoportado = deducible.iva4 + deducible.iva10 + deducible.iva21;
        const resultado = devengado.iva - totalSoportado;

        return { devengado, deducible, resultado, totalSoportado };
    };

    // =========================================================
    // 📊 2. MOTOR DE KPIS OPERATIVOS (Hostelería)
    // =========================================================
    const calcularKPIs = () => {
        const inMonth = (dateStr) => {
            const d = window.DateUtil.parse(dateStr);
            return d.getFullYear() === filters.year && d.getMonth() === filters.month;
        };

        // Ventas
        const ventasZ = (db.diario||[]).filter(z => inMonth(z.date));
        const totalVentas = ventasZ.reduce((acc,z)=>acc+window.Num.parse(z.totalVenta),0);
        const numTickets = ventasZ.reduce((acc,z)=>acc+(parseInt(z.tickets)||0),0); // Necesitas campo 'tickets' en diario

        // Ticket Medio
        const ticketMedio = numTickets > 0 ? totalVentas / numTickets : 0;

        // Costes
        const albaranesMes = (db.albaranes||[]).filter(a=>inMonth(a.date));
        const costeComida = albaranesMes.filter(a=>(a.prov||'').match(/fruta|carne|pesca|makro|mercadona/i))
                            .reduce((acc,a)=>acc+window.Num.parse(a.total),0);
        const costeBebida = albaranesMes.filter(a=>(a.prov||'').match(/bebida|vino|cerveza|cola|agua/i))
                            .reduce((acc,a)=>acc+window.Num.parse(a.total),0);
        
        const personal = (db.gastos_fijos||[]).filter(g=>g.cat==='personal')
                         .reduce((acc,g)=>acc+window.Num.parse(g.amount),0); // Mensual

        return {
            ticketMedio,
            numTickets,
            ratioComida: totalVentas > 0 ? (costeComida/totalVentas)*100 : 0,
            ratioBebida: totalVentas > 0 ? (costeBebida/totalVentas)*100 : 0,
            ratioPersonal: totalVentas > 0 ? (personal/totalVentas)*100 : 0,
            primeCost: totalVentas > 0 ? ((costeComida+costeBebida+personal)/totalVentas)*100 : 0
        };
    };

    // =========================================================
    // 🎨 3. RENDERIZADO UI
    // =========================================================
    const pintar = () => {
        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <div class="flex flex-col gap-4">
                <header class="flex justify-between items-center px-2">
                    <h2 class="text-2xl font-black text-slate-800">Informes 360º</h2>
                    <div class="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                        <button onclick="window.setTab('pnl')" class="px-4 py-2 rounded-lg text-[10px] font-black uppercase transition ${activeTab==='pnl'?'bg-slate-800 text-white shadow':'text-slate-400 hover:bg-slate-50'}">Resultados</button>
                        <button onclick="window.setTab('fiscal')" class="px-4 py-2 rounded-lg text-[10px] font-black uppercase transition ${activeTab==='fiscal'?'bg-indigo-600 text-white shadow':'text-slate-400 hover:bg-slate-50'}">Fiscal (IVA)</button>
                        <button onclick="window.setTab('kpis')" class="px-4 py-2 rounded-lg text-[10px] font-black uppercase transition ${activeTab==='kpis'?'bg-emerald-500 text-white shadow':'text-slate-400 hover:bg-slate-50'}">KPIs Pro</button>
                    </div>
                </header>
            </div>

            <div id="report-content"></div>
        </div>`;

        const content = container.querySelector('#report-content');

        // --- VISTA A: P&L (Cuenta Resultados) ---
        if(activeTab === 'pnl') {
            // Reutilizamos lógica básica del Dashboard pero expandida
            // (Simplificado para este ejemplo, ya lo tienes en Dashboard.js pero aquí podrías poner la tabla detallada)
            content.innerHTML = `
                <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center py-20">
                    <p class="text-slate-400 text-sm">Utiliza el <b>Dashboard</b> principal para ver la Cuenta de Resultados en tiempo real.</p>
                    <button onclick="loadModule('dashboard')" class="mt-4 bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold">Ir al Dashboard</button>
                </div>
            `;
        }

        // --- VISTA B: FISCAL (MODELO 303) ---
        if(activeTab === 'fiscal') {
            const data = calcularModelo303();
            const colorRes = data.resultado > 0 ? 'text-rose-500' : 'text-emerald-500';
            const txtRes = data.resultado > 0 ? 'A PAGAR' : 'A DEVOLVER';

            content.innerHTML = `
                <div class="flex justify-center mb-6">
                    <div class="flex bg-slate-100 p-1 rounded-xl">
                        ${[1,2,3,4].map(t => `
                            <button onclick="window.setTrim(${t})" class="px-4 py-2 rounded-lg text-[10px] font-black transition ${filters.trimestre===t?'bg-white shadow text-indigo-600':'text-slate-400'}">Trimestre ${t}</button>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden mb-6">
                    <div class="absolute top-0 right-0 w-60 h-60 bg-indigo-500 rounded-full blur-[80px] opacity-20 -mr-10 -mt-10"></div>
                    <div class="relative z-10 flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-bold text-slate-300">Liquidación IVA (Est.)</h3>
                            <p class="text-xs text-slate-500 uppercase tracking-widest mb-4">Modelo 303 - T${filters.trimestre} ${filters.year}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">${txtRes}</p>
                            <p class="text-4xl font-black ${colorRes}">${fmt(data.resultado)}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mt-6">
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                            <p class="text-[10px] text-emerald-400 font-bold uppercase mb-1">Repercutido (Ventas)</p>
                            <p class="text-xl font-black">${fmt(data.devengado.iva)}</p>
                            <p class="text-[9px] text-slate-500 mt-1">Base: ${fmt(data.devengado.base)}</p>
                        </div>
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                            <p class="text-[10px] text-rose-400 font-bold uppercase mb-1">Soportado (Gastos)</p>
                            <p class="text-xl font-black">${fmt(data.totalSoportado)}</p>
                            <p class="text-[9px] text-slate-500 mt-1">Deducible est.</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="p-4 text-[9px] font-black text-slate-400 uppercase">Concepto</th>
                                <th class="p-4 text-[9px] font-black text-slate-400 uppercase text-right">Base</th>
                                <th class="p-4 text-[9px] font-black text-slate-400 uppercase text-right">Cuota IVA</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 text-xs font-medium text-slate-600">
                            <tr>
                                <td class="p-4 font-bold text-slate-800">IVA Devengado (10% Gen)</td>
                                <td class="p-4 text-right font-mono">${fmt(data.devengado.base)}</td>
                                <td class="p-4 text-right font-bold text-emerald-600">${fmt(data.devengado.iva)}</td>
                            </tr>
                            <tr class="bg-rose-50/30">
                                <td class="p-4 font-bold text-slate-800">Soportado 4% (Super)</td>
                                <td class="p-4 text-right font-mono">${fmt(data.deducible.base4)}</td>
                                <td class="p-4 text-right font-bold text-rose-500">${fmt(data.deducible.iva4)}</td>
                            </tr>
                            <tr class="bg-rose-50/30">
                                <td class="p-4 font-bold text-slate-800">Soportado 10% (Alim)</td>
                                <td class="p-4 text-right font-mono">${fmt(data.deducible.base10)}</td>
                                <td class="p-4 text-right font-bold text-rose-500">${fmt(data.deducible.iva10)}</td>
                            </tr>
                            <tr class="bg-rose-50/30">
                                <td class="p-4 font-bold text-slate-800">Soportado 21% (Serv)</td>
                                <td class="p-4 text-right font-mono">${fmt(data.deducible.base21)}</td>
                                <td class="p-4 text-right font-bold text-rose-500">${fmt(data.deducible.iva21)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <button onclick="window.exportIVA()" class="mt-4 w-full py-4 bg-slate-200 text-slate-600 font-black text-xs rounded-2xl hover:bg-slate-300 transition flex items-center justify-center gap-2">
                    📄 DESCARGAR CSV PARA GESTOR
                </button>
            `;
        }

        // --- VISTA C: KPIs HOSTELERÍA ---
        if(activeTab === 'kpis') {
            const data = calcularKPIs();
            const mesNombre = new Date(filters.year, filters.month).toLocaleDateString('es-ES',{month:'long'});

            content.innerHTML = `
                <div class="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 mb-6">
                    <button onclick="window.changeMonth(-1)" class="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-100 text-indigo-600 font-black">◀</button>
                    <h3 class="text-sm font-black text-slate-800 uppercase">${mesNombre} ${filters.year}</h3>
                    <button onclick="window.changeMonth(1)" class="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-100 text-indigo-600 font-black">▶</button>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                        <p class="text-3xl mb-1">🧾</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase">Ticket Medio</p>
                        <p class="text-2xl font-black text-slate-800">${fmt(data.ticketMedio)}</p>
                    </div>
                    <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                        <p class="text-3xl mb-1">⭐</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase">Prime Cost</p>
                        <p class="text-2xl font-black ${data.primeCost>60?'text-rose-500':'text-emerald-500'}">${pct(data.primeCost)}</p>
                        <p class="text-[8px] text-slate-400">Objetivo: < 60%</p>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 class="font-black text-slate-800 text-sm">Distribución de Costes</h3>
                    
                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-600">Personal</span>
                            <span class="${data.ratioPersonal>35?'text-rose-500':'text-slate-800'}">${pct(data.ratioPersonal)}</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-blue-500 h-full" style="width:${Math.min(100, data.ratioPersonal)}%"></div></div>
                        <p class="text-[9px] text-slate-400 mt-1 text-right">Ideal: 30-35%</p>
                    </div>

                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-600">Comida (Food Cost)</span>
                            <span class="${data.ratioComida>30?'text-rose-500':'text-slate-800'}">${pct(data.ratioComida)}</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-orange-500 h-full" style="width:${Math.min(100, data.ratioComida)}%"></div></div>
                        <p class="text-[9px] text-slate-400 mt-1 text-right">Ideal: 25-30%</p>
                    </div>

                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-600">Bebida (Pour Cost)</span>
                            <span class="${data.ratioBebida>25?'text-rose-500':'text-slate-800'}">${pct(data.ratioBebida)}</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-purple-500 h-full" style="width:${Math.min(100, data.ratioBebida)}%"></div></div>
                        <p class="text-[9px] text-slate-400 mt-1 text-right">Ideal: 18-22%</p>
                    </div>
                </div>
            `;
        }
    };

    // --- 4. FUNCIONES GLOBALES (Tabs y Filtros) ---
    window.setTab = (tab) => {
        activeTab = tab;
        pintar();
    };

    window.setTrim = (t) => {
        filters.trimestre = t;
        pintar();
    };

    window.changeMonth = (delta) => {
        filters.month += delta;
        if(filters.month > 11) { filters.month=0; filters.year++; }
        if(filters.month < 0) { filters.month=11; filters.year--; }
        pintar();
    };

    window.exportIVA = () => {
        const data = calcularModelo303();
        const csv = `CONCEPTO;BASE;IVA\n` +
                    `Repercutido;${data.devengado.base.toFixed(2)};${data.devengado.iva.toFixed(2)}\n` +
                    `Soportado 4%;${data.deducible.base4.toFixed(2)};${data.deducible.iva4.toFixed(2)}\n` +
                    `Soportado 10%;${data.deducible.base10.toFixed(2)};${data.deducible.iva10.toFixed(2)}\n` +
                    `Soportado 21%;${data.deducible.base21.toFixed(2)};${data.deducible.iva21.toFixed(2)}\n` +
                    `RESULTADO LIQUIDACION;;${data.resultado.toFixed(2)}`;
        
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        a.download = `IVA_T${filters.trimestre}_${filters.year}.csv`;
        a.click();
    };

    // Arrancar
    pintar();
}
