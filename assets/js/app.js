// assets/js/app.js

// 1. CONFIGURACIÓN SUPABASE
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.sb = sb;
window.db = {}; 

// 2. ARRANQUE
document.addEventListener("DOMContentLoaded", async () => {
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

// 4. EL NAVEGADOR DE MÓDULOS (La versión nueva que pusiste)
window.loadModule = async function(name) {
    const container = document.getElementById('app');
    if (!container) return;

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
