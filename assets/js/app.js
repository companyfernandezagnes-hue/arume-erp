/* =============================================================
   🚀 ARUME ERP - NÚCLEO CENTRAL (app.js)
   ============================================================= */

// Traductor universal de números
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
    const { data, error } = await sb
        .from('arume_data')
        .select('data')
        .eq('id', 1)
        .single();

    if (error) {
        console.error("Error al bajar datos:", error);
        const local = localStorage.getItem('arume_v152');
        if (local) window.db = JSON.parse(decodeURIComponent(atob(local)));
    } else {
        window.db = data.data;
        console.log("✅ Datos cargados correctamente.");
    }
    loadModule('dashboard');
}

// 4. EL NAVEGADOR DE MÓDULOS (VERSIÓN DEFINITIVA)
window.loadModule = async function(name) {
    const container = document.getElementById('app');
    if (!container) return;

    container.innerHTML = `<div class="p-10 text-center animate-pulse text-slate-400 uppercase text-xs font-black">Cargando ${name}...</div>`;

    try {
        let fileName = name;
        if (name === 'diario') fileName = 'caja';

        // TRUCO: Añadimos ?v=Date.now() para que nunca cargue la versión vieja
        const modulePath = `./modules/${fileName}.js?v=${Date.now()}`;
        const mod = await import(modulePath);
        
        container.innerHTML = "";
        
        if (mod.render) {
            await mod.render(container, window.sb, window.db);
            
            // Gestión de botones activos (Protegida)
            document.querySelectorAll('nav button').forEach(btn => {
                btn.style.color = '#94a3b8'; 
            });
            
            const activeBtn = document.getElementById(`btn-${name}`);
            if (activeBtn) {
                activeBtn.style.color = '#4f46e5';
            }
        }
        
    } catch (e) {
        console.error("Error en loadModule:", e);
        container.innerHTML = `
            <div class="p-10 text-center bg-red-50 rounded-3xl m-4 border border-red-100">
                <p class="text-red-500 font-black">❌ ERROR DE CARGA: ${name}</p>
                <p class="text-[10px] text-slate-400 mt-2">Verifica assets/js/modules/${name}.js</p>
            </div>`;
    }
};
// 5. MENÚ EXPANDIDO (HOLDED STYLE)
function renderNav() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    nav.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:10px 20px; border-top:1px solid #f1f5f9; position:fixed; bottom:0; width:100%; max-width:900px; left:50%; transform:translateX(-50%); z-index:1000; border-radius: 20px 20px 0 0; box-shadow: 0 -5px 30px rgba(0,0,0,0.08); overflow-x: auto;">
            
            <button onclick="loadModule('dashboard')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">📊</span><span class="text-[8px] font-black uppercase text-slate-400">Dash</span></button>
            <button onclick="loadModule('diario')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">💵</span><span class="text-[8px] font-black uppercase text-slate-400">Caja</span></button>
            <button onclick="loadModule('albaranes')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">🚚</span><span class="text-[8px] font-black uppercase text-slate-400">Alb</span></button>
            <button onclick="loadModule('facturas')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">📄</span><span class="text-[8px] font-black uppercase text-slate-400">Fra</span></button>
            
            <div class="w-px h-8 bg-slate-100 mx-2"></div> <button onclick="loadModule('fiscalidad')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">⚖️</span><span class="text-[8px] font-black uppercase text-slate-400">Imp</span></button>
            <button onclick="loadModule('banco')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">🏦</span><span class="text-[8px] font-black uppercase text-slate-400">Banco</span></button>
            <button onclick="loadModule('informes')" class="flex flex-col items-center gap-1 min-w-[50px]"><span class="text-xl">📈</span><span class="text-[8px] font-black uppercase text-slate-400">P&L</span></button>

        </div>
    `;
}
// 6. FUNCIÓN GLOBAL PARA GUARDAR
window.save = async function(mensaje = "Datos guardados") {
    window.db.lastSync = Date.now();
    const { error } = await sb
        .from('arume_data')
        .upsert({ id: 1, data: window.db });

    if (error) {
        alert("Error al guardar en la nube: " + error.message);
    } else {
        console.log("☁️ " + mensaje);
    }
};

// 7. LÓGICA DE BARRA DINÁMICA
let lastPos = 0;
window.onscroll = function() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    let currentPos = window.pageYOffset || document.documentElement.scrollTop;
    
    if (currentPos > lastPos && currentPos > 50) {
        nav.style.transform = "translateY(100%)";
    } else {
        nav.style.transform = "translateY(0)";
    }
    lastPos = currentPos;
};
