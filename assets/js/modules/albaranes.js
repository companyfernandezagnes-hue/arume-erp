/* =============================================================
   🚚 MÓDULO: ALBARANES PRO (Detalle, IVA, Edición y Buscador)
   ============================================================= */
export async function render(container, supabase, db) {
  const albaranesOriginales = db.albaranes || [];

  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow mb-6 animate-fade-in">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-black text-slate-800">Gestión de Albaranes</h2>
        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control de Gastos e IVA</p>
      </div>
      <button id="btnImport" class="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95 transition">
        📥 IMPORTAR CSV
      </button>
    </div>

    <div class="mb-6">
        <input id="searchAlbaran" type="text" placeholder="🔍 Buscar nombre de empresa o proveedor..." 
               class="w-full p-4 rounded-2xl border border-slate-200 shadow-sm outline-none focus:ring-2 ring-indigo-500 transition-all text-sm font-medium" />
    </div>

    <div id="listAlbaranes" class="space-y-3"></div>
  </section>
  
  <div id="albaranModal" class="hidden"></div>
  <input type="file" id="csvInput" class="hidden" accept=".csv,.xlsx" />
  `;

  const listDiv = container.querySelector("#listAlbaranes");
  const searchInput = container.querySelector("#searchAlbaran");
  const importButton = container.querySelector("#btnImport");
  const csvInput = container.querySelector("#csvInput");

  importButton.onclick = () => csvInput.click();
  csvInput.onchange = handleImport;
  searchInput.oninput = updateView;

  updateView();

  /* =============================================================
     📊 MOSTRAR LISTA CON DESGLOSE DE IVA
     ============================================================= */
  function updateView() {
    const search = searchInput.value.toLowerCase();
    const filtered = albaranesOriginales.filter(a => 
        (a.proveedor || a.prov || "").toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 py-10 italic text-sm">No se encontraron albaranes para "${search}"</p>`;
      return;
    }

    listDiv.innerHTML = filtered
      .sort((a, b) => new Date(b.fecha || b.date) - new Date(a.fecha || a.date))
      .map((alb) => {
        // Cálculo de Base e IVA si no vienen separados (asumiendo 10% por defecto si no existe)
        const total = parseFloat(alb.total) || 0;
        const base = alb.subtotal || (total / 1.10);
        const iva = alb.taxes || (total - base);

        return `
        <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer" onclick="verDetalleAlbaran('${alb.id}')">
          <div>
            <p class="font-bold text-slate-800 text-base">${alb.proveedor || alb.prov || "—"}</p>
            <div class="flex gap-2 mt-1">
                <span class="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">${alb.fecha || alb.date || ""}</span>
                <span class="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono">#${alb.numero || alb.num || "S/N"}</span>
            </div>
          </div>
          <div class="text-right">
            <p class="font-black text-slate-900 text-lg">${total.toFixed(2)}€</p>
            <p class="text-[9px] text-slate-400 font-bold uppercase">Base: ${base.toFixed(2)}€ | IVA: ${iva.toFixed(2)}€</p>
          </div>
        </div>
      `;}).join("");
  }

  /* =============================================================
     👁️ VER PRODUCTOS DEL ALBARÁN Y EDITAR
     ============================================================= */
  window.verDetalleAlbaran = function(id) {
    const alb = albaranesOriginales.find(a => a.id === id);
    if (!alb) return;

    const modal = document.getElementById("albaranModal");
    modal.classList.remove("hidden");
    
    // Si el albarán tiene productos guardados en 'items'
    const productos = alb.items || [];

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
          <button onclick="document.getElementById('albaranModal').classList.add('hidden')" class="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition text-2xl">✕</button>
          
          <h3 class="text-2xl font-black text-slate-800 mb-1">${alb.proveedor || alb.prov}</h3>
          <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-6">Detalle de Productos</p>

          <div class="flex-1 overflow-y-auto custom-scrollbar mb-6 pr-2">
            <table class="w-full text-left">
                <thead class="sticky top-0 bg-white text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-50">
                    <tr><th class="pb-2">Producto</th><th class="pb-2 text-center">Cant.</th><th class="pb-2 text-right">Precio</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${productos.length > 0 ? productos.map(p => `
                        <tr>
                            <td class="py-3 text-sm font-bold text-slate-700">${p.n || p.nombre || 'Item'}</td>
                            <td class="py-3 text-sm text-center font-mono text-slate-500">${p.q || p.cantidad || 1}</td>
                            <td class="py-3 text-sm text-right font-black text-slate-800">${(p.p || p.precio || 0).toFixed(2)}€</td>
                        </tr>
                    `).join('') : '<tr><td colspan="3" class="py-10 text-center text-slate-400 italic">No hay productos desglosados en este albarán.</td></tr>'}
                </tbody>
            </table>
          </div>

          <div class="bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-slate-400 uppercase">Base Imponible</span>
                  <span class="font-bold text-slate-700">${(alb.subtotal || (alb.total/1.10)).toFixed(2)}€</span>
              </div>
              <div class="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                  <span class="text-xs font-bold text-slate-400 uppercase">IVA Aplicado</span>
                  <span class="font-bold text-slate-700">${(alb.taxes || (alb.total - (alb.total/1.10))).toFixed(2)}€</span>
              </div>
              <div class="flex justify-between items-center">
                  <span class="text-sm font-black text-indigo-600 uppercase">Total Gastado</span>
                  <span class="text-3xl font-black text-slate-900">${parseFloat(alb.total).toFixed(2)}€</span>
              </div>
          </div>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <button onclick="alert('Función de edición habilitada en próxima síncro')" class="btn-ghost text-xs">✏️ EDITAR CABECERA</button>
            <button onclick="document.getElementById('albaranModal').classList.add('hidden')" class="btn-premium bg-slate-800 text-white py-3 text-xs">CERRAR VISTA</button>
          </div>
        </div>
      </div>
    `;
  };

  /* =============================================================
     📥 IMPORTACIÓN ORIGINAL (Adaptada para guardar Base e IVA)
     ============================================================= */
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const headers = rows.shift().split(",");

    const nuevosAlbaranes = rows.map((r) => {
      const cols = r.split(",");
      const record = {};
      headers.forEach((h, i) => record[h.trim()] = cols[i]);
      
      const total = parseFloat(record["total"] || record["Importe"] || 0);
      // Separación automática de Base e IVA (10%) para el Dashboard
      const subtotal = total / 1.10;
      const taxes = total - subtotal;

      return {
        id: Math.random().toString(36).substr(2, 9),
        proveedor: record["proveedor"] || record["Proveedor"] || "—",
        fecha: record["fecha"] || record["Fecha"] || new Date().toISOString().split('T')[0],
        numero: record["numero"] || record["Nº"] || "",
        total: total,
        subtotal: subtotal,
        taxes: taxes,
        items: [] // Aquí se podrían añadir productos si el CSV los trae
      };
    });

    db.albaranes = [...albaranesOriginales, ...nuevosAlbaranes];
    
    if (window.save) {
        await window.save(`Sincronizados ${nuevosAlbaranes.length} gastos con IVA ✅`);
    }
    updateView();
  }
}
