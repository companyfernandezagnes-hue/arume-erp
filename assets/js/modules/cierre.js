/* =============================================================
   🔐 MÓDULO: CIERRE CONTABLE (Ventas = Caja Z | Gastos = Albaranes)
   ============================================================= */

export async function render(container, sb, db) {
    const saveFn = window.save || (async () => {});
    
    // 1. GESTIÓN DE DATOS
    if (!db.cierres_mensuales) db.cierres_mensuales = [];
    
    let year = new Date().getFullYear();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Helper para formatear dinero
    const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

    // Helper ROBUSTO para fechas (Anti-fallos)
    const parseDateSafe = (d) => {
        if (!d) return null;
        if (d instanceof Date) return d;
        // Si es timestamp numérico
        if (typeof d === 'number') return new Date(d);
        
        let s = String(d).trim();
        // Si es formato DD/MM/YYYY
        if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const parts = s.split('/');
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        // Si es formato YYYY-MM-DD (ISO)
        return new Date(s);
    };

    // Helper para limpiar números (1.200,50 -> 1200.50)
    const parseNum = (v) => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        let s = String(v).replace(/[^\d,.-]/g, '');
        if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
        else if (s.includes(',')) s = s.replace(',', '.');
        return parseFloat(s) || 0;
    };

    // 2. FUNCIÓN: CALCULAR DATOS DEL MES (EN VIVO)
    const getSnapshot = (mesIndex, anio) => {
        
        // --- A. INGRESOS REALES (SOLO CAJA DIARIA) ---
        const ventasCaja = (db.diario || [])
            .filter(d => {
                const fecha = parseDateSafe(d.date || d.fecha);
                if (!fecha || isNaN(fecha.getTime())) return false; // Fecha inválida
                return fecha.getMonth() === mesIndex && fecha.getFullYear() === anio;
            })
            .reduce((acc, d) => {
                const caja = parseNum(d.totalCaja);
                const tarjeta = parseNum(d.totalTarjeta);
                return acc + caja + tarjeta;
            }, 0);

        // --- B. GASTOS VARIABLES (TUS COMPRAS / ALBARANES) ---
        const compras = (db.albaranes || [])
            .filter(a => { 
                const fecha = parseDateSafe(a.date || a.fecha); 
                if (!fecha || isNaN(fecha.getTime())) return false;
                return fecha.getMonth() === mesIndex && fecha.getFullYear() === anio; 
            })
            .reduce((acc, a) => acc + parseNum(a.total), 0);

        // --- C. GASTOS FIJOS (ESTRUCTURA) ---
        const fijos = (db.gastos_fijos || [])
            .filter(g => g.active !== false)
            .reduce((acc, g) => {
                let amount = parseNum(g.amount);
                if(g.freq === 'mensual') return acc + amount;
                if(g.freq === 'trimestral') return acc + (amount/3);
                if(g.freq === 'anual') return acc + (amount/12);
                if(g.freq === 'bimensual') return acc + (amount/2);
                return acc + amount; 
            }, 0);

        return { 
            ventas: ventasCaja, 
            compras, 
            fijos, 
            resultado: ventasCaja - compras - fijos 
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
                                <span class="${isClosed?'text-slate-400':'text-slate-500'}">Ingresos (Caja Real)</span>
                                <span class="font-bold">${fmt(datos.ventas)}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="${isClosed?'text-slate-400':'text-slate-500'}">Compras (Albaranes)</span>
                                <span class="font-bold text-rose-400">-${fmt(datos.compras)}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="${isClosed?'text-slate-400':'text-slate-500'}">Gastos Fijos</span>
                                <span class="font-bold text-orange-400">-${fmt(datos.fijos)}</span>
                            </div>
                            
                            <div class="w-full h-px ${isClosed?'bg-slate-600':'bg-slate-100'} my-2"></div>
                            
                            <div class="flex justify-between text-sm font-black">
                                <span class="${isClosed?'text-slate-300':'text-slate-800'}">Beneficio</span>
                                <span class="${datos.resultado >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${fmt(datos.resultado)}</span>
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
        if(!confirm(`¿Estás SEGURO de cerrar ${meses[mesIndex]} ${anio}?\n\n⚠️ Esta acción guardará una copia fija de los datos del mes.`)) return;

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

    pintar();
}
