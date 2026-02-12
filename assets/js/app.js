// assets/js/app.js

// 1. CONFIGURACIÓN SUPABASE
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.sb = sb;
window.db = {}; 

// 2. ARRANQUE
document.addEventListener("DOMContentLoaded", async () => {
    renderNav(); // Dibujamos el menú
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
        if (local) {
            window.db = JSON.parse(decodeURIComponent(atob(local)));
        }
    } else {
        window.db = data.data;
        console.log("✅ Datos cargados correctamente.");
    }
    loadModule('dashboard');
}

// 4. EL NAVEGADOR DE MÓDULOS
window.loadModule = async function(name) {
    const container = document.getElementById('app');
    if (!container) return;

    // Marcamos el botón activo en el menú
    document.querySelectorAll('nav button').forEach(btn => {
        btn.style.color = '#94a3b8'; // Color gris apagado
    });
    const activeBtn = document.getElementById(`btn-${name}`);
    if (activeBtn) activeBtn.style.color = '#4f46e5'; // Azul activo

    container.innerHTML = `<p style="text-align:center; padding:20px;">Cargando ${name}...</p>`;

    try {
        const modulePath = `./modules/${name}.js`;
        const mod = await import(modulePath);
        
        container.innerHTML = "";
        
        if (mod.render) {
            await mod.render(container, window.sb, window.db);
        } else {
            throw new Error(`El módulo ${name} no tiene una función render.`);
        }
        
    } catch (e) {
        console.error("Error al cargar el módulo:", e);
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#ef4444;">
                <p style="font-weight:bold;">Error de carga: ${name}</p>
                <p style="font-size:12px; color:#94a3b8;">Asegúrate de que el archivo existe en assets/js/modules/${name}.js</p>
            </div>`;
    }
};

// 5. FUNCIÓN PARA PINTAR EL MENÚ DE NAVEGACIÓN
function renderNav() {
    const nav = document.getElementById('navbar'); // Asegúrate de tener <nav id="navbar"></nav> en tu index.html
    if (!nav) return;

    nav.innerHTML = `
        <div style="display:flex; justify-content:space-around; align-items:center; background:white; padding:15px; border-top:1px solid #f1f5f9; position:fixed; bottom:0; width:100%; max-width:500px; left:50%; transform:translateX(-50%); z-index:1000;">
            <button id="btn-dashboard" onclick="loadModule('dashboard')" style="background:none; border:none; font-size:10px; font-weight:bold; display:flex; flex-direction:column; align-items:center; gap:4px; color:#4f46e5; cursor:pointer;">
                <span style="font-size:20px;">📊</span> Dash
            </button>
            <button id="btn-diario" onclick="loadModule('diario')" style="background:none; border:none; font-size:10px; font-weight:bold; display:flex; flex-direction:column; align-items:center; gap:4px; color:#94a3b8; cursor:pointer;">
                <span style="font-size:20px;">💵</span> Caja
            </button>
            <button id="btn-facturas" onclick="loadModule('facturas')" style="background:none; border:none; font-size:10px; font-weight:bold; display:flex; flex-direction:column; align-items:center; gap:4px; color:#94a3b8; cursor:pointer;">
                <span style="font-size:20px;">📄</span> Fra
            </button>
            <button id="btn-albaranes" onclick="loadModule('albaranes')" style="background:none; border:none; font-size:10px; font-weight:bold; display:flex; flex-direction:column; align-items:center; gap:4px; color:#94a3b8; cursor:pointer;">
                <span style="font-size:20px;">🚚</span> Alb
            </button>
            <button id="btn-gastos_fijos" onclick="loadModule('gastos_fijos')" style="background:none; border:none; font-size:10px; font-weight:bold; display:flex; flex-direction:column; align-items:center; gap:4px; color:#94a3b8; cursor:pointer;">
                <span style="font-size:20px;">🏢</span> Fijos
            </button>
        </div>
    `;
}

// 6. FUNCIÓN GLOBAL PARA GUARDAR (Para que todos los módulos la usen)
window.save = async function(mensaje = "Datos guardados") {
    const { error } = await sb
        .from('arume_data')
        .upsert({ id: 1, data: window.db });

    if (error) {
        alert("Error al guardar en la nube: " + error.message);
    } else {
        console.log("☁️ " + mensaje);
        // Opcional: mostrar un aviso pequeño tipo toast
    }
};
