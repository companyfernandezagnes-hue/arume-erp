import { initPIN } from "./auth/pin.js";

// --- CONFIGURACIÓN ---
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = supabase; 
window.DB = {}; // Aquí guardaremos tus datos

// --- ARRANQUE ---
document.addEventListener("DOMContentLoaded", () => {
    initPIN(initApp);
});

async function initApp() {
    console.log("🚀 Descargando datos...");
    toggleLoading(true);
    
    // 1. DESCARGAMOS TUS DATOS (ID 1)
    let { data: rows, error } = await supabase
        .from("arume_data")
        .select("data")
        .eq('id', 1) // Buscamos el ID 1 que salió en tu consola
        .single();

    if (error) {
        console.error("Error descarga:", error);
        // Si falla la nube, intentamos leer del LocalStorage (Plan B)
        const local = localStorage.getItem('arume_v152');
        if(local) {
            window.DB = JSON.parse(decodeURIComponent(atob(local)));
            toast("⚠️ Modo Offline: Datos cargados del navegador");
        }
    } else if (rows) {
        // 2. GUARDAMOS LOS DATOS EN MEMORIA
        window.DB = rows.data; 
        console.log("✅ Datos cargados:", window.DB);
    }
    
    toggleLoading(false);
    loadModule("dashboard");
}

// --- GESTOR DE MÓDULOS ---
window.loadModule = async function (name) {
    const main = document.getElementById("app");
    updateNavbar(name);
    
    try {
        const module = await import(`./modules/${name}.js`);
        main.innerHTML = "";
        // Pasamos tus datos (window.DB) al módulo para que los pinte
        module.render(main, supabase, window.DB); 
    } catch (e) {
        console.error(e);
        main.innerHTML = `<p class="text-center text-red-500 mt-10">Error cargando ${name}</p>`;
    }
};

// --- UTILIDADES ---
function toggleLoading(show) {
    const l = document.getElementById("loading");
    if(l) l.classList.toggle("hidden", !show);
}
function updateNavbar(active) {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active", "text-indigo-400");
        if(btn.getAttribute('onclick')?.includes(active)) btn.classList.add("active", "text-indigo-400");
    });
}
window.toast = (msg) => alert(msg);
