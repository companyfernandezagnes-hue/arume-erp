/* =============================================================
   🚀 ARUME ERP - NÚCLEO CENTRAL (app.js)
   ============================================================= */

// 0. UTILIDADES GLOBALES
window.Num = {
    parse: (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let clean = val.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
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
    
    // UI de carga inicial
    const container = document.getElementById('app');
    if(container) container.innerHTML = `<div class="flex h-full items-center justify-center"><p class="animate-pulse text-slate-400 font-bold text-xs uppercase">Sincronizando...</p></div>`;

    const { data, error } = await sb
        .from('arume_data')
        .select('data')
        .eq('id', 1)
        .single();

    if (error) {
        console.error("Error al bajar datos:", error);
        // Fallback local por si no hay internet
        const local = localStorage.getItem('arume_backup_local');
        if (local) window.db = JSON.parse(local);
    } else {
        window.db = data.data || {};
        // Inicializar estructuras vacías si es la primera vez
        if(!window.db.banco) window.db.banco = [];
        if(!window.db.platos) window.db.platos = [];
        if(!window.db.ventas_menu) window.db.ventas_menu = [];
        if(!window.db.diario) window.db.diario = [];
        
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

    // Feedback visual inmediato
    container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center space-y-4">
            <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p class="text-xs font-black text-slate-300 uppercase tracking-widest">Cargando ${name}...</p>
        </div>
    `;

    try {
        // --- MAPEADO DE NOMBRES (IMPORTANTE) ---
        let fileName = name;
        // Si pedimos 'diario', cargamos el archivo 'caja.js'
        if (name === 'diario') fileName = 'caja'; 
        // ---------------------------------------

        // TRUCO: Cache-busting para asegurar que carga siempre el código nuevo
        const modulePath = `./modules/${fileName}.js?v=${Date.now()}`;
        
        // Importación dinámica
        const mod = await import(modulePath);
        
        // Limpiar contenedor y renderizar módulo
        container.innerHTML = "";
        
        if (mod.render) {
            await mod.render(container, window.sb, window.db);
            
            // --- GESTIÓN DE BOTONES ACTIVOS (CORREGIDA) ---
            // Usamos clases seguras 'nav-icon' y 'nav-text' en lugar de selectores complejos
            document.querySelectorAll('.nav-icon').forEach(icon => {
                icon.style.opacity = '0.5';
                icon.style.transform = 'scale(1)';
            });
            document.querySelectorAll('.nav-text').forEach(text => {
                text.classList.remove('text-indigo-600');
                text.classList.add('text-slate-400');
            });

            // Activar el botón actual
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

// 5. MENÚ DE NAVEGACIÓN (Navbar con Clases Seguras)
function renderNav() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    // Estilo tipo "Dock" de macOS/iOS
    // NOTA: He añadido las clases 'nav-icon' y 'nav-text' para seleccionarlas sin errores
    nav.innerHTML = `
        <div class="flex items-center justify-between w-full overflow-x-auto gap-4 px-2 py-1 no-scrollbar">
            
            <button onclick="loadModule('dashboard')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">📊</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Dash</span>
            </button>
            
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

            <div class="w-px h-6 bg-slate-200 shrink-0"></div> 

            <button onclick="loadModule('menu')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🍽️</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Carta</span>
            </button>

            <button onclick="loadModule('banco')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">🏦</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">Banco</span>
            </button>
            
            <button onclick="loadModule('informes')" class="flex flex-col items-center gap-1 min-w-[45px] shrink-0 group">
                <span class="text-xl transition-all nav-icon">📈</span>
                <span class="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 nav-text">P&L</span>
            </button>

        </div>
    `;
}

// 6. FUNCIÓN GLOBAL PARA GUARDAR (Sincronización)
window.save = async function(mensaje = "Datos guardados") {
    // Marca de tiempo para control de versiones
    window.db.lastSync = Date.now();
    
    // Guardado Optimista
    localStorage.setItem('arume_backup_local', JSON.stringify(window.db));

    // Guardado Real (Nube)
    const { error } = await sb
        .from('arume_data')
        .upsert({ id: 1, data: window.db });

    if (error) {
        alert("⚠️ Error de sincronización: " + error.message);
        console.error(error);
        return false;
    } else {
        // Toast Notification
        const toast = document.createElement('div');
        toast.className = "fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl z-[10000] animate-fade-in";
        toast.innerHTML = `☁️ ${mensaje}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
        return true;
    }
};

// 7. LÓGICA DE BARRA DINÁMICA (Esconder al bajar, mostrar al subir)
let lastScrollTop = 0;
window.addEventListener("scroll", function() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    
    // Solo en móvil
    if(window.innerWidth > 1024) return;

    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 60) {
        // Bajando -> Esconder
        nav.style.transform = "translateY(150%)";
        nav.style.transition = "transform 0.3s ease-out";
    } else {
        // Subiendo -> Mostrar
        nav.style.transform = "translateY(0)";
        nav.style.transition = "transform 0.3s ease-out";
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}, false);
