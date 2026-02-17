/* =============================================================
   🔐 MÓDULO: CIERRE CONTABLE (El Candado Mensual)
   ============================================================= */

export async function render(container, sb, db) {
    const saveFn = window.save || (async () => {});
    
    // 1. GESTIÓN DE DATOS
    if (!db.cierres_mensuales) db.cierres_mensuales = [];
    
    let year = new Date().getFullYear();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // 2. FUNCIÓN: CALCULAR DATOS DEL MES (EN VIVO)
    const getSnapshot = (mesIndex, anio) => {
        // Ingresos
        const ventas = (db.facturas || [])
            .filter(f => { const d = new Date(f.fecha); return d.getMonth() === mesIndex && d.getFullYear() === anio; })
            .reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);

        // Gastos Variables
        const compras = (db.albaranes || [])
            .filter(a => { const d = new Date(a.date); return d.getMonth() === mesIndex && d.getFullYear() === anio; })
            .reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);

        // Gastos Fijos (Estimados/Prorrateados)
        const fijos = (db.gastos_fijos || [])
            .filter(g => g.active !== false)
            .reduce((acc, g) => {
                let amount = parseFloat(g.amount) || 0;
                // Simplificación para snapshot
                if(g.freq === 'mensual') return acc + amount;
                if(g.freq === 'anual') return acc + (amount/12);
                return acc + amount; 
            }, 0);

        return { ventas, compras, fijos, resultado: ventas - compras - fijos };
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
                <div class="text-2xl font-black text-slate-300">${year}</div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${meses.map((nombreMes, i) => {
                    // Buscar si ya está cerrado
                    const cierre = db.cierres_mensuales.find(c => c.mes === i && c.anio === year);
                    const isClosed = !!cierre;
                    const datos = isClosed ? cierre.snapshot : getSnapshot(i, year);
                    const currentMonth = new Date().getMonth();
                    
                    // Estilos según estado
                    let estadoColor = isClosed ? 'bg-slate-800 text-white' : (i > currentMonth ? 'bg-slate-50 opacity-50' : 'bg-white border border-slate-100');
                    let icon = isClosed ? '🔒 CERRADO' : '🔓 ABIERTO';

                    return `
                    <div class="${estadoColor} p-6 rounded-[2rem] shadow-sm relative overflow-hidden transition hover:shadow-md group">
                        <div class="flex justify-between items-start mb-4">
                            <h3 class="font-black text-lg ${isClosed?'text-white':'text-slate-800'}">${nombreMes}</h3>
                            <span class="text-[9px] font-bold uppercase tracking-widest ${isClosed?'text-emerald-400':'text-slate-400'}">${icon}</span>
                        </div>

                        <div class="space-y-1 mb-4">
                            <div class="flex justify-between text-xs">
                                <span class="${isClosed?'text-slate-400':'text-slate-500'}">Ventas</span>
                                <span class="font-bold">${datos.ventas.toLocaleString('es-ES',{style:'currency', currency:'EUR'})}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="${isClosed?'text-slate-400':'text-slate-500'}">Gastos</span>
                                <span class="font-bold">${(datos.compras + datos.fijos).toLocaleString('es-ES',{style:'currency', currency:'EUR'})}</span>
                            </div>
                            <div class="w-full h-px ${isClosed?'bg-slate-600':'bg-slate-100'} my-2"></div>
                            <div class="flex justify-between text-sm font-black">
                                <span class="${isClosed?'text-slate-300':'text-slate-800'}">Resultado</span>
                                <span class="${datos.resultado >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${datos.resultado.toLocaleString('es-ES',{style:'currency', currency:'EUR'})}</span>
                            </div>
                        </div>

                        ${!isClosed && i <= currentMonth ? `
                            <button onclick="window.cerrarMes(${i}, ${year})" class="w-full py-3 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-600 hover:text-white transition">
                                CONGELAR MES
                            </button>
                        ` : ''}
                        
                        ${isClosed ? `
                             <p class="text-[9px] text-slate-500 text-center italic">Cerrado el ${new Date(cierre.fecha_cierre).toLocaleDateString()}</p>
                        ` : ''}
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    };

    // 4. LÓGICA DE CIERRE
    window.cerrarMes = async (mesIndex, anio) => {
        if(!confirm(`¿Estás SEGURO de cerrar ${meses[mesIndex]} ${anio}?\n\n⚠️ Esta acción guardará una copia fija de los datos. Si editas facturas antiguas después de esto, el cierre no cambiará.`)) return;

        const snapshot = getSnapshot(mesIndex, anio);
        
        db.cierres_mensuales.push({
            id: Date.now().toString(),
            mes: mesIndex,
            anio: anio,
            fecha_cierre: new Date().toISOString(),
            snapshot: snapshot // Guardamos los valores, no las referencias
        });

        await saveFn(`Mes de ${meses[mesIndex]} cerrado correctamente`);
        pintar();
    };

    pintar();
}
