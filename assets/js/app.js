// assets/js/app.js

// 1. CONFIGURACIÓN SUPABASE (Tus claves reales)
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Hacerlas globales para que el HTML y los módulos las vean
window.sb = sb;
window.db = {}; 

// 2. ARRANQUE DE LA APP
document.addEventListener("DOMContentLoaded", async () => {
    // Si quieres el PIN que tenías en el HTML, lo llamamos aquí
    // Por ahora, vamos directo a cargar los datos para que no te agobies
    await cargarDatosDeLaNube();
});

// 3. FUNCIÓN PARA RECUPERAR TUS DATOS REALES
async function cargarDatosDeLaNube() {
    console.log("📡 Conectando con Supabase...");
    
    // Buscamos en la tabla arume_data donde vimos que tienes 643KB de datos
    const { data, error } = await sb
        .from('arume_data')
        .select('data')
        .eq('id', 1)
        .single();

    if (error) {
        console.error("Error al bajar datos:", error);
        // Intentamos cargar de la memoria del navegador por si acaso
        const local = localStorage.getItem('arume_v152');
        if (local) {
            window.db = JSON.parse(decodeURIComponent(atob(local)));
        }
    } else {
        window.db = data.data;
        console.log("✅ Datos cargados correctamente en memoria.");
    }

    // Una vez tenemos los datos, cargamos el Dashboard
    loadModule('dashboard');
}

// 4. EL NAVEGADOR DE MÓDULOS (Como lo tenías antes)
window.loadModule = async function(name) {
    const container = document.getElementById('app');
    if (!container) return;

    container.innerHTML = `<p style="text-align:center; padding:20px;">Cargando ${name}...</p>`;

    try {
        // Esto busca los archivos en la carpeta assets/js/modules/
        const mod = await import(`./modules/${name}.js`);
        container.innerHTML = "";
        // Le pasamos 'sb' y 'db' para que el módulo tenga la conexión y los datos
        mod.render(container, window.sb, window.db);
    } catch (e) {
        console.error("Error al cargar el módulo:", e);
        container.innerHTML = `<p style="color:red;">Error: No se encuentra el archivo assets/js/modules/${name}.js</p>`;
    }
};
