/* =============================================================
   🚚 MÓDULO: ALBARANES PRO (Corregido)
   ============================================================= */

// IMPORTANTE: Cambiamos el nombre de la función a 'render' para que app.js la reconozca
export async function render(container, supabase, db, opts = {}) {
  
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  
  // Utilidad interna de conversión
  const UnitConverter = {
    normalize: (u) => {
      if (!u) return 'ud';
      u = String(u).toLowerCase().trim().replace('.', '');
      if (['kg', 'kilo', 'k'].includes(u)) return 'kg';
      if (['g', 'gr', 'gramos'].includes(u)) return 'g';
      if (['l', 'litro', 'lt'].includes(u)) return 'l';
      if (['ml', 'mili'].includes(u)) return 'ml';
      if (['cl', 'centi'].includes(u)) return 'cl';
      return 'ud';
    }
  };

  // ====== Estado ======
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  const listaSocios = Array.isArray(db.listaSocios) && db.listaSocios.length ? db.listaSocios : ['Jeronimo','Pedro','Pau','Agnes'];
  let search = "";
  let ownerFilter = 'Todos'; 

  // ====== UI ======
  container.innerHTML = `
    <section class="p-6 bg-white rounded-3xl shadow mb-6 animate-fade-in">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 class="text-xl font-black text-slate-800">Gestión de Albaranes</h2>
          <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control de Gastos, Socios e IVA</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="btnPaste" class="bg-emerald-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95 transition">📋 PEGAR TEXTO</button>
          <button id="btnExport" class="bg-slate-800 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95 transition">⬇️ EXPORTAR</button>
          <button id="btnImport" class="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95 transition">📥 IMPORTAR</button>
        </div>
      </div>

      <div class="flex gap-2 mb-3">
        <button data-of="Todos" class="filter-btn px-4 py-1.5 rounded-full text-[10px] font-bold border bg-slate-900 text-white">Todos</button>
        <button data-of="Arume" class="filter-btn px-4 py-1.5 rounded-full text-[10px] font-bold border bg-white text-slate-600">Restaurante</button>
        <button data-of="Socios" class="filter-btn px-4 py-1.5 rounded-full text-[10px] font-bold border bg-white text-slate-600">Socios</button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <input id="fProv" type="text" placeholder="Proveedor..." class="p-3 rounded-2xl border border-slate-200 text-sm outline-none">
        <input id="fRef" type="text" placeholder="Factura/Ref..." class="p-3 rounded-2xl border border-slate-200 text-sm outline-none">
        <input id="fDate" type="date" class="p-3 rounded-2xl border border-slate-200 text-sm outline-none">
        <select id="fDupSocio" class="p-3 rounded-2xl border border-slate-200 text-sm outline-none bg-white">
          <option value="Arume">Arume / Restaurante</option>
          ${listaSocios.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>

      <div id="dupBox" class="mb-4"></div>

      <div class="mb-6">
          <input id="searchAlbaran" type="text" placeholder="🔍 Buscar por proveedor o #ref..." 
                 class="w-full p-4 rounded-2xl border border-slate-200 shadow-sm outline-none focus:ring-2 ring-indigo-500 transition-all text-sm font-medium" />
      </div>

      <div id="listAlbaranes" class="space-y-3"></div>
    </section>

    <div id="albaranModal" class="hidden"></div>
    <div id="pasteModal" class="hidden"></div>
    <input type="file" id="csvInput" class="hidden" accept=".csv" />
  `;

  // ====== Refs ======
  const listDiv = container.querySelector("#listAlbaranes");
  const searchInput = container.querySelector("#searchAlbaran");
  const fProv = container.querySelector("#fProv");
  const fRef = container.querySelector("#fRef");
  const fDate = container.querySelector("#fDate");
  const fDupSocio = container.querySelector("#fDupSocio");
  const dupBox = container.querySelector("#dupBox");
  const csvInput = container.querySelector("#csvInput");

  // ====== Eventos ======
  container.querySelector("#btnImport").onclick = () => csvInput.click();
  csvInput.onchange = handleImportCSV;
  container.querySelector("#btnExport").onclick = exportFilteredToCSV;
  container.querySelector("#btnPaste").onclick = openPasteModal;

  // Filtros de pestaña
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.replace('bg-slate-900', 'bg-white');
        b.classList.replace('text-white', 'text-slate-600');
      });
      btn.classList.replace('bg-white', 'bg-slate-900');
      btn.classList.replace('text-slate-600', 'text-white');
      ownerFilter = btn.dataset.of;
      updateView();
    };
  });

  [searchInput, fProv, fRef, fDate, fDupSocio].forEach(el => {
    el.addEventListener('input', () => {
      search = searchInput.value.trim().toLowerCase();
      detectDuplicate(fProv.value, fRef.value, fDupSocio.value);
      updateView();
    });
  });

  // Ejecución inicial
  updateView();

  /* =============================================================
     🔍 Lógica de Duplicados
     ============================================================= */
  function detectDuplicate(proveedor, numero, socioOpt) {
    const prov = (proveedor || "").trim().toLowerCase();
    const ref = (numero || "").trim().toLowerCase();
    const soc = (socioOpt || "Arume").trim().toLowerCase();
    
    if (!prov || !ref) { dupBox.innerHTML = ""; return; }

    const dup = db.albaranes.find(a => 
      String(a.prov || a.proveedor || "").toLowerCase().trim() === prov && 
      String(a.num || a.numero || "").toLowerCase().trim() === ref &&
      String(a.socio || "Arume").toLowerCase().trim() === soc
    );

    if (dup) {
      dupBox.innerHTML = `
        <div class="p-3 bg-red-50 border border-red-200 rounded-2xl flex justify-between items-center animate-pulse">
          <span class="text-xs font-bold text-red-600">⚠️ ESTA FACTURA YA EXISTE (${dup.date || dup.fecha})</span>
          <button class="text-[10px] font-black bg-red-600 text-white px-3 py-1 rounded-lg" onclick="verDetalleAlbaran('${dup.id}')">VER</button>
        </div>`;
    } else {
      dupBox.innerHTML = `<div class="text-[10px] font-bold text-emerald-600 ml-2">✅ Referencia nueva disponible</div>`;
    }
  }

  /* =============================================================
     📊 Renderizado de Lista
     ============================================================= */
  function updateView() {
    const filtered = db.albaranes.filter(a => {
      const socio = (a.socio || 'Arume').trim();
      const isSocio = socio !== 'Arume' && socio !== 'Restaurante';
      
      if (ownerFilter === 'Arume' && isSocio) return false;
      if (ownerFilter === 'Socios' && !isSocio) return false;

      const provText = (a.prov || a.proveedor || "").toLowerCase();
      const refText = (a.num || a.numero || "").toLowerCase();
      
      return (provText.includes(search) || refText.includes(search)) &&
             (fProv.value ? provText.includes(fProv.value.toLowerCase()) : true) &&
             (fRef.value ? refText.includes(fRef.value.toLowerCase()) : true) &&
             (fDate.value ? (a.date || a.fecha) === fDate.value : true);
    }).sort((a,b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha));

    if (filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 py-10 italic">No hay resultados</p>`;
      return;
    }

    listDiv.innerHTML = filtered.map(alb => {
      const { base, iva, total } = computeTotals(alb);
      const socio = (alb.socio || 'Arume').trim();
      const isSocio = socio !== 'Arume' && socio !== 'Restaurante';

      return `
        <div class="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex justify-between items-center hover:bg-slate-50 transition cursor-pointer" onclick="verDetalleAlbaran('${alb.id}')">
          <div>
            <div class="flex items-center gap-2">
              <p class="font-bold text-slate-800">${escapeHtml(alb.prov || alb.proveedor)}</p>
              ${isSocio ? `<span class="text-[8px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-black uppercase">${socio}</span>` : ''}
            </div>
            <p class="text-[10px] text-slate-400 font-bold uppercase mt-0.5">${alb.date || alb.fecha} · #${alb.num || alb.numero}</p>
          </div>
          <div class="text-right">
            <p class="font-black text-slate-900 text-lg">${fmt(total)}€</p>
            <p class="text-[9px] text-slate-400 font-bold">BASE: ${fmt(base)}€ | IVA: ${fmt(iva)}€</p>
          </div>
        </div>`;
    }).join("");
  }

  /* =============================================================
     👁️ Ver Detalle / Modal
     ============================================================= */
  window.verDetalleAlbaran = (id) => {
    const alb = db.albaranes.find(a => a.id === id);
    if (!alb) return;
    const { base, iva, total } = computeTotals(alb);
    const modal = container.querySelector("#albaranModal");
    modal.classList.remove("hidden");

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative animate-slide-up">
           <button onclick="document.getElementById('albaranModal').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition text-2xl">✕</button>
           <h3 class="text-xl font-black text-slate-800 mb-1">${alb.prov || alb.proveedor}</h3>
           <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-6">${alb.date || alb.fecha} · REF: ${alb.num || alb.numero}</p>
           
           <div class="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              ${(alb.items || []).map(it => `
                <div class="flex justify-between items-center border-b border-slate-50 pb-2">
                   <div class="text-xs font-bold text-slate-700">${it.n}</div>
                   <div class="text-right">
                      <div class="text-xs font-black text-slate-900">${fmt(it.q * it.p)}€</div>
                      <div class="text-[9px] text-slate-400">${it.q} x ${fmt(it.p)}€</div>
                   </div>
                </div>
              `).join('')}
           </div>

           <div class="bg-slate-50 rounded-3xl p-6">
              <div class="flex justify-between text-xs mb-1 font-bold text-slate-400 uppercase"><span>Base</span> <span>${fmt(base)}€</span></div>
              <div class="flex justify-between text-xs mb-3 font-bold text-slate-400 uppercase border-b pb-2"><span>IVA</span> <span>${fmt(iva)}€</span></div>
              <div class="flex justify-between text-2xl font-black text-slate-900"><span>TOTAL</span> <span>${fmt(total)}€</span></div>
           </div>

           <div class="grid grid-cols-2 gap-3 mt-6">
              <button class="bg-rose-50 text-rose-600 py-3 rounded-2xl text-[10px] font-black" onclick="deleteAlbaran('${alb.id}')">ELIMINAR</button>
              <button class="bg-slate-900 text-white py-3 rounded-2xl text-[10px] font-black" onclick="document.getElementById('albaranModal').classList.add('hidden')">CERRAR</button>
           </div>
        </div>
      </div>`;
  };

  window.deleteAlbaran = async (id) => {
    if (!confirm("¿Borrar este albarán?")) return;
    db.albaranes = db.albaranes.filter(a => a.id !== id);
    await saveFn("Albarán borrado");
    container.querySelector("#albaranModal").classList.add("hidden");
    updateView();
  };

  /* =============================================================
     📋 Pegado de Texto
     ============================================================= */
  function openPasteModal() {
    const modal = container.querySelector("#pasteModal");
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
        <div class="bg-white w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl relative">
          <h3 class="text-xl font-black mb-4">Pegar Albarán</h3>
          <textarea id="pm-text" class="w-full h-40 bg-slate-50 border-0 rounded-2xl p-4 text-xs font-mono mb-4 outline-none" placeholder="Copia y pega las líneas aquí..."></textarea>
          <div class="flex gap-2">
            <button class="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs" id="btnDoPaste">PROCESAR Y GUARDAR</button>
            <button class="px-6 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-xs" onclick="document.getElementById('pasteModal').classList.add('hidden')">CANCELAR</button>
          </div>
        </div>
      </div>`;

    container.querySelector("#btnDoPaste").onclick = async () => {
      const txt = container.querySelector("#pm-text").value;
      if (!txt.trim()) return;
      
      const lines = txt.split('\n').filter(l => l.trim());
      const items = lines.map(l => {
        const parts = l.match(/([a-zA-ZñÑ\s]+)\s+([\d,.]+)\s+([\d,.]+)/);
        if (parts) {
          return { n: parts[1].trim(), q: parseFloat(parts[2].replace(',','.')), p: parseFloat(parts[3].replace(',','.')) };
        }
        return null;
      }).filter(Boolean);

      if (items.length) {
        const total = items.reduce((acc, it) => acc + (it.q * it.p), 0);
        const nuevo = {
          id: Math.random().toString(36).slice(2,11),
          prov: fProv.value || "Varios",
          num: fRef.value || "S/N",
          date: fDate.value || new Date().toISOString().split('T')[0],
          socio: fDupSocio.value,
          items: items,
          total: total * 1.10, // IVA 10% auto
          invoiced: false
        };
        db.albaranes.push(nuevo);
        await saveFn("Nuevo albarán pegado");
        modal.classList.add("hidden");
        updateView();
      }
    };
  }

  /* =============================================================
     📥 Importar CSV
     ============================================================= */
  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').slice(1);
      rows.forEach(row => {
        const cols = row.split(';');
        if (cols.length >= 4) {
          db.albaranes.push({
            id: Math.random().toString(36).slice(2,11),
            fecha: cols[0], date: cols[0],
            prov: cols[1], proveedor: cols[1],
            num: cols[2], numero: cols[2],
            total: parseFloat(cols[3].replace(',','.')) || 0,
            socio: cols[4] || "Arume"
          });
        }
      });
      await saveFn("CSV Importado");
      updateView();
    };
    reader.readAsText(file);
  }

  function exportFilteredToCSV() {
    let csv = "Fecha;Proveedor;Ref;Total;Socio\n";
    db.albaranes.forEach(a => {
      csv += `${a.date || a.fecha};${a.prov || a.proveedor};${a.num || a.numero};${a.total};${a.socio}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'albaranes.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ====== Helpers ======
  function computeTotals(alb) {
    const total = parseFloat(alb.total) || 0;
    const base = total / 1.10;
    const iva = total - base;
    return { base, iva, total };
  }

  function fmt(n) { return Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function escapeHtml(str) { return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
}
