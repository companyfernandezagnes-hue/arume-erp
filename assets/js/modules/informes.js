/* =============================================================
   📈 MÓDULO: INFORMES & FISCALIDAD (v3.1 - Conector Analista IA n8n)
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
    const fmt = window.Num.fmt; // Usamos el global para consistencia
    const pct = (n) => (n || 0).toFixed(1) + '%';

    // =========================================================
    // 🧠 1. MOTOR DE CÁLCULO FISCAL (Desglose IVA - Modelo 303)
    // =========================================================
    const calcularModelo303 = () => {
        const t = filters.trimestre;
        const monthsInTrim = [(t-1)*3, (t-1)*3+1, (t-1)*3+2];
        
        const inPeriod = (dateStr) => {
            if(!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === filters.year && monthsInTrim.includes(d.getMonth());
        };

        // A. IVA DEVENGADO (VENTAS)
        let devengado = { base: 0, iva: 0, total: 0 };
        
        // 1. Sumar CIERRES Z
        (db.cierres || []).filter(z => inPeriod(z.date)).forEach(z => {
            const total = parseFloat(z.totalVenta) || 0;
            const base = total / 1.10; // Estándar hostelería 10%
            devengado.base += base;
            devengado.iva += (total - base);
            devengado.total += total;
        });

        // 2. Sumar Facturas Extra
        (db.facturas || []).filter(f => inPeriod(f.date) && !String(f.num).startsWith('Z-')).forEach(f => {
            const total = parseFloat(f.total) || 0;
            // Si hay desglose base/tax en la factura, usarlo. Si no, estimar al 10%
            let base = f.base ? parseFloat(f.base) : (total / 1.10);
            let tax = f.tax ? parseFloat(f.tax) : (total - base);
            
            devengado.base += base;
            devengado.iva += tax;
            devengado.total += total;
        });

        // B. IVA DEDUCIBLE (GASTOS)
        let deducible = { base4: 0, iva4: 0, base10: 0, iva10: 0, base21: 0, iva21: 0, total: 0 };

        (db.albaranes || []).filter(a => inPeriod(a.date)).forEach(a => {
            const total = parseFloat(a.total) || 0;
            
            // Lógica simplificada de IVA por proveedor
            const prov = (a.prov || '').toLowerCase();
            let tipo = 10; 

            if (prov.match(/luz|agua|tel|gestor|seguro|alquiler|reparacion|maquinaria|limpieza|amazon/)) tipo = 21;
            else if (prov.match(/pan|leche|huevo|fruta|verdura|harina/)) tipo = 4;
            else if (prov.match(/alcohol|bebida|vino|cerveza|licor/)) tipo = 21;

            const div = 1 + (tipo/100);
            const base = total / div;
            const quota = total - base;

            if(tipo===4) { deducible.base4+=base; deducible.iva4+=quota; }
            if(tipo===10) { deducible.base10+=base; deducible.iva10+=quota; }
            if(tipo===21) { deducible.base21+=base; deducible.iva21+=quota; }
            deducible.total += total;
        });

        // Sumar Gastos Fijos (Prorrateados)
        (db.gastos_fijos || []).filter(g => g.active !== false).forEach(g => {
            let amount = parseFloat(g.amount) || 0;
            if(g.freq === 'mensual') amount *= 3;
            if(g.freq === 'anual') amount /= 4;
            
            if (g.cat !== 'personal') { 
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

        // --- VISTA A: P&L (Cuenta Resultados - ARREGLADA PARA V3.0) ---
        if(activeTab === 'pnl') {
            // 1. LLAMAMOS AL CEREBRO
            const data = window.ArumeEngine.getProfit(filters.month, filters.year);
            const mesNombre = new Date(filters.year, filters.month).toLocaleDateString('es-ES',{month:'long'});

            // 2. AGRUPAMOS LOS DATOS NUEVOS PARA MOSTRARLOS SIMPLIFICADOS
            const totalVariables = data.gastos.comida + data.gastos.bebida + data.gastos.otros;
            const totalFijos = data.gastos.personal + data.gastos.estructura;

            content.innerHTML = `
                <div class="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 mb-4">
                    <button onclick="window.changeMonth(-1)" class="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-100 text-indigo-600 font-black">◀</button>
                    <h3 class="text-sm font-black text-slate-800 uppercase">Resultados ${mesNombre} ${filters.year}</h3>
                    <button onclick="window.changeMonth(1)" class="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-100 text-indigo-600 font-black">▶</button>
                </div>

                <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl text-center mb-6 relative overflow-hidden">
                    <div class="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-400 via-slate-900 to-slate-900"></div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">Beneficio Neto (Antes Impuestos)</p>
                    <p class="text-4xl font-black relative z-10 ${data.neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${fmt(data.neto)}</p>
                </div>

                <div class="space-y-3">
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">💰</div>
                            <div>
                                <p class="text-xs font-bold text-slate-700">Ingresos Totales</p>
                                <p class="text-[9px] text-slate-400">Ventas Caja + Facturas</p>
                            </div>
                        </div>
                        <p class="font-black text-slate-800">${fmt(data.ingresos.total)}</p>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">📉</div>
                            <div>
                                <p class="text-xs font-bold text-slate-700">Gastos Variables</p>
                                <p class="text-[9px] text-slate-400">Mercaderías (Comida/Bebida)</p>
                            </div>
                        </div>
                        <p class="font-black text-rose-500">-${fmt(totalVariables)}</p>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">🏢</div>
                            <div>
                                <p class="text-xs font-bold text-slate-700">Estructura Fija</p>
                                <p class="text-[9px] text-slate-400">Personal y Local</p>
                            </div>
                        </div>
                        <p class="font-black text-rose-500">-${fmt(totalFijos)}</p>
                    </div>
                    
                     <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center opacity-75">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center">🏚️</div>
                            <div>
                                <p class="text-xs font-bold text-slate-700">Amortizaciones</p>
                                <p class="text-[9px] text-slate-400">Desgaste maquinaria</p>
                            </div>
                        </div>
                        <p class="font-black text-slate-600">-${fmt(data.gastos.amortizacion)}</p>
                    </div>
                </div>
            `;
        }

        // --- VISTA B: FISCAL (MODELO 303) ---
        if(activeTab === 'fiscal') {
            const data = calcularModelo303();
            const colorRes = data.resultado > 0 ? 'text-rose-500' : 'text-emerald-500';
            const txtRes = data.resultado > 0 ? 'A PAGAR (Hacienda)' : 'A DEVOLVER (O Compensar)';

            content.innerHTML = `
                <div class="flex justify-center mb-6">
                    <div class="flex bg-slate-100 p-1 rounded-xl">
                        ${[1,2,3,4].map(t => `
                            <button onclick="window.setTrim(${t})" class="px-4 py-2 rounded-lg text-[10px] font-black transition ${filters.trimestre===t?'bg-white shadow text-indigo-600':'text-slate-400'}">T${t}</button>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden mb-6">
                    <div class="relative z-10 flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-bold text-slate-300">Liquidación IVA</h3>
                            <p class="text-xs text-slate-500 uppercase tracking-widest mb-4">Modelo 303 - T${filters.trimestre} ${filters.year}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">${txtRes}</p>
                            <p class="text-4xl font-black ${colorRes}">${fmt(data.resultado)}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mt-6">
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                            <p class="text-[10px] text-emerald-400 font-bold uppercase mb-1">Repercutido (+)</p>
                            <p class="text-xl font-black">${fmt(data.devengado.iva)}</p>
                        </div>
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                            <p class="text-[10px] text-rose-400 font-bold uppercase mb-1">Soportado (-)</p>
                            <p class="text-xl font-black">${fmt(data.totalSoportado)}</p>
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
                                <td class="p-4 font-bold text-slate-800">IVA Ventas (10% Est.)</td>
                                <td class="p-4 text-right font-mono">${fmt(data.devengado.base)}</td>
                                <td class="p-4 text-right font-bold text-emerald-600">${fmt(data.devengado.iva)}</td>
                            </tr>
                            <tr class="bg-rose-50/30">
                                <td class="p-4 font-bold text-slate-800">Soportado 4%</td>
                                <td class="p-4 text-right font-mono">${fmt(data.deducible.base4)}</td>
                                <td class="p-4 text-right font-bold text-rose-500">${fmt(data.deducible.iva4)}</td>
                            </tr>
                            <tr class="bg-rose-50/30">
                                <td class="p-4 font-bold text-slate-800">Soportado 10%</td>
                                <td class="p-4 text-right font-mono">${fmt(data.deducible.base10)}</td>
                                <td class="p-4 text-right font-bold text-rose-500">${fmt(data.deducible.iva10)}</td>
                            </tr>
                            <tr class="bg-rose-50/30">
                                <td class="p-4 font-bold text-slate-800">Soportado 21%</td>
                                <td class="p-4 text-right font-mono">${fmt(data.deducible.base21)}</td>
                                <td class="p-4 text-right font-bold text-rose-500">${fmt(data.deducible.iva21)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <button onclick="window.exportIVA()" class="mt-4 w-full py-4 bg-slate-200 text-slate-600 font-black text-xs rounded-2xl hover:bg-slate-300 transition flex items-center justify-center gap-2">
                    📄 DESCARGAR CSV
                </button>
            `;
        }

        // --- VISTA C: KPIs HOSTELERÍA ---
        if(activeTab === 'kpis') {
            // USAMOS EL CEREBRO PARA LOS RATIOS
            const data = window.ArumeEngine.getProfit(filters.month, filters.year);
            const mesNombre = new Date(filters.year, filters.month).toLocaleDateString('es-ES',{month:'long'});

            // Cálculo auxiliar de Ticket Medio
            const inMonth = (d) => { const date=new Date(d); return date.getMonth()===filters.month && date.getFullYear()===filters.year; };
            const ventasZ = (db.cierres || []).filter(z => inMonth(z.date));
            const numTickets = ventasZ.reduce((acc,z)=>acc+(parseInt(z.tickets)||0),0); 
            const ticketMedio = numTickets > 0 ? data.ingresos.caja / numTickets : 0;

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
                        <p class="text-2xl font-black text-slate-800">${fmt(ticketMedio)}</p>
                    </div>
                    <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                        <p class="text-3xl mb-1">⭐</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase">Prime Cost</p>
                        <p class="text-2xl font-black ${data.ratios.primeCost>65?'text-rose-500':'text-emerald-500'}">${pct(data.ratios.primeCost)}</p>
                        <p class="text-[8px] text-slate-400">Objetivo: < 60-65%</p>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 class="font-black text-slate-800 text-sm">Distribución de Costes</h3>
                    
                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-600">Personal</span>
                            <span class="${data.ratios.staffCost>35?'text-rose-500':'text-slate-800'}">${pct(data.ratios.staffCost)}</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-blue-500 h-full" style="width:${Math.min(100, data.ratios.staffCost)}%"></div></div>
                        <p class="text-[9px] text-slate-400 mt-1 text-right">Ideal: 30-35%</p>
                    </div>

                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-600">Comida (Food Cost)</span>
                            <span class="${data.ratios.foodCost>30?'text-rose-500':'text-slate-800'}">${pct(data.ratios.foodCost)}</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-orange-500 h-full" style="width:${Math.min(100, data.ratios.foodCost)}%"></div></div>
                        <p class="text-[9px] text-slate-400 mt-1 text-right">Ideal: 25-30%</p>
                    </div>

                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-600">Bebida (Pour Cost)</span>
                            <span class="${data.ratios.drinkCost>25?'text-rose-500':'text-slate-800'}">${pct(data.ratios.drinkCost)}</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-purple-500 h-full" style="width:${Math.min(100, data.ratios.drinkCost)}%"></div></div>
                        <p class="text-[9px] text-slate-400 mt-1 text-right">Ideal: 18-22%</p>
                    </div>
                </div>

                <button id="btnAnalistaIA" onclick="window.analizarConIA()" class="mt-6 w-full py-4 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-black text-xs rounded-2xl hover:shadow-lg hover:scale-[1.02] transition flex flex-col items-center justify-center gap-1">
                    <span class="text-xl">🤖</span>
                    <span>IA: ANALIZAR ESTE MES</span>
                </button>
                <div id="ia-response-box" class="hidden mt-4 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-xs text-emerald-900 leading-relaxed font-medium"></div>
            `;
        }
    };

    // --- 4. FUNCIONES GLOBALES ---
    window.setTab = (tab) => { activeTab = tab; pintar(); };
    window.setTrim = (t) => { filters.trimestre = t; pintar(); };
    window.changeMonth = (delta) => {
        filters.month += delta;
        if(filters.month > 11) { filters.month=0; filters.year++; }
        if(filters.month < 0) { filters.month=11; filters.year--; }
        pintar();
    };

    // --- 4.5. NUEVO: FUNCIÓN PARA LLAMAR AL ANALISTA IA DE N8N ---
    window.analizarConIA = async () => {
        const btn = document.getElementById("btnAnalistaIA");
        const respBox = document.getElementById("ia-response-box");
        
        // Recopilamos todos los datos del mes actual para mandarlos a n8n
        const data = window.ArumeEngine.getProfit(filters.month, filters.year);
        const inMonth = (d) => { const date=new Date(d); return date.getMonth()===filters.month && date.getFullYear()===filters.year; };
        const ventasZ = (db.cierres || []).filter(z => inMonth(z.date));
        const numTickets = ventasZ.reduce((acc,z)=>acc+(parseInt(z.tickets)||0),0); 
        const ticketMedio = numTickets > 0 ? data.ingresos.caja / numTickets : 0;

        const payloadAEnviar = {
            mes: `${filters.month + 1}-${filters.year}`,
            ingresos: data.ingresos.total,
            beneficio: data.neto,
            foodCostPct: data.ratios.foodCost,
            drinkCostPct: data.ratios.drinkCost,
            staffCostPct: data.ratios.staffCost,
            primeCostPct: data.ratios.primeCost,
            ticketMedio: ticketMedio
        };

        btn.innerHTML = `<span class="animate-spin text-xl">🤖</span><span>ANALIZANDO DATOS...</span>`;
        btn.disabled = true;
        respBox.classList.add("hidden");

        try {
            // AQUÍ PONDREMOS LA URL DE TU WEBHOOK N8N
            const n8nWebhookURL = "URL_DE_TU_WEBHOOK_N8N_ANALISTA_IA"; 

            if(n8nWebhookURL === "URL_DE_TU_WEBHOOK_N8N_ANALISTA_IA") {
                throw new Error("⚠️ Aún no has puesto la URL de n8n en el código.");
            }

            const response = await fetch(n8nWebhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadAEnviar)
            });

            if (!response.ok) throw new Error("Error en el servidor de n8n");

            // n8n nos devolverá un objeto JSON con un texto explicativo (ej. { "analisis": "Tu Food Cost está alto..." })
            const respuestaIA = await response.json();

            respBox.innerHTML = `<b>Consejo del Director Financiero IA:</b><br><br>${respuestaIA.analisis || respuestaIA.texto || "Análisis completado sin comentarios."}`;
            respBox.classList.remove("hidden");

        } catch (error) {
            console.error(error);
            alert(error.message || "Error al conectar con la IA de n8n.");
        } finally {
            btn.innerHTML = `<span class="text-xl">🤖</span><span>IA: ANALIZAR ESTE MES</span>`;
            btn.disabled = false;
        }
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

    pintar();
}
