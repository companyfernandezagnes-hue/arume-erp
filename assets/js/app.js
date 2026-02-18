/* =============================================================
   🚀 ARUME ERP - NÚCLEO CENTRAL (app.js) v2.0 (Con Cerebro Unificado)
   ============================================================= */

// 0. UTILIDADES GLOBALES
window.Num = {
    parse: (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let clean = val.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    },
    fmt: (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0)
};

window.DateUtil = {
    today: () => new Date().toISOString().split('T')[0],
    getMonthBounds: (month, year) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0); // Último día del mes
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
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

// 3. RECUPERAR DATOS REALES (CON BLOQUE DE SEGURIDAD)
async function cargarDatosDeLaNube() {
    console.log("📡 Conectando con Supabase...");
    
    // UI de carga inicial
    const container = document.getElementById('app');
    if(container) container.innerHTML = `<div class="flex h-full items-center justify-center flex-col gap-4"><div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p class="animate-pulse text-slate-400 font-bold text-xs uppercase tracking-widest">Sincronizando Sistema...</p></div>`;

    const { data, error } = await sb
        .from('arume_data') 
        .select('data')
        .eq('id', 1)
        .single();

    if (error) {
        console.error("Error al bajar datos:", error);
        const local = localStorage.getItem('arume_backup_local');
        if (local) window.db = JSON.parse(local);
    } else {
        window.db = data.data || {};
        
        // --- BLOQUE DE SEGURIDAD: INICIALIZAR ESTRUCTURAS ---
        if(!window.db.banco) window.db.banco = [];
        if(!window.db.platos) window.db.platos = [];
        if(!window.db.recetas) window.db.recetas = []; 
        if(!window.db.ingredientes) window.db.ingredientes = [];
        if(!window.db.ventas_menu) window.db.ventas_menu = [];
        if(!window.db.diario) window.db.diario = []; // Se mantiene por compatibilidad
        if(!window.db.cierres) window.db.cierres = []; // NUEVO: Aquí van los cierres Z
        if(!window.db.facturas) window.db.facturas = []; 
        if(!window.db.albaranes) window.db.albaranes = []; 
        if(!window.db.gastos_fijos) window.db.gastos_fijos = []; 
        if(!window.db.activos) window.db.activos = []; 
        if(!window.db.proveedores) window.db.proveedores = [];
        if(!window.db.cierres_mensuales) window.db.cierres_mensuales = [];
        if(!window.db.priceHistory) window.db.priceHistory = {};
        
        if(!window.db.config) window.db.config = { objetivoMensual: 30000 };
        // ---------------------------------------------------
        
        // Guardar copia local por seguridad
        localStorage.setItem('arume_backup_local', JSON.stringify(window.db));
        console.log("✅ Datos cargados correctamente.");
    }
    
    // Cargar Dashboard por defecto
    loadModule('dashboard');
}

// 4. EL NAVEGADOR DE MÓDULOS (Router)
window.loadModule = async function(name) {
    const container = document.getElementById('app');
    if (!container) return;

    container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center space-y-4">
            <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p class="text-xs font-black text-slate-300 uppercase tracking-widest">Cargando ${name}...</p>
        </div>
    `;

    try {
        let fileName = name;
        if (name === 'diario') fileName = 'caja'; 
        
        // Cache-busting para asegurar carga fresca
        const modulePath = `./modules/${fileName}.js?v=${Date.now()}`;
        
        const mod = await import(modulePath);
        
        container.innerHTML = "";
        
        if (mod.render) {
            await mod.render(container, window.sb, window.db);
            
            // Gestión de botones activos
            document.querySelectorAll('.nav-icon').forEach(icon => {
                icon.style.opacity = '0.5';
                icon.style.transform = 'scale(1)';
            });
            document.querySelectorAll('.nav-text').forEach(text => {
                text.classList.remove('text-indigo-600');
                text.classList.add('text-slate-400');
            });

            const activeBtn = document.querySelector(`button[onclick="loadModule('${name}')"]`);
            if (activeBtn) {
                const icon = activeBtn.querySelector('.nav-icon');
                const text = activeBtn.querySelector('.nav-text');
                if(icon) {
                    icon.style.opacity = '1';
                    icon.style.transform = 'scale(1.2)';
                    icon.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                }
                if(text) {
                    text.classList.remove('text-slate-400');
                    text.classList.add('text-indigo-600');
                }
            }
        }
        
    } catch (e) {
        console.error("Error crítico en loadModule:", e);
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full p-6 text-center">
                <div class="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm">
                    <p class="text-3xl mb-2">😵</p>
                    <p class="text-rose-600 font-black text-sm uppercase">Error cargando módulo</p>
                    <p class="text-slate-400 text-xs mt-2 font-mono bg-white p-2 rounded border border-rose-50">${e.message}</p>
                    <button onclick="location.reload()" class="mt-4 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg">Reiniciar App</button>
                </div>
            </div>`;
    }
};

// 5. MENÚ DE NAVEGACIÓN
function renderNav() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    nav.innerHTML = `
        <div class="flex items-center justify-between w-full overflow-x-auto gap-4 px-2 py-1 no-scrollbar">
            
            <button onclick="loadModule('dashboard')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">📊</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Dash</span>
            </button>
            
            <div class="w-px h-6 bg-slate-200 shrink-0"></div> 

            <button onclick="loadModule('diario')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">💵</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Caja</span>
            </button>
            
            <button onclick="loadModule('facturas')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">📄</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Ventas</span>
            </button>
            
            <button onclick="loadModule('albaranes')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🚚</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Gastos</span>
            </button>

            <button onclick="loadModule('tesoreria')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">⚖️</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Deuda</span>
            </button>

            <div class="w-px h-6 bg-slate-200 shrink-0"></div> 

            <button onclick="loadModule('liquidez')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🔮</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Futuro</span>
            </button>

            <button onclick="loadModule('banco')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🏦</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Banco</span>
            </button>

            <button onclick="loadModule('gastos_fijos')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🏢</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Fijos</span>
            </button>

            <div class="w-px h-6 bg-slate-200 shrink-0"></div> 

            <button onclick="loadModule('informes')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">📈</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">P&L</span>
            </button>

            <button onclick="loadModule('cierre')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🔒</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Cierre</span>
            </button>

            <button onclick="loadModule('proveedores')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🤝</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Provs</span>
            </button>

            <button onclick="loadModule('amortizaciones')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">📉</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Amort.</span>
            </button>

        </div>
    `;
}

// 6. FUNCIÓN GLOBAL PARA GUARDAR
window.save = async function(mensaje = "Datos guardados") {
    window.db.lastSync = Date.now();
    localStorage.setItem('arume_backup_local', JSON.stringify(window.db));

    const { error } = await sb
        .from('arume_data') 
        .upsert({ id: 1, data: window.db });

    if (error) {
        alert("⚠️ Error de sincronización: " + error.message);
        console.error(error);
        return false;
    } else {
        const toast = document.createElement('div');
        toast.className = "fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl z-[10000] animate-fade-in";
        toast.innerHTML = `☁️ ${mensaje}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
        return true;
    }
};

// =============================================================
// 7. LÓGICA DE NEGOCIO GLOBAL (El "Cerebro")
// =============================================================

// Cálculo de amortizaciones
window.calcularAmortizacionMensual = function(activos) {
    if (!activos || activos.length === 0) return 0;
    const hoy = new Date();
    let gastoTotalMes = 0;

    activos.forEach(activo => {
        if(!activo.fecha_compra || !activo.importe || (!activo.vida_util_meses && !activo.vida)) return;
        const vidaMeses = activo.vida_util_meses || (activo.vida * 12);
        const fechaCompra = new Date(activo.fecha_compra || activo.fecha);
        const mesesTranscurridos = (hoy.getFullYear() - fechaCompra.getFullYear()) * 12 + (hoy.getMonth() - fechaCompra.getMonth());
        
        if (mesesTranscurridos >= 0 && mesesTranscurridos < vidaMeses) {
            gastoTotalMes += (activo.importe / vidaMeses);
        }
    });
    return gastoTotalMes;
};

// Motor Central de Cálculos (ArumeEngine)
window.ArumeEngine = {
    // 1. OBTENER VENTAS REALES (Cajas Z + Facturas Extras)
    getVentas: (desde, hasta) => {
        const cajaTotal = (window.db.cierres || [])
            .filter(c => c.date >= desde && c.date <= hasta)
            .reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0);
            
        const facturasTotal = (window.db.facturas || [])
            .filter(f => f.date >= desde && f.date <= hasta && !String(f.num).startsWith('Z-')) // Excluir Z duplicadas
            .reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);

        return cajaTotal + facturasTotal;
    },

    // 2. OBTENER GASTOS REALES (Albaranes)
    getGastos: (desde, hasta) => {
        return (window.db.albaranes || [])
            .filter(a => a.date >= desde && a.date <= hasta)
            .reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);
    },

    // 3. BENEFICIO NETO (Profit)
    getProfit: (mes, año) => {
        const { start, end } = window.DateUtil.getMonthBounds(mes, año);
        
        const ingresos = window.ArumeEngine.getVentas(start, end);
        const gastosVariables = window.ArumeEngine.getGastos(start, end);
        
        // Gastos Fijos (Prorrateo inteligente)
        const fijos = (window.db.gastos_fijos || [])
            .filter(g => g.active !== false)
            .reduce((acc, g) => {
                let val = parseFloat(g.amount) || 0;
                if(g.freq === 'anual') val = val / 12;
                if(g.freq === 'trimestral') val = val / 3;
                return acc + val;
            }, 0);
            
        const amortizaciones = window.calcularAmortizacionMensual(window.db.activos || []);
        
        return {
            ingresos,
            gastos: gastosVariables + fijos + amortizaciones,
            neto: ingresos - (gastosVariables + fijos + amortizaciones),
            desglose: { variables: gastosVariables, fijos, amortizaciones }
        };
    }
};

// Comprobador de periodos
window.isInPeriod = function(dateStr) {
    // Por defecto true, pero preparado para filtros globales futuros
    return true; 
};

// 8. LÓGICA DE BARRA DINÁMICA
let lastScrollTop = 0;
window.addEventListener("scroll", function() {
    const nav = document.getElementById("navbar");
    if (!nav || window.innerWidth > 1024) return;
    
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 60) {
        nav.style.transform = "translateY(150%)"; // Esconder
    } else {
        nav.style.transform = "translateY(0)"; // Mostrar
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}, false);
