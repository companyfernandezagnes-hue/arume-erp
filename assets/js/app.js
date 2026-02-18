/* =============================================================
   🚀 ARUME ERP - NÚCLEO CENTRAL (app.js) v3.0 [MASTER BRAIN]
   ============================================================= */

// 0. UTILIDADES GLOBALES
window.Num = {
    parse: (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let clean = val.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    },
    fmt: (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val || 0),
    fmtDec: (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0)
};

window.DateUtil = {
    today: () => new Date().toISOString().split('T')[0],
    getMonthBounds: (month, year) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0); // Último día del mes
        return { start, end };
    },
    parse: (d) => {
        if (!d) return new Date();
        if (d instanceof Date) return d;
        // Soporte básico para strings
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

// 3. RECUPERAR DATOS REALES
async function cargarDatosDeLaNube() {
    console.log("📡 Conectando con Supabase...");
    
    const container = document.getElementById('app');
    if(container) container.innerHTML = `<div class="flex h-full items-center justify-center flex-col gap-4"><div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p class="animate-pulse text-slate-400 font-bold text-xs uppercase tracking-widest">Sincronizando Cerebro...</p></div>`;

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
        ['banco','platos','recetas','ingredientes','ventas_menu','cierres','facturas','albaranes','gastos_fijos','activos','proveedores','cierres_mensuales'].forEach(k => {
            if(!window.db[k]) window.db[k] = [];
        });
        
        // Compatibilidad con versiones antiguas
        if(!window.db.diario) window.db.diario = []; 
        if(!window.db.priceHistory) window.db.priceHistory = {};
        if(!window.db.config) window.db.config = { objetivoMensual: 40000 };
        
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
        
        const modulePath = `./modules/${fileName}.js?v=${Date.now()}`;
        const mod = await import(modulePath);
        
        container.innerHTML = "";
        
        if (mod.render) {
            await mod.render(container, window.sb, window.db);
            updateNavState(name);
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

function updateNavState(name) {
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

// 5. MENÚ DE NAVEGACIÓN
function renderNav() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    // Iconos mapeados
    const icons = {
        dashboard: '📊', diario: '💵', facturas: '📄', albaranes: '🚚',
        tesoreria: '⚖️', liquidez: '🔮', banco: '🏦', gastos_fijos: '🏢',
        informes: '📈', cierre: '🔒', proveedores: '🤝', amortizaciones: '📉'
    };

    const menuItems = ['dashboard', 'diario', 'facturas', 'albaranes', 'tesoreria', 'liquidez', 'banco', 'gastos_fijos', 'informes', 'cierre', 'proveedores', 'amortizaciones'];

    nav.innerHTML = `
        <div class="flex items-center justify-between w-full overflow-x-auto gap-4 px-2 py-1 no-scrollbar">
            ${menuItems.map(item => `
                <button onclick="loadModule('${item}')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                    <span class="text-xl transition-all nav-icon">${icons[item] || '●'}</span>
                    <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">${item.substr(0,4)}</span>
                </button>
                ${['dashboard','tesoreria','gastos_fijos'].includes(item) ? '<div class="w-px h-6 bg-slate-200 shrink-0"></div>' : ''}
            `).join('')}
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
// 🧠 7. ARUME ENGINE v3.0 (Cerebro Analítico Master)
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

// Motor Central de Cálculos
window.ArumeEngine = {
    
    // Obtener Beneficio Detallado (Usado por Dashboard y P&L)
    getProfit: (month, year) => {
        const { start, end } = window.DateUtil.getMonthBounds(month, year);
        const sTime = start.getTime();
        const eTime = end.getTime();

        // A. INGRESOS (Desglose Caja vs Facturas)
        let cajaZ = 0, facturasB2B = 0;
        
        // 1. Cajas Z (Cierres diarios)
        (window.db.cierres || []).forEach(c => {
            const d = new Date(c.date).getTime();
            if(d >= sTime && d <= eTime) cajaZ += window.Num.parse(c.totalVenta);
        });

        // 2. Facturas Extra (Eventos, Catering) - Ignoramos las que empiezan por Z (duplicadas de cierres)
        (window.db.facturas || []).forEach(f => {
            const d = new Date(f.date).getTime();
            if(d >= sTime && d <= eTime && !String(f.num).toUpperCase().startsWith('Z')) {
                facturasB2B += window.Num.parse(f.total);
            }
        });

        const totalIngresos = cajaZ + facturasB2B;

        // B. GASTOS VARIABLES (Categorización Automática)
        let gComida = 0, gBebida = 0, gOtros = 0;
        
        (window.db.albaranes || []).forEach(a => {
            const d = new Date(a.date).getTime();
            if(d >= sTime && d <= eTime) {
                const total = window.Num.parse(a.total);
                const p = (a.prov || '').toLowerCase();
                
                // Heurística de categorización por palabras clave
                if (p.match(/fruta|carne|pesca|makro|mercadona|pan|huevo|verdu|aliment|chef|congelado|lidl|dia|eroski/)) {
                    gComida += total;
                } else if (p.match(/estrella|mahou|coca|vino|bebida|licor|bodega|drinks|cerveza|agua|cafe|schweppes/)) {
                    gBebida += total;
                } else {
                    gOtros += total; // Limpieza, suministros, reparaciones
                }
            }
        });

        // C. GASTOS FIJOS (Estructura)
        let gPersonal = 0, gEstructura = 0;
        (window.db.gastos_fijos || []).filter(g => g.active !== false).forEach(g => {
            let val = window.Num.parse(g.amount);
            // Prorrateo según frecuencia
            if(g.freq === 'anual') val /= 12;
            if(g.freq === 'semestral') val /= 6;
            if(g.freq === 'trimestral') val /= 3;
            if(g.freq === 'bimensual') val /= 2;
            
            if(g.cat === 'personal') gPersonal += val;
            else gEstructura += val; // Alquiler, luz, gestoria...
        });

        // D. AMORTIZACIONES
        const gAmort = window.calcularAmortizacionMensual(window.db.activos);

        const totalGastos = gComida + gBebida + gOtros + gPersonal + gEstructura + gAmort;

        return {
            ingresos: { 
                total: totalIngresos, 
                caja: cajaZ, 
                b2b: facturasB2B 
            },
            gastos: { 
                total: totalGastos,
                comida: gComida,
                bebida: gBebida,
                personal: gPersonal,
                otros: gOtros,
                estructura: gEstructura,
                amortizacion: gAmort
            },
            neto: totalIngresos - totalGastos,
            // Ratios listos para usar en Dashboard
            ratios: {
                foodCost: totalIngresos ? (gComida/totalIngresos)*100 : 0,
                drinkCost: totalIngresos ? (gBebida/totalIngresos)*100 : 0,
                staffCost: totalIngresos ? (gPersonal/totalIngresos)*100 : 0,
                primeCost: totalIngresos ? ((gComida+gBebida+gPersonal)/totalIngresos)*100 : 0
            }
        };
    }
};

// Comprobador de periodos (Helper global)
window.isInPeriod = function(dateStr) {
    return true; 
};

// 8. LÓGICA DE BARRA DINÁMICA (UX Móvil)
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
