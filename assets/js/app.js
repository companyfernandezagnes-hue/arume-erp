// assets/js/app.js

// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";

// Inicializar cliente
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// HACER GLOBAL 'sb' para que el botón de Migrar del HTML funcione
window.sb = sb; 


// ==========================================
// 2. ARRANQUE DIRECTO (SIN PIN)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App iniciada sin bloqueo.");
    // Cargamos directamente el dashboard
    loadModule('dashboard');
});


// ==========================================
// 3. ESTADO Y UTILIDADES
// ==========================================
const appState = {
    currentModule: 'dashboard',
    user: null
};

// Funciones globales
window.loading = (show) => {
    const loader = document.getElementById('loading');
    if(loader) loader.classList.toggle('hidden', !show);
};

window.toast = (msg) => alert(msg);


// ==========================================
// 4. SISTEMA DE NAVEGACIÓN (Módulos)
// ==========================================
window.loadModule = function(moduleName) {
    const appContainer = document.getElementById('app');
    
    // Actualizar botones del menú
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active", "text-indigo-400");
        // Si el botón tiene el onclick coincidente, lo activamos
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(moduleName)) {
            btn.classList.add("active", "text-indigo-400");
        }
    });
    
    appState.currentModule = moduleName;

    // Renderizar contenido
    let content = '';
    switch(moduleName) {
        case 'dashboard':
            content = `
                <div class="animate-fade-in">
                    <h2 class="text-2xl font-bold mb-6">Dashboard</h2>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Ventas</p>
                            <p class="text-3xl font-black text-indigo-600 mt-2">0.00€</p>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pedidos</p>
                            <p class="text-3xl font-black text-purple-600 mt-2">0</p>
                        </div>
                    </div>
                </div>
            `;
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
            content = `<p class="text-center mt-10 text-slate-400">Módulo no encontrado</p>`;
    }

    appContainer.innerHTML = content;
};
