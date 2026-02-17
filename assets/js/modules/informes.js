/* =============================================================
   📈 MÓDULO: INFORMES 360º (Gestión + Fiscalidad)
   ============================================================= */

export async function render(container, sb, db) {
    // --- ESTADO INTERNO ---
    let currentTab = 'gestion'; // 'gestion' (Mensual) o 'fiscal' (Trimestral)
    
    // Fechas para Gestión
    const today = new Date();
    let selectedMonth = today.getMonth();
    let selectedYear = today.getFullYear();

    // Fechas para Fiscal
    let yearFiscal = today.getFullYear();
    let trimActual = Math.ceil((today.getMonth() + 1) / 3);
    let selectedTrimestre = "T" + trimActual; // T1, T2, T3, T4

    // Formateador de moneda
    const fmt = (num) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num || 0);

    // =========================================================
    // 🧠 1. LÓGICA DE CÁLCULO (EL CEREBRO)
    // =========================================================

    // A. CÁLCULO MENSUAL (Gestión P&L)
    const calcularPnL = (mes, anio) => {
        // 1. VENTAS
        const ventas = (db.facturas || []).filter(f => {
            const d = new Date(f.fecha || f.date);
            return d.getMonth() === mes && d.getFullYear() === anio;
        }).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);

        // 2. COSTE VENTAS (Albaranes)
        const compras = (db.albaranes || []).filter(a => {
            const d = new Date(a.fecha || a.date);
            return d.getMonth() === mes && d.getFullYear() === anio;
        }).reduce((acc, c) => acc + (parseFloat(c.total) || 0), 0);

        // 3. GASTOS FIJOS (Prorrateados)
        const fijos = (db.gastos_fijos || []).filter(g => g.active !== false).reduce((acc, g) => {
            let amount = parseFloat(g.amount) || 0;
            if (g.freq === 'anual') return acc + (amount / 12);
            if (g.freq === 'trimestral') return acc + (amount / 3);
            if (g.freq === 'semestral') return acc + (amount / 6);
            if (g.freq === 'bimensual') return acc + (amount / 2);
            if (g.freq === 'semanal') return acc + (amount * 4.33);
            return acc + amount;
        }, 0);

        // 4. AMORTIZACIONES (Del módulo Activos)
        const amortizaciones = (db.activos || []).reduce((acc, a) => {
            // importe / (vida_años * 12)
            return acc + ((parseFloat(a.importe) || 0) / ((parseInt(a.vida) || 10) * 12));
        }, 0);

        const totalGastos = compras + fijos + amortizaciones;
        const beneficio = ventas - totalGastos;
        const foodCostPct = ventas > 0 ? (compras / ventas) * 100 : 0;

        return { ventas, compras, fijos, amortizaciones, totalGastos, beneficio, foodCostPct };
    };

    // B. CÁLCULO TRIMESTRAL (Fiscal IVA)
    const calcularFiscal = (trim, anio) => {
        const mesesMap = { 'T1': [0,1,2], 'T2': [3,4,5], 'T3': [6,7,8], 'T4': [9,10,11] };
        const meses = mesesMap[trim];

        const isInTrim = (dateStr) => {
            if(!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === anio && meses.includes(d.getMonth());
        };

        // 1. IVA REPERCUTIDO (Ventas)
        // Estimación: Si no hay desglose, asumimos 10% IVA incluido
        let totalVentas = 0;
        let baseVentas = 0;
        let ivaRep = 0;

        (db.facturas || []).forEach(f => {
            if(isInTrim(f.fecha || f.date)) {
                const tot = parseFloat(f.total) || 0;
                totalVentas += tot;
                // Si tuvieras campo f.iva lo usas, sino estimamos:
                const base = tot / 1.10; 
                baseVentas += base;
                ivaRep += (tot - base);
            }
        });

        // 2. IVA SOPORTADO (Compras/Gastos)
        let totalCompras = 0;
        let ivaSop = 0;

        // Albaranes
        (db.albaranes || []).forEach(a => {
            if(isInTrim(a.fecha || a.date)) {
                const tot = parseFloat(a.total) || 0;
                totalCompras += tot;
                if(a.taxes) {
                    ivaSop += parseFloat(a.taxes);
                } else {
                    // Estimación 10% si no hay datos OCR
                    const base = tot / 1.10;
                    ivaSop += (tot - base);
                }
            }
        });

        // Gastos Fijos (Solo facturas reales, no nóminas ni alquileres sin iva)
        // Aquí simplificamos asumiendo que el 21% de los suministros/software llevan IVA
        (db.gastos_fijos || []).forEach(g => {
            if(g.cat === 'suministros' || g.cat === 'software' || g.cat === 'varios') {
                // Cálculo simple trimestral
                let mensual = parseFloat(g.amount) || 0;
                // Ajustar frecuencia
                let gastoTrim = 0;
                if(g.freq === 'mensual') gastoTrim = mensual * 3;
                else if(g.freq === 'trimestral') gastoTrim = mensual;
                
                // Estimamos 21% IVA en estos gastos
                const base = gastoTrim / 1.21;
                ivaSop += (gastoTrim - base);
            }
        });

        const liquidacion = ivaRep - ivaSop;
        return { totalVentas, ivaRep, ivaSop, liquidacion };
    };


    // =========================================================
    // 🎨 2. RENDERIZADO (LA VISTA)
    // =========================================================
    
    const pintar = () => {
        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <div class="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm flex relative z-10">
                <button id="tab-gestion" class="flex-1 py-3 rounded-2xl text-xs font-black uppercase transition-all ${currentTab === 'gestion' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}">
                    📅 Gestión Mensual
                </button>
                <button id="tab-fiscal" class="flex-1 py-3 rounded-2xl text-xs font-black uppercase transition-all ${currentTab === 'fiscal' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}">
                    🏛️ Fiscal / IVA
                </button>
            </div>

            <div id="view-container"></div>
        </div>`;

        // Lógica de Tabs
        container.querySelector('#tab-gestion').onclick = () => { currentTab = 'gestion'; pintar(); };
        container.querySelector('#tab-fiscal').onclick = () => { currentTab = 'fiscal'; pintar(); };

        // Inyectar la vista correspondiente
        const viewContainer = container.querySelector('#view-container');
        
        if (currentTab === 'gestion') {
            renderGestion(viewContainer);
        } else {
            renderFiscal(viewContainer);
        }
    };

    // --- VISTA A: GESTIÓN MENSUAL (Tu P&L estilo Cascada) ---
    const renderGestion = (target) => {
        const datos = calcularPnL(selectedMonth, selectedYear);
        const nombreMes = new Date(selectedYear, selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        
        // Color beneficio
        const colorBen = datos.beneficio >= 0 ? 'text-emerald-600' : 'text-rose-600';
        const bgBen = datos.beneficio >= 0 ? 'bg-emerald-50' : 'bg-rose-50';

        target.innerHTML = `
            <div class="animate-slide-up space-y-4">
                <div class="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <button id="prevMonth" class="w-8 h-8 rounded-full bg-slate-50 text-slate-400 font-black hover:bg-indigo-50 hover:text-indigo-600 transition">◀</button>
                    <div class="text-center">
                        <h2 class="text-lg font-black text-slate-800 uppercase">${nombreMes}</h2>
                        <p class="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Cuenta de Resultados</p>
                    </div>
                    <button id="nextMonth" class="w-8 h-8 rounded-full bg-slate-50 text-slate-400 font-black hover:bg-indigo-50 hover:text-indigo-600 transition">▶</button>
                </div>

                <div class="${bgBen} p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Beneficio Neto Real</p>
                    <h1 class="text-4xl font-black ${colorBen} tracking-tight">${fmt(datos.beneficio)}</h1>
                    <p class="text-[10px] text-slate-500 mt-2 font-bold opacity-70">
                        ${datos.ventas > 0 ? ((datos.beneficio/datos.ventas)*100).toFixed(1) : 0}% Rentabilidad
                    </p>
                </div>

                <div class="space-y-2">
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <span class="text-[10px] font-bold text-slate-400 uppercase">1. Ventas</span>
                        <span class="text-lg font-black text-indigo-600">${fmt(datos.ventas)}</span>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center relative overflow-hidden">
                         <div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-400"></div>
                        <div>
                            <span class="text-[10px] font-bold text-slate-400 uppercase">2. Compras (Food Cost)</span>
                            <span class="text-[9px] text-rose-400 ml-2 font-bold">${datos.foodCostPct.toFixed(1)}%</span>
                        </div>
                        <span class="text-base font-black text-rose-500">-${fmt(datos.compras)}</span>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center relative overflow-hidden">
                        <div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-400"></div>
                        <span class="text-[10px] font-bold text-slate-400 uppercase">3. Estructura (Fijos)</span>
                        <span class="text-base font-black text-orange-500">-${fmt(datos.fijos)}</span>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center relative overflow-hidden">
                        <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
                        <span class="text-[10px] font-bold text-slate-400 uppercase">4. Amortizaciones</span>
                        <span class="text-base font-black text-blue-500">-${fmt(datos.amortizaciones)}</span>
                    </div>
                </div>
            </div>
        `;

        // Eventos gestión
        target.querySelector("#prevMonth").onclick = () => {
            selectedMonth--; if(selectedMonth < 0) { selectedMonth=11; selectedYear--; }
            pintar();
        };
        target.querySelector("#nextMonth").onclick = () => {
            selectedMonth++; if(selectedMonth > 11) { selectedMonth=0; selectedYear++; }
            pintar();
        };
    };

    // --- VISTA B: FISCAL TRIMESTRAL (Tu estilo Dark Mode) ---
    const renderFiscal = (target) => {
        const datos = calcularFiscal(selectedTrimestre, yearFiscal);
        
        // Color Resultado IVA
        const colorIva = datos.liquidacion > 0 ? 'text-rose-400' : 'text-emerald-400'; // Positivo = Pagar a Hacienda
        const textoIva = datos.liquidacion > 0 ? 'A PAGAR' : 'A DEVOLVER';

        target.innerHTML = `
            <div class="animate-slide-up space-y-6">
                
                <div class="flex justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <div class="flex bg-slate-100 p-1 rounded-xl">
                        ${['T1','T2','T3','T4'].map(t => `
                            <button class="trim-btn px-4 py-2 rounded-lg text-[10px] font-black transition ${selectedTrimestre===t ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}" data-t="${t}">
                                ${t}
                            </button>
                        `).join('')}
                    </div>
                    <div class="px-4 font-black text-slate-300 text-lg">${yearFiscal}</div>
                </div>

                <div class="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                    
                    <div class="flex justify-between items-start mb-8 relative z-10">
                        <div>
                            <h3 class="text-sm font-bold text-slate-400 uppercase mb-1">🏛️ Liquidación IVA</h3>
                            <p class="text-[10px] text-slate-500">Modelo 303 (Estimado)</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-bold text-slate-300 uppercase mb-1">${textoIva}</p>
                            <p class="text-4xl font-black text-white ${colorIva}">${fmt(datos.liquidacion)}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 relative z-10">
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <p class="text-[9px] text-emerald-400 uppercase font-bold mb-1">REPERCUTIDO (+)</p>
                            <p class="text-lg font-black">${fmt(datos.ivaRep)}</p>
                            <p class="text-[8px] text-slate-500 mt-1">Cobrado en Ventas</p>
                        </div>
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <p class="text-[9px] text-rose-400 uppercase font-bold mb-1">SOPORTADO (-)</p>
                            <p class="text-lg font-black">${fmt(datos.ivaSop)}</p>
                            <p class="text-[8px] text-slate-500 mt-1">Pagado en Gastos</p>
                        </div>
                    </div>
                </div>

                <button class="w-full bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase hover:bg-slate-300 transition flex items-center justify-center gap-2">
                    📄 Descargar Borrador CSV
                </button>
            </div>
        `;

        // Eventos Fiscal
        target.querySelectorAll('.trim-btn').forEach(btn => {
            btn.onclick = (e) => {
                selectedTrimestre = e.target.dataset.t;
                pintar();
            };
        });
    };

    // Arrancar
    pintar();
}
