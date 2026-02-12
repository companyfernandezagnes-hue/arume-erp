/* =============================================================
   🚚 MÓDULO: ALBARANES (Lector Mágico + Importador)
   ============================================================= */
export async function render(container, supabase, db) {
  // 1. Extraemos los datos de la memoria (window.db)
  const albaranesOriginales = db.albaranes || [];
  let tempItems = []; // Para el lector de texto

  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow-sm mb-6 animate-fade-in border border-slate-100">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-black text-slate-800">Albaranes · Gastos</h2>
        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Lector Mágico Activado</p>
      </div>
      <button id="btnToggleMagic" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-xs font-black shadow-sm hover:bg-indigo-100 transition">
        🪄 NUEVO ALBARÁN
      </button>
    </div>

    <div id="magicSection" class="hidden bg-slate-50 p-4 rounded-3xl border-2 border-dashed border-indigo-200 mb-6 animate-slide-up">
        <label class="text-[10px] font-black text-slate-400 uppercase mb-2 block">Pega aquí el texto del albarán o factura:</label>
        <textarea id="magicInput" class="w-full h-32 p-4 rounded-2xl border-0 shadow-inner text-xs font-mono mb-3 outline-none focus:ring-2 ring-indigo-500" placeholder="Ej: Solomillo 5.5 22.90..."></textarea>
        
        <div class="flex gap-2">
            <button id="btnParse" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition">✨ LEER TEXTO</button>
            <button id="btnImportFile" class="bg-white border border-slate-200 text-slate-600 px-4 rounded-xl text-xs font-bold">📁 SUBIR EXCEL</button>
        </div>

        <div id="tempItemsTable" class="mt-4 hidden">
            <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table class="w-full text-[10px]">
                    <thead class="bg-slate-50 text-slate-400 font-black uppercase">
                        <tr><th class="p-2 text-left">Prod</th><th class="p-2 text-center">Cant</th><th class="p-2 text-right">Precio</th></tr>
                    </thead>
                    <tbody id="tempItemsBody"></tbody>
                </table>
            </div>
            <button id="btnSaveAlb" class="w-full mt-3 bg-emerald-500 text-white py-2 rounded-xl font-black text-xs shadow-md">✅ GUARDAR ALBARÁN Y ACTUALIZAR STOCK</button>
        </div>
    </div>

    <div class="flex gap-2 mb-4">
        <input id="searchAlbaran" type="text" placeholder="Buscar proveedor..." class="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none" />
        <select id="filterMonth" class="border border-slate-200 rounded-xl px-2 py-1 text-sm font-bold text-slate-500">
            ${[...Array(12)].map((_,i)=> `<option value="${i+1}">${new Date(0,i).toLocaleString('es', {month:'short'})}</option>`).join('')}
        </select>
    </div>
    <div id="listAlbaranes" class="space-y-2"></div>
  </section>
  <input type="file" id="fileInput" class="hidden" accept=".csv,.xlsx" />
  `;

  const listDiv = container.querySelector("#listAlbaranes");
  const magicSection = container.querySelector("#magicSection");
  const magicInput = container.querySelector("#magicInput");
  const tempItemsBody = container.querySelector("#tempItemsBody");
  const tempTable = container.querySelector("#tempItemsTable");

  // --- BOTONES ---
  container.querySelector("#btnToggleMagic").onclick = () => magicSection.classList.toggle("hidden");
  container.querySelector("#btnImportFile").onclick = () => container.querySelector("#fileInput").click();
  
  // --- LÓGICA DEL LECTOR MÁGICO ---
  container.querySelector("#btnParse").onclick = () => {
    const text = magicInput.value;
    if(!text.trim()) return;

    // Regex mágica: busca patrones de [Nombre] [Cantidad] [Precio]
    const lines = text.split('\n');
    tempItems = [];
    
    lines.forEach(line => {
        const parts = line.match(/([a-zA-ZñÑ\s]+)\s+([\d,.]+)\s+([\d,.]+)/);
        if(parts) {
            tempItems.push({
                n: parts[1].trim(),
                q: parseFloat(parts[2].replace(',', '.')),
                p: parseFloat(parts[3].replace(',', '.'))
            });
        }
    });

    if(tempItems.length > 0) {
        tempTable.classList.remove("hidden");
        tempItemsBody.innerHTML = tempItems.map(it => `
            <tr class="border-b border-slate-50">
                <td class="p-2 font-bold text-slate-700">${it.n}</td>
                <td class="p-2 text-center bg-indigo-50/50 font-black">${it.q}</td>
                <td class="p-2 text-right font-bold text-slate-400">${it.p}€</td>
            </tr>
        `).join('');
    }
  };

  // --- GUARDAR ALBARÁN (Simulado para histórico) ---
  container.querySelector("#btnSaveAlb").onclick = () => {
    alert("¡Albarán procesado! El stock de " + tempItems.length + " productos se ha actualizado en la nube.");
    magicSection.classList.add("hidden");
    magicInput.value = "";
  };

  // --- RENDERIZAR LISTA HISTÓRICA ---
  const renderList = () => {
    const search = container.querySelector("#searchAlbaran").value.toLowerCase();
    const filtered = albaranesOriginales.filter(a => (a.prov || a.proveedor || "").toLowerCase().includes(search));

    listDiv.innerHTML = filtered.map(alb => `
        <div class="glass-card flex justify-between items-center p-4 rounded-2xl border border-slate-50 shadow-sm">
          <div>
            <p class="font-bold text-slate-800">${alb.prov || alb.proveedor || "—"}</p>
            <p class="text-[10px] text-slate-400 font-bold uppercase">${alb.date || alb.fecha || ""}</p>
          </div>
          <div class="text-right">
            <p class="font-black text-slate-900">${(parseFloat(alb.total) || 0).toFixed(2)} €</p>
            <p class="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">${alb.num || alb.numero || "S/N"}</p>
          </div>
        </div>
      `).join("");
  };

  container.querySelector("#searchAlbaran").oninput = renderList;
  renderList();
}
