/* =============================================================
   📄 MÓDULO: FACTURAS (Versión Recuperación Total)
   ============================================================= */
export async function render(container, supabase, db) {
  // 1. Usamos los datos descargados (db) o la memoria global (window.DB)
  const dataStore = db || window.DB || { facturas: [] };
  const facturasOriginales = dataStore.facturas || [];

  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6 animate-fade-in">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black text-slate-800">Facturas · Ingresos</h2>
      <div class="flex gap-2">
        <input id="searchFactura" type="text" placeholder="Buscar..."
               class="border border-slate-200 rounded-xl px-3 py-1 text-sm outline-none focus:ring-2 ring-indigo-500" />
        <select id="filterYear" class="border border-slate-200 rounded-xl px-2 py-1 text-sm">
          ${(() => {
            const year = new Date().getFullYear();
            return [year, year-1, year-2].map(y => `<option value="${y}">${y}</option>`).join("");
          })()}
        </select>
        <button id="btnAddFactura" class="bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-bold shadow-md active:scale-95 transition">
          + Nueva
        </button>
      </div>
    </div>
    <div id="listFacturas" class="text-sm space-y-2"></div>
  </section>
  <div id="facturaModal" class="hidden"></div>
  `;

  const listDiv = container.querySelector("#listFacturas");
  const searchInput = container.querySelector("#searchFactura");
  const yearSelect = container.querySelector("#filterYear");

  // Escuchadores para filtrar en tiempo real
  searchInput.addEventListener("input", updateList);
  yearSelect.addEventListener("change", updateList);

  // Pintar la lista por primera vez
  updateList();

  function updateList() {
    const search = searchInput.value.toLowerCase();
    const year = parseInt(yearSelect.value);

    // FILTRADO INTELIGENTE sobre los datos que YA tenemos
    const filtered = facturasOriginales.filter((f) => {
      const fechaVal = f.date || f.fecha || f.created_at || "";
      const anio = new Date(fechaVal).getFullYear();
      const coincideNombre = (f.prov || f.cliente || "").toLowerCase().includes(search);
      const coincideNum = (f.num || f.numero || "").toLowerCase().includes(search);
      
      return anio === year && (coincideNombre || coincideNum);
    });

    if (filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 py-10">Sin facturas encontradas en ${year}...</p>`;
      return;
    }

    listDiv.innerHTML = filtered
      .sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha))
      .map((f) => `
        <div class="glass-card mb-2 cursor-pointer hover:bg-indigo-50 transition border border-slate-100 p-4 rounded-2xl" data-id="${f.id}">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-bold text-slate-800">${f.prov || f.cliente || "—"}</p>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${f.date || f.fecha || ""}</p>
            </div>
            <div class="text-right">
              <p class="font-black text-indigo-600 text-base">${(parseFloat(f.total) || 0).toFixed(2)} €</p>
              <p class="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-500">${f.num || f.numero || "S/N"}</p>
            </div>
          </div>
        </div>
      `).join("");

    // Click para ver detalles
    container.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", () => verFactura(el.dataset.id));
    });
  }

  function verFactura(id) {
    const factura = facturasOriginales.find(x => x.id === id);
    if (!factura) return;

    const modal = container.querySelector("#facturaModal");
    modal.classList.remove("hidden");
    
    // Buscamos si tiene albaranes dentro del objeto (en el nuevo sistema están ahí)
    const albaranes = factura.items || [];

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100]">
        <div class="bg-white w-11/12 max-w-lg rounded-[2rem] shadow-2xl p-8 relative animate-slide-up">
          <button id="closeFactura" class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition">✕</button>
          
          <h3 class="text-xl font-black text-slate-800 mb-1">${factura.prov || factura.cliente || "Factura"}</h3>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">${factura.date || factura.fecha}</p>
          
          <div class="border-t border-b border-slate-100 py-4 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
            <p class="text-[10px] font-black text-slate-400 uppercase mb-3">Detalle de líneas:</p>
            ${albaranes.length ? albaranes.map(a => `
              <div class="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div class="text-sm text-slate-600 font-medium">${a.n || a.nombre || "Item"}</div>
                <div class="text-sm font-bold text-slate-800">${(parseFloat(a.q * a.p) || 0).toFixed(2)} €</div>
              </div>
            `).join("") : "<p class='text-center text-slate-400 text-xs italic py-4'>Sin detalles desglosados.</p>"}
          </div>

          <div class="flex justify-between items-center">
             <span class="text-xs font-bold text-slate-400 uppercase">Total Factura</span>
             <p class="text-3xl font-black text-slate-900">${(parseFloat(factura.total) || 0).toFixed(2)} €</p>
          </div>
        </div>
      </div>
    `;
    modal.querySelector("#closeFactura").addEventListener("click", () => modal.classList.add("hidden"));
  }
}
