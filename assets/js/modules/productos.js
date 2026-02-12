/* =============================================================
   🍶 MÓDULO: PRODUCTOS / INVENTARIO TIENDA
   ============================================================= */
export async function render(container, supabase) {
  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-black">Productos · Inventario</h2>
      <div class="flex gap-2">
        <input id="searchProd" type="text" placeholder="Buscar..."
               class="border border-slate-200 rounded-xl px-3 py-1 text-sm" />
        <button id="btnNuevo" class="bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-bold">
          <i class="ph ph-plus"></i> Nuevo
        </button>
        <button id="btnImportCSV" class="bg-slate-900 text-white px-3 py-1 rounded-xl text-sm font-bold">
          <i class="ph ph-file-csv"></i> Importar
        </button>
      </div>
    </div>
    <div id="listProductos" class="text-sm"></div>
  </section>
  <input type="file" id="csvProdInput" class="hidden" accept=".csv,.xlsx" />
  `;

  const listDiv = container.querySelector("#listProductos");
  const searchInput = container.querySelector("#searchProd");
  const nuevoBtn = container.querySelector("#btnNuevo");
  const importBtn = container.querySelector("#btnImportCSV");
  const fileInput = container.querySelector("#csvProdInput");

  searchInput.addEventListener("input", cargarProductos);
  nuevoBtn.addEventListener("click", nuevoProducto);
  importBtn.addEventListener("click", ()=>fileInput.click());
  fileInput.addEventListener("change", importCSV);

  await cargarProductos();

  /* =============================================================
     📦 Cargar productos desde Supabase
     ============================================================= */
  async function cargarProductos() {
    listDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Cargando...</p>`;

    const { data, error } = await supabase.from("productos").select("*");
    if (error) {
      listDiv.innerHTML = `<p class="text-red-500">Error al cargar productos.</p>`;
      return;
    }

    const search = searchInput.value.toLowerCase();
    const filtered = !search
      ? data
      : data.filter(p => (p.nombre || "").toLowerCase().includes(search));

    if (!filtered || filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 mt-4">Sin productos...</p>`;
      return;
    }

    listDiv.innerHTML = filtered.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p => `
      <div class="glass-card flex justify-between items-center mb-2">
        <div>
          <p class="font-bold text-slate-800">${p.nombre}</p>
          <p class="text-xs text-slate-400">${p.familia || "General"} · Stock: ${p.stock || 0}</p>
        </div>
        <div class="text-right">
          <p class="font-black text-slate-800">${(p.precio || 0).toFixed(2)} €</p>
        </div>
      </div>
    `).join("");
  }

  /* =============================================================
     ➕ Añadir nuevo producto
     ============================================================= */
  async function nuevoProducto() {
    const nombre = prompt("Nombre del producto:");
    if (!nombre) return;
    const precio = parseFloat(prompt("Precio (€):") || 0);
    const stock = parseFloat(prompt("Stock inicial:") || 0);
    const familia = prompt("Familia o categoría (Sake, Vino, etc.):") || "General";

    const nuevo = { nombre, precio, stock, familia };
    const { error } = await supabase.from("productos").insert(nuevo);

    if (error) {
      alert("Error al guardar producto.");
      return;
    }

    alert("Producto añadido ✅");
    await cargarProductos();
  }

  /* =============================================================
     📥 Importar desde CSV / Excel
     ============================================================= */
  async function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const headers = rows.shift().split(",");

    const productos = rows.map(row => {
      const cols = row.split(",");
      const record = {};
      headers.forEach((h, i) => record[h.trim()] = cols[i]);
      return {
        nombre: record["nombre"] || record["Nombre"] || "",
        precio: parseFloat(record["precio"] || record["Precio"] || 0),
        stock: parseFloat(record["stock"] || record["Stock"] || 0),
        familia: record["familia"] || record["Familia"] || "General",
      };
    });

    for (const p of productos) {
      await supabase.from("productos").insert(p);
    }

    alert(`Se importaron ${productos.length} productos.`);
    fileInput.value = "";
    await cargarProductos();
  }
}
