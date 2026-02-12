// assets/js/app.js

// 1. IMPORTACIONES (Módulos)
import { initPIN } from "./auth/pin.js";

// 2. CONFIGURACIÓN SUPABASE
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST"; // ⚠️ Revisa que esta clave sea correcta

// Inicializar y hacer GLOBAL para el HTML (Migración)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb; 

// Estado de la aplicación
const appState = {
    currentModule: 'dashboard'
};

/* =============================================================
   🚀 ARRANQUE (ORDEN LÓGICO)
   ============================================================= */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🔒 Iniciando sistema de seguridad...");
    
    // Llamamos al PIN y le pasamos la función 'startApp' 
    // para que se ejecute SOLO cuando el PIN sea correcto.
    initPIN(startApp); 
});

/* =============================================================
   ✅ SE EJECUTA AL DESBLOQUEAR EL PIN
   ============================================================= */
function startApp() {
    console.log("🚀 Acceso concedido. Iniciando App...");
    
    // Cargar el módulo inicial
    loadModule('dashboard');
}

/* =============================================================
   🧩 SISTEMA DE MÓDULOS
   ============================================================= */
// Lo hacemos global para que el menú del HTML funcione
window.loadModule = function(moduleName) {
    const appContainer = document.getElementById('app');
    
    // Actualizar Navbar visualmente
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active", "text-indigo-400");
        if (btn.getAttribute('onclick').includes(moduleName)) {
            btn.classList.add("active", "text-indigo-400");
        }
    });

    appState.currentModule = moduleName;
    let content = '';

    // CONTENIDO DE LOS MÓDULOS
    switch(moduleName) {
        case 'dashboard':
            content = `
                <div class="animate-fade-in">
                    <h2 class="text-2xl font-bold mb-6">Dashboard</h2>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p class="text-slate-400 text-[10px] font-bold uppercase">Ventas</p>
                            <p class="text-3xl font-black text-indigo-600 mt-1">0€</p>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p class="text-slate-400 text-[10px] font-bold uppercase">Pedidos</p>
                            <p class="text-3xl font-black text-purple-600 mt-1">0</p>
                        </div>
                    </div>
                </div>`;
            break;
        case 'facturas':
            content = `<div class="p-10 text-center bg-white rounded-2xl shadow">📃<br>Módulo de <b>Facturas</b></div>`;
            break;
        case 'albaranes':
            content = `<div class="p-10 text-center bg-white rounded-2xl shadow">🚚<br>Módulo de <b>Albaranes</b></div>`;
            break;
        case 'productos':
            content = `<div class="p-10 text-center bg-white rounded-2xl shadow">📦<br>Módulo de <b>Stock</b></div>`;
            break;
        case 'caja':
            content = `<div class="p-10 text-center bg-white rounded-2xl shadow">💶<br>Módulo de <b>Caja</b></div>`;
            break;
        default:
            content = `<p>Módulo no encontrado</p>`;
    }
    appContainer.innerHTML = content;
};

// Funciones globales de utilidad
window.loading = (show) => document.getElementById('loading').classList.toggle('hidden', !show);
window.toast = (msg) => alert(msg);
