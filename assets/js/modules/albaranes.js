/* =============================================================
   🚚 MÓDULO: ALBARANES
   ============================================================= */
export async function render(container, supabase) {
  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black">Albaranes · Gastos</h2>
      <div class="flex gap-2">
        <input id="searchAlbaran" type="text" placeholder="Buscar…" 
               class="border border-slate-200 rounded-xl px-3 py-1 text-sm" />
        <select id="filterMonth" class="border border-slate-200 rounded-xl px-2 py-1 text-sm">
          ${[...Array(12)].map((_,i)=>
          `<option value="${i+1}">${i+1}</option>`).join('')}
        </select>
        <button id="btnImport" class="bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-bold">
          <i class="ph ph-file-arrow-down"></i> Importar
        </button>
      </div>
    </div>
    <div id="listAlbaranes" class="text-sm"></div>
  </section>
  <input type="file" id="csvInput" class="hidden" accept=".csv,.xlsx" />
  `;

  const listDiv = container.querySelector("#listAlbaranes");
  const searchInput = container.querySelector("#searchAlbaran");
  const monthSelect = container.querySelector("#filterMonth");
  const importButton = container.querySelector("#btnImport");
  const csvInput = container.querySelector("#csvInput");

  importButton.addEventListener("click", ()=>csvInput.click());
  csvInput.addEventListener("change", handleImport);

  searchInput.addEventListener("input", loadAlbaranes);
  monthSelect.addEventListener("change", loadAlbaranes);

  await loadAlbaranes();

  /* =============================================================
     📦 Cargar y filtrar albaranes desde Supabase
     ============================================================= */
  async function loadAlbaranes() {
    listDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Cargando...</p>`;
    const search = searchInput.value.toLowerCase();
    const month = parseInt(monthSelect.value);

    const { data, error } = await supabase.from("albaranes").select("*");
    if (error) {
      listDiv.innerHTML = `<p class="text-red-500">Error al cargar datos.</p>`;
      return;
    }

    const filtered = data.filter((a) => {
      const fecha = new Date(a.fecha || a.created_at || new Date());
      return (
        (!month || fecha.getMonth() + 1 === month) &&
        (!search || (a.proveedor && a.proveedor.toLowerCase().includes(search)))
      );
    });

    if (filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Sin albaranes...</p>`;
      return;
    }

    listDiv.innerHTML = filtered
      .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
      .map((alb)=>`
        <div class="glass-card flex justify-between items-center mb-2">
          <div>
            <p class="font-bold text-slate-800">${alb.proveedor || "—"}</p>
            <p class="text-xs text-slate-400">${alb.fecha || ""}</p>
          </div>
          <div class="text-right">
            <p class="font-black text-slate-800">${(alb.total || 0).toFixed(2)} €</p>
            <p class="text-xs text-slate-400">${alb.numero || ""}</p>
          </div>
        </div>
      `).join("");
  }

  /* =============================================================
     📥 Importar automáticamente desde Excel / CSV
     ============================================================= */
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const headers = rows.shift().split(",");

    const albaranes = rows.map((r) => {
      const cols = r.split(",");
      const record = {};
      headers.forEach((h, i) => record[h.trim()] = cols[i]);
      return {
        proveedor: record["proveedor"] || record["Proveedor"] || "—",
        fecha: record["fecha"] || record["Fecha"] || "",
        numero: record["numero"] || record["Nº"] || "",
        total: parseFloat(record["total"] || record["Importe"] || 0),
      };
    });

    for (const a of albaranes) {
      await supabase.from("albaranes").insert(a);
    }

    alert(`Se importaron ${albaranes.length} albaranes.`);
    await loadAlbaranes();
    csvInput.value = "";
  }
}
