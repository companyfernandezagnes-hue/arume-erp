/* =============================================================
   💰 MÓDULO: CAJA / CIERRES DIARIOS (Versión Diamond)
   ============================================================= */
export async function render(container, supabase, db) {
  // 1. Extraemos los cierres de la base de datos descargada (carpeta 'diario')
  const cierresOriginales = db.diario || [];

  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow-sm mb-6 animate-fade-in border border-slate-100">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black text-slate-800">Caja / Diario</h2>
      <button id="btnNuevoCierre" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition">
        + Nuevo Cierre
      </button>
    </div>
    <div id="listaCierres" class="text-sm space-y-2"></div>
  </section>
  <div id="detalleCierreModal"></div>
  `;

  const cierresDiv = container.querySelector("#listaCierres");
  const nuevoBtn = container.querySelector("#btnNuevoCierre");

  nuevoBtn.addEventListener("click", () => alert("Función para nuevos cierres en desarrollo. ¡Usa los históricos!"));
  
  // Pintar la lista inicialmente
  renderCierresList();

  function renderCierresList() {
    if (cierresOriginales.length === 0) {
      cierresDiv.innerHTML = `<p class="text-center text-slate-400 py-10 italic">Sin cierres registrados en la nube...</p>`;
      return;
    }

    cierresDiv.innerHTML = cierresOriginales
      .sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha))
      .map(c => `
        <div class="glass-card flex justify-between items-center p-4 rounded-2xl border border-slate-50 cursor-pointer hover:bg-indigo-50 transition" data-id="${c.id}">
          <div>
            <p class="font-bold text-slate-800">${formatDate(c.date || c.fecha)}</p>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${c.turno || "Turno general"}</p>
          </div>
          <div class="text-right">
            <p class="font-black text-indigo-600 text-base">${(parseFloat(c.total) || 0).toFixed(2)} €</p>
            <p class="text-[10px] text-slate-400 font-bold">${c.usuario || "Staff"}</p>
          </div>
        </div>
      `).join("");

    // Eventos para ver detalle
    container.querySelectorAll("[data-id]").forEach(el =>
      el.addEventListener("click", () => verCierre(el.dataset.id))
    );
  }

  function verCierre(id) {
    const data = cierresOriginales.find(x => x.id === id);
    if (!data) return;

    const modal = container.querySelector("#detalleCierreModal");
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100]">
        <div class="bg-white w-11/12 max-w-md rounded-[2rem] shadow-2xl p-8 relative animate-slide-up">
          <button id="closeDetalle" class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition">✕</button>
          
          <h3 class="text-xl font-black text-slate-800 mb-1">Cierre de Caja</h3>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">${formatDate(data.date || data.fecha)}</p>

          <div class="bg-slate-50 rounded-2xl p-4 mb-6">
            <div class="flex justify-between mb-2">
                <span class="text-xs text-slate-500 font-bold uppercase">Efectivo</span>
                <span class="font-bold text-slate-700">${(data.cash || 0).toFixed(2)}€</span>
            </div>
            <div class="flex justify-between mb-2 border-b border-slate-100 pb-2">
                <span class="text-xs text-slate-500 font-bold uppercase">Tarjeta (Visa)</span>
                <span class="font-bold text-slate-700">${(data.visa || 0).toFixed(2)}€</span>
            </div>
            <div class="flex justify-between pt-2">
                <span class="text-xs text-indigo-600 font-black uppercase">Total Neto</span>
                <span class="font-black text-indigo-600 text-lg">${(data.total || 0).toFixed(2)}€</span>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 italic">
            Registrado por: ${data.usuario || 'Sistema'}
          </div>
        </div>
      </div>
    `;
    modal.querySelector("#closeDetalle").addEventListener("click", () => modal.innerHTML = "");
  }

  function formatDate(str) {
    try {
      const d = new Date(str);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch { return str; }
  }
}
