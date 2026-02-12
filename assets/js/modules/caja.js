/* =============================================================
   💰 MÓDULO: CAJA / CIERRES DIARIOS
   ============================================================= */
export async function render(container, supabase) {
  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black">Caja / Diario</h2>
      <button id="btnNuevoCierre" class="bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-bold">
        <i class="ph ph-plus"></i> Nuevo Cierre
      </button>
    </div>
    <div id="listaCierres" class="text-sm"></div>
  </section>
  `;

  const cierresDiv = container.querySelector("#listaCierres");
  const nuevoBtn = container.querySelector("#btnNuevoCierre");

  nuevoBtn.addEventListener("click", nuevoCierre);
  await cargarCierres();

  /* =============================================================
     📦 Cargar cierres desde Supabase
     ============================================================= */
  async function cargarCierres() {
    cierresDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Cargando...</p>`;

    const { data, error } = await supabase.from("diario").select("*").order("fecha", { ascending: false });
    if (error) {
      cierresDiv.innerHTML = `<p class="text-red-500">Error al cargar cierres.</p>`;
      return;
    }

    if (!data || data.length === 0) {
      cierresDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Sin cierres registrados...</p>`;
      return;
    }

    cierresDiv.innerHTML = data.map(c => `
      <div class="glass-card flex justify-between items-center mb-2 cursor-pointer hover:bg-slate-50 transition" data-id="${c.id}">
        <div>
          <p class="font-bold text-slate-800">${formatDate(c.fecha)}</p>
          <p class="text-xs text-slate-400">${c.turno || "Turno general"}</p>
        </div>
        <div class="text-right">
          <p class="font-black text-slate-800">${(c.total || 0).toFixed(2)} €</p>
          <p class="text-xs text-slate-400">${c.usuario || ""}</p>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("[data-id]").forEach(el =>
      el.addEventListener("click", () => verCierre(el.dataset.id))
    );
  }

  /* =============================================================
     🧾 Ver cierre individual
     ============================================================= */
  async function verCierre(id) {
    const { data, error } = await supabase.from("diario").select("*").eq("id", id).single();
    if (error || !data) return alert("No se pudo abrir este cierre.");

    const detalle = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
        <div class="bg-white w-11/12 max-w-md rounded-3xl shadow-xl p-6 relative">
          <button id="closeDetalle" class="absolute top-3 right-3 text-slate-400 hover:text-red-500">
            <i class="ph ph-x text-lg"></i></button>
          <h3 class="text-lg font-black mb-2">Cierre ${formatDate(data.fecha)}</h3>
          <p class="text-sm text-slate-600 mb-3">Turno: <span class="font-bold">${data.turno || "—"}</span></p>

          <div class="border-t border-b py-2 mb-3 text-sm">
            ${data.detalle || "<p class='text-slate-400'>Sin detalle registrado.</p>"}
          </div>

          <p class="text-right font-black text-slate-800 text-lg">${(data.total || 0).toFixed(2)} €</p>
        </div>
      </div>
    `;
    const modal = document.createElement("div");
    modal.innerHTML = detalle;
    document.body.appendChild(modal);
    modal.querySelector("#closeDetalle").addEventListener("click", ()=> modal.remove());
  }

  /* =============================================================
     ➕ Registrar nuevo cierre
     ============================================================= */
  async function nuevoCierre() {
    const total = parseFloat(prompt("Importe total en caja (€):") || 0);
    const detalle = prompt("Detalle del cierre (opcional):") || "";
    const usuario = prompt("Usuario que cerró el turno:") || "Anon";

    if (!total) return alert("No se registró ningún importe.");

    const cierre = {
      fecha: new Date().toISOString().split("T")[0],
      total,
      detalle,
      usuario,
      turno: "Cierre automático",
    };

    const { error } = await supabase.from("diario").insert(cierre);
    if (error) {
      alert("Error al guardar cierre.");
      console.error(error);
    } else {
      alert("Cierre guardado correctamente ✅");
      await cargarCierres();
    }
  }

  function formatDate(str) {
    try {
      const d = new Date(str);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch {
      return str;
    }
  }
}
