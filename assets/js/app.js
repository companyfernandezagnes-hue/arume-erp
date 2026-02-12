// assets/js/app.js
import { initPIN } from "./auth/pin.js";

/* =============================================================
   ⚙️ CONFIGURACIÓN DE CONEXIÓN SUPABASE
   ============================================================= */
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";

// Inicializamos el cliente
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// IMPORTANTE: Lo hacemos global para que el HTML (Botón Migrar) lo vea
window.sb = supabase; 

/* =============================================================
   🚀 ARRANQUE DE LA APLICACIÓN
   ============================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // Configura el PIN. Le pasamos 'initApp' para que arranque la app
  // SOLO cuando el usuario meta el PIN correcto.
  initPIN(initApp);
});

/* =============================================================
   🔧 FUNCIÓN PRINCIPAL DE INICIO
   ============================================================= */
async function initApp() {
  console.log("🚀 Iniciando App...");
  
  // mostrar pantalla de carga
  toggleLoading(true);

  // Verificación de conexión
  const { error } = await supabase.from("arume_data").select("id").limit(1);

  if (error && error.code !== 'PGRST116') {
    console.error("Supabase error:", error);
    toast("⚠️ Error de conexión", "error");
  } else {
    console.log("Supabase conectado correctamente ✅");
  }

  // cargar el primer módulo (dashboard)
  toggleLoading(false);
  loadModule("dashboard");
}

/* =============================================================
   🧩 CARGA DE MÓDULOS DINÁMICOS
   ============================================================= */
window.loadModule = async function (name) {
  const main = document.getElementById("app");
  
  // Actualizar Navbar
  updateNavbar(name);
  
  // Mostrar carga
  main.innerHTML = `<div class="flex justify-center mt-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>`;

  try {
    // MAGIC IMPORT: Esto busca el archivo en la carpeta modules
    const mod = await import(`./modules/${name}.js`);
    
    // Limpiamos y renderizamos lo que traiga el módulo
    main.innerHTML = "";
    mod.render(main, supabase);
    
  } catch (e) {
    main.innerHTML = `<p class="text-center text-red-500 mt-10">❌ Error: Falta el archivo modules/${name}.js</p>`;
    console.error(e);
  }
};

/* =============================================================
   ⚙️ FUNCIONES VARIAS
   ============================================================= */
function toggleLoading(show = false) {
  const loader = document.getElementById("loading");
  if(loader) loader.classList.toggle("hidden", !show);
}

window.toast = function(msg, type = "info") {
  alert(msg);
}

function updateNavbar(active) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active", "text-indigo-400");
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(active)) {
        btn.classList.add("active", "text-indigo-400");
    }
  });
}
