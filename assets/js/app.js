/* =============================================================
   🚀 ARUME ERP - NÚCLEO CENTRAL (app.js) v3.3 [MASTER BRAIN + MENUS]
   ============================================================= */

// 0. UTILIDADES GLOBALES
window.Num = {
    parse: (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let clean = val.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    },
    fmt: (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val || 0)
};

window.DateUtil = {
    today: () => new Date().toISOString().split('T')[0],
    getMonthBounds: (month, year) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0); 
        return { start, end };
    },
    parse: (d) => {
        if (!d) return new Date();
        if (d instanceof Date) return d;
        // Detectar formato DD/MM/YYYY del backup antiguo
        if (typeof d === 'string' && d.includes('/')) {
            const [dia, mes, anio] = d.split('/');
            return new Date(`${anio.length===2?'20'+anio:anio}-${mes}-${dia}`);
        }
        return new Date(d);
    }
};

// 1. CONFIGURACIÓN SUPABASE
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST"; 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb;
window.db = {}; 

// 2. ARRANQUE
document.addEventListener("DOMContentLoaded", async () => {
    renderNav(); 
    await cargarDatosDeLaNube();
});

// 3. RECUPERAR DATOS Y MIGRAR
async function cargarDatosDeLaNube() {
    console.log("📡 Conectando...");
    const container = document.getElementById('app');
    if(container) container.innerHTML = `<div class="flex h-full items-center justify-center flex-col gap-4"><div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p class="animate-pulse text-slate-400 font-bold text-xs uppercase tracking-widest">Sincronizando Cerebro...</p></div>`;

    const { data, error } = await sb.from('arume_data').select('data').eq('id', 1).single();

    if (error) {
        console.error("Error nube:", error);
        const local = localStorage.getItem('arume_backup_local');
        if (local) window.db = JSON.parse(local);
    } else {
        window.db = data.data || {};
        
        // --- INICIALIZAR ESTRUCTURAS ---
        ['banco','platos','recetas','ingredientes','ventas_menu','cierres','facturas','albaranes','gastos_fijos','activos','proveedores','cierres_mensuales'].forEach(k => {
            if(!window.db[k]) window.db[k] = [];
        });
        
        if(!window.db.diario) window.db.diario = []; 
        if(!window.db.priceHistory) window.db.priceHistory = {};
        if(!window.db.config) window.db.config = { objetivoMensual: 40000 };
        
        // =========================================================
        // 🔄 AUTO-MIGRACIÓN (Fix de Copilot: Normalizar Datos)
        // =========================================================
        if (window.db.diario.length > 0) {
            window.db.diario.forEach(old => {
                let isoDate = old.date || old.fecha;
                // Normalizar fecha DD/MM/YYYY -> YYYY-MM-DD
                if(isoDate && isoDate.includes('/')) {
                     const [d,m,y] = isoDate.split('/');
                     isoDate = `${y.length===2?'20'+y:y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                
                // Evitar duplicados comprobando fecha e importe
                const totalOld = window.Num.parse(old.totalVenta || old.total || 0);
                const exists = window.db.cierres.some(c => c.date === isoDate && Math.abs(c.totalVenta - totalOld) < 1);
                
                if (!exists && isoDate) {
                    window.db.cierres.push({
                        id: old.id || `mig-${Date.now()}-${Math.random()}`,
                        date: isoDate,
                        totalVenta: totalOld,
                        efectivo: window.Num.parse(old.totalCaja || old.cash || 0),
                        tarjeta: window.Num.parse(old.totalTarjeta || old.card || 0),
                        apps: window.Num.parse(old.glovo || 0) + window.Num.parse(old.uber || 0),
                        tickets: parseInt(old.tickets || 0),
                        conciliado_banco: false
                    });
                }
            });
        }
        // =========================================================

        localStorage.setItem('arume_backup_local', JSON.stringify(window.db));
    }
    loadModule('dashboard');
}

// 4. ROUTER
window.loadModule = async function(name) {
    const container = document.getElementById('app');
    if (!container) return;
    container.innerHTML = `<div class="h-full flex flex-col items-center justify-center space-y-4"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    try {
        let fileName = name;
        if (name === 'diario') fileName = 'caja';
        if (name === 'menus') fileName = 'menus'; // Aseguramos que cargue menus.js
        
        const modulePath = `./modules/${fileName}.js?v=${Date.now()}`;
        const mod = await import(modulePath);
        
        container.innerHTML = "";
        
        if (mod.render) {
            await mod.render(container, window.sb, window.db);
            updateNavState(name);
        }
        
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-10 text-center"><p class="text-rose-500 font-bold">Error cargando ${name}</p><p class="text-xs text-slate-400">${e.message}</p></div>`;
    }
};

function updateNavState(name) {
    document.querySelectorAll('.nav-icon').forEach(i => { i.style.opacity='0.5'; i.style.transform='scale(1)'; });
    document.querySelectorAll('.nav-text').forEach(t => { t.classList.remove('text-indigo-600'); t.classList.add('text-slate-400'); });
    const btn = document.querySelector(`button[onclick="loadModule('${name}')"]`);
    if (btn) {
        btn.querySelector('.nav-icon').style.opacity='1';
        btn.querySelector('.nav-icon').style.transform='scale(1.2)';
        btn.querySelector('.nav-text').classList.replace('text-slate-400','text-indigo-600');
    }
}

// 5. NAVBAR (Con Botón Menús Recuperado Y BOTÓN IMPORTADOR AÑADIDO)
function renderNav() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    
    // Iconos mapeados (AQUÍ AÑADIMOS EL DE IMPORTADOR)
    const icons = { 
        dashboard: '📊', diario: '💵', importador: '📥', facturas: '📄', albaranes: '🚚', 
        tesoreria: '⚖️', liquidez: '🔮', banco: '🏦', gastos_fijos: '🏢', 
        informes: '📈', menus: '🍽️', cierre: '🔒', proveedores: '🤝', amortizaciones: '📉' 
    };
    
    // Lista ordenada de módulos (AQUÍ AÑADIMOS 'importador')
    const menuItems = ['dashboard', 'diario', 'importador', 'facturas', 'albaranes', 'tesoreria', 'liquidez', 'banco', 'gastos_fijos', 'informes', 'menus', 'cierre'];

    nav.innerHTML = `
        <div class="flex items-center justify-between w-full overflow-x-auto gap-4 px-2 py-1 no-scrollbar">
            ${menuItems.map(item => `
                <button onclick="loadModule('${item}')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                    <span class="text-xl transition-all nav-icon">${icons[item] || '●'}</span>
                    <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">${item.substr(0,4)}</span>
                </button>
                ${['dashboard','tesoreria','gastos_fijos','menus'].includes(item) ? '<div class="w-px h-6 bg-slate-200 shrink-0"></div>' : ''}
            `).join('')}
        </div>
    `;
}

// 6. GUARDAR
window.save = async function(mensaje = "Datos guardados") {
    window.db.lastSync = Date.now();
    localStorage.setItem('arume_backup_local', JSON.stringify(window.db));
    const { error } = await sb.from('arume_data').upsert({ id: 1, data: window.db });
    if (!error) {
        const t = document.createElement('div');
        t.className = "fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl z-[9999] animate-fade-in";
        t.innerHTML = `☁️ ${mensaje}`; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);
    }
    return !error;
};

// =============================================================
// 🧠 7. ARUME ENGINE v3.3 (CEREBRO DEFINITIVO)
// =============================================================

window.calcularAmortizacionMensual = function(activos) {
    if (!activos || activos.length === 0) return 0;
    const hoy = new Date();
    let total = 0;
    activos.forEach(a => {
        if(!a.fecha_compra || !a.importe || !a.vida_util_meses) return;
        const vida = a.vida_util_meses;
        const fecha = new Date(a.fecha_compra);
        const meses = (hoy.getFullYear() - fecha.getFullYear()) * 12 + (hoy.getMonth() - fecha.getMonth());
        if (meses >= 0 && meses < vida) total += (a.importe / vida);
    });
    return total;
};

window.ArumeEngine = {
    getProfit: (month, year) => {
        const { start, end } = window.DateUtil.getMonthBounds(month, year);
        const sTime = start.getTime();
        const eTime = end.getTime();

        // A. INGRESOS (USANDO DB.CIERRES)
        let cajaZ = 0, facturasB2B = 0;
        
        (window.db.cierres || []).forEach(c => {
            const d = new Date(c.date).getTime();
            if(d >= sTime && d <= eTime) cajaZ += window.Num.parse(c.totalVenta);
        });

        (window.db.facturas || []).forEach(f => {
            const d = new Date(f.date).getTime();
            if(d >= sTime && d <= eTime && !String(f.num).toUpperCase().startsWith('Z')) {
                facturasB2B += window.Num.parse(f.total);
            }
        });

        const totalIngresos = cajaZ + facturasB2B;

        // B. GASTOS VARIABLES (Con heurística)
        let gComida = 0, gBebida = 0, gOtros = 0;
        (window.db.albaranes || []).forEach(a => {
            const d = new Date(a.date).getTime();
            if(d >= sTime && d <= eTime) {
                const total = window.Num.parse(a.total);
                const p = (a.prov || '').toLowerCase();
                
                if (p.match(/fruta|carne|pesca|makro|mercadona|pan|huevo|verdu|aliment|chef|congelado|lidl|dia|eroski|assortiment|gourmet/)) gComida += total;
                else if (p.match(/estrella|mahou|coca|vino|bebida|licor|bodega|drinks|cerveza|agua|cafe|schweppes|pepsi/)) gBebida += total;
                else gOtros += total;
            }
        });

        // C. GASTOS FIJOS
        let gPersonal = 0, gEstructura = 0;
        (window.db.gastos_fijos || []).filter(g => g.active !== false).forEach(g => {
            let val = window.Num.parse(g.amount);
            if(g.freq === 'anual') val /= 12;
            if(g.freq === 'semestral') val /= 6;
            if(g.freq === 'trimestral') val /= 3;
            if(g.freq === 'bimensual') val /= 2;
            
            // Detección automática por nombre si la categoría no está clara
            const name = (g.name || '').toLowerCase();
            if(g.cat === 'personal' || name.includes('nomina') || name.includes('seg.soc')) gPersonal += val;
            else gEstructura += val;
        });

        // D. AMORTIZACIONES
        const gAmort = window.calcularAmortizacionMensual(window.db.activos);
        const totalGastos = gComida + gBebida + gOtros + gPersonal + gEstructura + gAmort;

        return {
            ingresos: { total: totalIngresos, caja: cajaZ, b2b: facturasB2B },
            gastos: { total: totalGastos, comida: gComida, bebida: gBebida, personal: gPersonal, otros: gOtros, estructura: gEstructura, amortizacion: gAmort },
            neto: totalIngresos - totalGastos,
            ratios: {
                foodCost: totalIngresos ? (gComida/totalIngresos)*100 : 0,
                drinkCost: totalIngresos ? (gBebida/totalIngresos)*100 : 0,
                staffCost: totalIngresos ? (gPersonal/totalIngresos)*100 : 0,
                primeCost: totalIngresos ? ((gComida+gBebida+gPersonal)/totalIngresos)*100 : 0
            }
        };
    }
};

let lastScrollTop = 0;
window.addEventListener("scroll", function() {
    const nav = document.getElementById("navbar");
    if (!nav || window.innerWidth > 1024) return;
    let st = window.pageYOffset || document.documentElement.scrollTop;
    nav.style.transform = (st > lastScrollTop && st > 60) ? "translateY(150%)" : "translateY(0)";
    lastScrollTop = st <= 0 ? 0 : st;
}, false);
