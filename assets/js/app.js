/* =============================================================
   ⚙️ CONFIGURACIÓN DE CONEXIÓN SUPABASE
   ============================================================= */
const SUPABASE_URL = "https://awbgboucnbsuzojocbuy.supabase.co";
const SUPABASE_KEY = "sb_publishable_drOQ5PsFA8eox_aRTXNATQ_5kibM6ST";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =============================================================
   🚀 ARRANQUE DE LA APLICACIÓN
   ============================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

/* =============================================================
   🔧 FUNCIÓN PRINCIPAL DE INICIO
   ============================================================= */
async function initApp() {
  // mostrar pantalla de carga
  toggleLoading(true);

  // intenta obtener datos de Supabase
  const { data, error } = await supabase.from("facturas").select("*").limit(1);

  if (error) {
    console.error("Supabase error:", error);
    toast("⚠️ No se pudo conectar con la base de datos", "error");
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
  main.innerHTML = `<div class="text-center text-slate-400 mt-10 animate-pulse">Cargando ${name}...</div>`;

  try {
    const mod = await import(`./modules/${name}.js`);
    main.innerHTML = "";
    mod.render(main, supabase);
    updateNavbar(name);
  } catch (e) {
    main.innerHTML = `<p class="text-center text-red-500 mt-10">Error al cargar ${name}</p>`;
    console.error(e);
  }
};

/* =============================================================
   ⚙️ FUNCIONES VARIAS DE APP
   ============================================================= */
function toggleLoading(show = false) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

function toast(msg, type = "info") {
  alert(msg); // sencillo de momento
}

function updateNavbar(active) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.innerHTML.toLowerCase().includes(active)) btn.classList.add("active");
  });
}

/* =============================================================
   📦 PLACEHOLDERS DE MÓDULOS BÁSICOS
   ============================================================= */
export function placeholder(container, title) {
  container.innerHTML = `
    <section class="p-6 bg-white rounded-3xl shadow text-center">
      <h2 class="font-black mb-3">${title}</h2>
      <p class="text-sm text-slate-500">Módulo en desarrollo.</p>
    </section>`;
}
