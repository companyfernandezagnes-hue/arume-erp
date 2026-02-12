/* =============================================================
   📄 MÓDULO: FACTURAS
   ============================================================= */
export async function render(container, supabase) {
  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black">Facturas · Ingresos</h2>
      <div class="flex gap-2">
        <input id="searchFactura" type="text" placeholder="Buscar cliente..."
               class="border border-slate-200 rounded-xl px-3 py-1 text-sm" />
        <select id="filterYear" class="border border-slate-200 rounded-xl px-2 py-1 text-sm">
          ${(() => {
            const year = new Date().getFullYear();
            return [year, year-1, year-2].map(y => `<option value="${y}">${y}</option>`).join("");
          })()}
        </select>
        <button id="btnAddFactura" class="bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-bold">
          <i class="ph ph-plus"></i> Nueva
        </button>
      </div>
    </div>
    <div id="listFacturas" class="text-sm"></div>
  </section>
  <div id="facturaModal" class="hidden"></div>
  `;

  const listDiv = container.querySelector("#listFacturas");
  const searchInput = container.querySelector("#searchFactura");
  const yearSelect = container.querySelector("#filterYear");
  const newBtn = container.querySelector("#btnAddFactura");

  searchInput.addEventListener("input", loadFacturas);
  yearSelect.addEventListener("change", loadFacturas);
  newBtn.addEventListener("click", nuevaFactura);

  await loadFacturas();

  /* =============================================================
     📦 Cargar facturas desde Supabase
     ============================================================= */
  async function loadFacturas() {
    listDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Cargando...</p>`;
    const search = searchInput.value.toLowerCase();
    const year = parseInt(yearSelect.value);

    const { data, error } = await supabase.from("facturas").select("*");
    if (error) {
      listDiv.innerHTML = `<p class="text-red-500">Error al cargar facturas.</p>`;
      return;
    }

    const filtered = data.filter((f) => {
      const fecha = new Date(f.fecha || f.created_at || new Date());
      return (
        fecha.getFullYear() === year &&
        (!search || (f.cliente && f.cliente.toLowerCase().includes(search)))
      );
    });

    if (filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Sin facturas...</p>`;
      return;
    }

    listDiv.innerHTML = filtered
      .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
      .map((f)=>`
        <div class="glass-card mb-2 cursor-pointer hover:bg-indigo-50 transition" data-id="${f.id}">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-bold text-slate-800">${f.cliente || "—"}</p>
              <p class="text-xs text-slate-400">${f.fecha || ""}</p>
            </div>
            <div class="text-right">
              <p class="font-black text-slate-800">${(f.total || 0).toFixed(2)} €</p>
              <p class="text-xs text-slate-400">${f.numero || ""}</p>
            </div>
          </div>
        </div>
      `).join("");

    document.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", () => verFactura(el.dataset.id));
    });
  }

  /* =============================================================
     🧾 Ver factura con albaranes vinculados
     ============================================================= */
  async function verFactura(id) {
    const { data: factura } = await supabase.from("facturas").select("*").eq("id", id).single();
    const { data: albaranes } = await supabase.from("albaranes").select("*").eq("factura_id", id);

    const modal = container.querySelector("#facturaModal");
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
        <div class="bg-white w-11/12 max-w-lg rounded-3xl shadow-xl p-6 relative">
          <button id="closeFactura" class="absolute top-3 right-3 text-slate-400 hover:text-red-500">
            <i class="ph ph-x text-lg"></i></button>
          <h3 class="text-lg font-black mb-2">${factura.cliente || "Factura"}</h3>
          <p class="text-xs text-slate-400 mb-3">${factura.fecha}</p>
          
          <div class="border-t border-b border-slate-200 py-2 mb-3 text-sm">
            ${albaranes && albaranes.length ? albaranes.map(a => `
              <div class="flex justify-between border-b border-slate-100 py-1">
                <span>${a.proveedor}</span>
                <span>${(a.total || 0).toFixed(2)} €</span>
              </div>
            `).join("") : "<p class='text-center text-slate-400'>Sin albaranes asociados.</p>"}
          </div>

          <p class="text-right font-black text-slate-800 text-lg">${(factura.total || 0).toFixed(2)} €</p>
        </div>
      </div>
    `;
    modal.querySelector("#closeFactura").addEventListener("click", ()=> modal.classList.add("hidden"));
  }

  /* =============================================================
     ➕ Crear nueva factura (simplificada)
     ============================================================= */
  async function nuevaFactura() {
    const cliente = prompt("Nombre del cliente:");
    if (!cliente) return;
    const total = parseFloat(prompt("Importe total:") || 0);
    const fecha = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("facturas")
      .insert({ cliente, total, fecha });

    if (error) return alert("Error al crear factura.");

    alert("Factura registrada ✅");
    await loadFacturas();
  }
}
