/* =============================================================
   🤝 MÓDULO: PROVEEDORES
   ============================================================= */
export async function render(container, supabase) {
  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black">Proveedores</h2>
      <div class="flex gap-2">
        <input id="searchProv" type="text" placeholder="Buscar…"
               class="border border-slate-200 rounded-xl px-3 py-1 text-sm" />
        <button id="btnNuevoProv" class="bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-bold">
          <i class="ph ph-plus"></i> Nuevo
        </button>
      </div>
    </div>
    <div id="listProveedores" class="text-sm"></div>
  </section>
  `;

  const list = container.querySelector("#listProveedores");
  const searchInput = container.querySelector("#searchProv");
  const addBtn = container.querySelector("#btnNuevoProv");

  searchInput.addEventListener("input", loadProveedores);
  addBtn.addEventListener("click", nuevoProveedor);

  await loadProveedores();

  /* =============================================================
     📦 Cargar proveedores desde Supabase
     ============================================================= */
  async function loadProveedores() {
    list.innerHTML = `<p class="text-center text-slate-400 mt-4">Cargando...</p>`;

    const { data, error } = await supabase.from("proveedores").select("*");
    if (error) {
      list.innerHTML = `<p class="text-red-500">Error cargando proveedores.</p>`;
      return;
    }

    const search = searchInput.value.toLowerCase();
    const filtered = !search
      ? data
      : data.filter(p =>
          (p.n && p.n.toLowerCase().includes(search)) ||
          (p.fam && p.fam.toLowerCase().includes(search))
        );

    if (!filtered || filtered.length === 0) {
      list.innerHTML = `<p class="text-center text-slate-400 mt-4">Sin proveedores...</p>`;
      return;
    }

    list.innerHTML = filtered
      .sort((a,b)=>a.n.localeCompare(b.n))
      .map(p => `
        <div class="glass-card flex justify-between items-center mb-2">
          <div>
            <p class="font-bold text-slate-800">${p.n}</p>
            <p class="text-xs text-slate-400">${p.fam || "General"}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-400">${p.tel || ""}</p>
            <p class="text-xs text-slate-400">${p.mail || ""}</p>
          </div>
        </div>
      `).join("");
  }

  /* =============================================================
     ➕ Nuevo proveedor
     ============================================================= */
  async function nuevoProveedor() {
    const n = prompt("Nombre del proveedor:");
    if (!n) return;
    const tel = prompt("Teléfono:") || "";
    const mail = prompt("Email:") || "";
    const fam = prompt("Familia o tipo (Sake, Vinos, Limpieza, etc.):") || "";

    const nuevo = { n, tel, mail, fam };
    const { error } = await supabase.from("proveedores").insert(nuevo);
    if (error) {
      alert("Error al guardar proveedor.");
      console.error(error);
      return;
    }

    alert("Proveedor guardado ✅");
    await loadProveedores();
  }
}
