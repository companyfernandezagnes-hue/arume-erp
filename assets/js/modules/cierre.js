/* =============================================================
   🔐 MÓDULO: CIERRE CONTABLE (Congelación de Periodos)
   v2.0 - Conectado a ArumeEngine
   ============================================================= */

export async function render(container, sb, db) {
    const saveFn = window.save || (async () => {});
    
    // 1. GESTIÓN DE DATOS
    if (!db.cierres_mensuales) db.cierres_mensuales = [];
    
    let year = new Date().getFullYear();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Helper para formatear dinero
    const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

    // 2. FUNCIÓN: CALCULAR DATOS DEL MES (EN VIVO USANDO EL CEREBRO)
    const getSnapshot = (mesIndex, anio) => {
        // Usamos el motor central para garantizar que los números cuadren con el resto de la app
        const data = window.ArumeEngine.getProfit(mesIndex, anio);
        
        return { 
            ventas: data.ingresos, 
            compras: data.desglose.variables, 
            fijos: data.desglose.fijos,
            amortizaciones: data.desglose.amortizaciones,
            resultado: data.neto 
        };
    };

    // 3. RENDERIZADO
    const pintar = () => {
        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Cierre Contable</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Congelar Periodos</p>
                </div>
                <div class="flex items-center gap-4">
                     <div class="flex bg-slate-100 p-1 rounded-xl">
                        <button onclick="window.changeYear(-1)" class="w-8 h-8 flex items-center justify-center text-slate-500 font-bold hover:bg-white rounded-lg transition">‹</button>
                        <span class="px-3 py-1 font-black text-slate-700 flex items-center">${year}</span>
                        <button onclick="window.changeYear(1)" class="w-8 h-8 flex items-center justify-center text-slate-500 font-bold hover:bg-white rounded-lg transition">›</button>
                    </div>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${meses.map((nombreMes, i) => {
                    // Buscar si ya está cerrado en la base de datos
                    const cierre = db.cierres_mensuales.find(c => c.mes === i && c.anio === year);
                    const isClosed = !!cierre;
                    
                    // Si está cerrado, usamos la foto fija. Si no, calculamos en vivo.
                    const datos = isClosed ? cierre.snapshot : getSnapshot(i, year);
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    
                    // Lógica visual: ¿Podemos cerrar este mes?
                    // Solo permitimos cerrar meses pasados o el actual
                    const canClose = !isClosed && (year < currentYear || (year === currentYear && i <= currentMonth));

                    // Estilos según estado
                    let estadoColor = isClosed ? 'bg-slate-900 text-white' : (canClose ? 'bg-white border border-slate-100' : 'bg-slate-50 border border-transparent opacity-60');
                    let icon = isClosed ? '🔒 CERRADO' : '🔓 ABIERTO';
                    let textColor = isClosed ? 'text-slate-300' : 'text-slate-500';
                    let numColor = isClosed ? 'text-white' : 'text-slate-900';

                    return `
                    <div class="${estadoColor} p-6 rounded-[2rem] shadow-sm relative overflow-hidden transition hover:shadow-md group">
                        <div class="flex justify-between items-start mb-4">
                            <h3 class="font-black text-lg ${isClosed?'text-white':'text-slate-800'}">${nombreMes}</h3>
                            <span class="text-[9px] font-bold uppercase tracking-widest ${isClosed?'text-emerald-400':'text-slate-400'}">${icon}</span>
                        </div>

                        <div class="space-y-2 mb-4">
                            <div class="flex justify-between text-xs">
                                <span class="${textColor}">Ingresos</span>
                                <span class="font-bold ${numColor}">${fmt(datos.ventas)}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="${textColor}">Compras</span>
                                <span class="font-bold ${isClosed?'text-rose-300':'text-rose-500'}">-${fmt(datos.compras)}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="${textColor}">Estructura</span>
                                <span class="font-bold ${isClosed?'text-orange-300':'text-orange-500'}">-${fmt(datos.fijos)}</span>
                            </div>
                            
                            <div class="w-full h-px ${isClosed?'bg-slate-700':'bg-slate-100'} my-2"></div>
                            
                            <div class="flex justify-between text-sm font-black">
                                <span class="${isClosed?'text-slate-400':'text-slate-800'}">Beneficio</span>
                                <span class="${datos.resultado >= 0 ? (isClosed?'text-emerald-400':'text-emerald-600') : (isClosed?'text-rose-400':'text-rose-600')}">${fmt(datos.resultado)}</span>
                            </div>
                        </div>

                        ${canClose ? `
                            <button onclick="window.cerrarMes(${i}, ${year})" class="w-full py-3 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-600 hover:text-white transition shadow-sm">
                                ❄️ CONGELAR MES
                            </button>
                        ` : ''}
                        
                        ${isClosed ? `
                             <div class="mt-4 flex justify-between items-center opacity-50">
                                <p class="text-[9px] text-slate-400 italic">Cerrado el ${new Date(cierre.fecha_cierre).toLocaleDateString()}</p>
                                <button onclick="window.abrirMes('${cierre.id}')" class="text-[9px] text-rose-400 hover:text-white hover:bg-rose-500 px-2 py-1 rounded transition">REABRIR</button>
                             </div>
                        ` : ''}
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    };

    // 4. FUNCIONES GLOBALES
    window.changeYear = (delta) => {
        year += delta;
        pintar();
    };

    window.cerrarMes = async (mesIndex, anio) => {
        if(!confirm(`¿Estás SEGURO de cerrar ${meses[mesIndex]} ${anio}?\n\n⚠️ Esta acción guardará una copia fija de los datos. Si cambias facturas antiguas, este informe NO se actualizará a menos que lo reabras.`)) return;

        const snapshot = getSnapshot(mesIndex, anio);
        
        db.cierres_mensuales.push({
            id: Date.now().toString(),
            mes: mesIndex,
            anio: anio,
            fecha_cierre: new Date().toISOString(),
            snapshot: snapshot 
        });

        await saveFn(`Mes de ${meses[mesIndex]} cerrado correctamente`);
        pintar();
    };

    window.abrirMes = async (id) => {
        if(!confirm("⚠️ ¿Reabrir este mes? \n\nLos datos volverán a calcularse en vivo. Perderás la 'foto' que tenías guardada.")) return;
        
        db.cierres_mensuales = db.cierres_mensuales.filter(c => c.id !== id);
        await saveFn("Mes reabierto. Recalculando...");
        pintar();
    };

    pintar();
}
