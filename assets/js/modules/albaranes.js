/* =============================================================
   🚚 MÓDULO: ALBARANES PRO (Socios, Duplicados, Pegado, IVA, CSV)
   Copiar/pegar y llamar:  renderAlbaranes(container, supabase, db)
   ============================================================= */
export async function renderAlbaranes(container, supabase, db, opts = {}) {
  // ====== Dependencias opcionales inyectables ======
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  const UnitConverter = opts.UnitConverter || {
    normalize: (u) => {
      if (!u) return 'ud';
      u = String(u).toLowerCase().trim().replace('.', '');
      if (['kg', 'kilo', 'k'].includes(u)) return 'kg';
      if (['g', 'gr', 'gramos'].includes(u)) return 'g';
      if (['mg'].includes(u)) return 'mg';
      if (['lb', 'libra'].includes(u)) return 'lb';
      if (['oz', 'onza'].includes(u)) return 'oz';
      if (['l', 'litro', 'lt'].includes(u)) return 'l';
      if (['ml', 'mili'].includes(u)) return 'ml';
      if (['cl', 'centi'].includes(u)) return 'cl';
      return 'ud';
    },
    convert: (q, from, to) => {
      from = UnitConverter.normalize(from);
      to   = UnitConverter.normalize(to);
      if (from === to) return q;
      const toG  = { kg: 1000, g: 1, mg: 0.001, lb: 453.59, oz: 28.35 };
      const toMl = { l: 1000, ml: 1, cl: 10 };
      if (toG[from] && toG[to])   return q * (toG[from] / toG[to]);
      if (toMl[from] && toMl[to]) return q * (toMl[from] / toMl[to]);
      return null;
    }
  };

  // ====== Estado ======
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  const listaSocios = Array.isArray(db.listaSocios) && db.listaSocios.length ? db.listaSocios : ['Jeronimo','Pedro','Pau','Agnes'];
  let albaranes = [...db.albaranes];
  let search = "";
  let ownerFilter = 'Todos'; // 'Todos' | 'Arume' | 'Socios'

  // ====== UI ======
  container.innerHTML = `
    <section class="p-6 bg-white rounded-3xl shadow mb-6 animate-fade-in">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-xl font-black text-slate-800">Gestión de Albaranes</h2>
          <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control de Gastos, Socios e IVA</p>
        </div>
        <div class="flex gap-2">
          <button id="btnPaste" class="bg-emerald-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95">📋 PEGAR DESDE FACTURA</button>
          <button id="btnExport" class="bg-slate-800 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95">⬇️ EXPORTAR CSV</button>
          <button id="btnImport" class="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95">📥 IMPORTAR CSV</button>
        </div>
      </div>

      <div class="flex gap-2 mb-3">
        <button data-of="Todos"  class="px-3 py-1 rounded-full text-[10px] border">Todos</button>
        <button data-of="Arume"  class="px-3 py-1 rounded-full text-[10px] border">Solo Restaurante</button>
        <button data-of="Socios" class="px-3 py-1 rounded-full text-[10px] border">Solo Socios</button>
      </div>

      <div class="grid grid-cols-4 gap-2 mb-4">
        <input id="fProv"  type="text" placeholder="Proveedor..." class="p-3 rounded-2xl border border-slate-200 text-sm">
        <input id="fRef"   type="text" placeholder="Referencia/Factura..." class="p-3 rounded-2xl border border-slate-200 text-sm">
        <input id="fDate"  type="date" class="p-3 rounded-2xl border border-slate-200 text-sm">
        <select id="fDupSocio" class="p-3 rounded-2xl border border-slate-200 text-sm">
          <option value="Arume">Arume / Restaurante</option>
          ${listaSocios.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>

      <div id="dupBox" class="mb-1"></div>

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

  // ====== Refs & Eventos ======
  const listDiv     = container.querySelector("#listAlbaranes");
  const searchInput = container.querySelector("#searchAlbaran");
  const fProv       = container.querySelector("#fProv");
  const fRef        = container.querySelector("#fRef");
  const fDate       = container.querySelector("#fDate");
  const fDupSocio   = container.querySelector("#fDupSocio");
  const dupBox      = container.querySelector("#dupBox");
  const importBtn   = container.querySelector("#btnImport");
  const exportBtn   = container.querySelector("#btnExport");
  const pasteBtn    = container.querySelector("#btnPaste");
  const csvInput    = container.querySelector("#csvInput");

  importBtn.onclick = () => csvInput.click();
  csvInput.onchange = handleImportCSV;
  exportBtn.onclick = exportFilteredToCSV;
  pasteBtn.onclick = openPasteModal;

  container.querySelectorAll('[data-of]').forEach(b => {
    b.onclick = () => { ownerFilter = b.dataset.of; updateView(); };
  });

  [searchInput, fProv, fRef, fDate, fDupSocio].forEach(el => el.addEventListener('input', () => {
    search = searchInput.value.trim().toLowerCase();
    detectDuplicate(fProv.value, fRef.value, fDupSocio.value);
    updateView();
  }));

  updateView();

  /* =============================================================
     🔍 Detección de duplicados (Proveedor + Nº + Socio)
     ============================================================= */
  function detectDuplicate(proveedor, numero, socioOpt) {
    const prov = (proveedor || "").trim().toLowerCase();
    const ref  = (numero || "").trim().toLowerCase();
    const soc  = (socioOpt || "Arume").trim().toLowerCase();
    if (!prov || !ref) {
      dupBox.innerHTML = "";
      return;
    }
    const dup = albaranes.find(a =>
      String(a.prov || a.proveedor || "").trim().toLowerCase() === prov &&
      String(a.num  || a.numero    || "").trim().toLowerCase() === ref  &&
      String(a.socio|| 'Arume').trim().toLowerCase() === soc
    );
    if (!dup) {
      dupBox.innerHTML = `<div class="text-[10px] font-bold text-emerald-600">✅ Referencia disponible</div>`;
      return;
    }
    dupBox.innerHTML = `
      <div class="mt-1 p-3 bg-red-100 border-l-4 border-red-500 rounded text-xs flex justify-between items-center shadow-sm">
        <div>
          <div class="font-bold text-red-700">⛔ FACTURA REPETIDA</div>
          <div class="text-red-500">Ya existe desde el ${escapeHtml(dup.date || dup.fecha || '')}</div>
        </div>
        <button class="bg-white text-red-600 border border-red-200 px-3 py-1 rounded-lg font-bold hover:bg-red-50 transition" data-view="${dup.id}">
          VER ORIGINAL
        </button>
      </div>`;
    dupBox.querySelector('[data-view]').onclick = (e) => verDetalleAlbaran(e.target.dataset.view);
  }

  /* =============================================================
     📊 Render listado con badges & resumen por socios
     ============================================================= */
  function updateView() {
    const query = search;
    const filtered = albaranes
      .filter(a => {
        // Filtros por titular (socio/restaurante)
        const socio = (a.socio || 'Arume').trim();
        const isSocio = (socio !== 'Arume' && socio !== 'Restaurante');
        if (ownerFilter === 'Arume'  && isSocio) return false;
        if (ownerFilter === 'Socios' && !isSocio) return false;

        const prov = String(a.proveedor || a.prov || "").toLowerCase();
        const ref  = String(a.numero || a.num || "").toLowerCase();

        // Búsqueda rápida + filtros cabecera
        const hit      = prov.includes(query) || ref.includes(query);
        const passProv = fProv.value ? prov.includes(fProv.value.toLowerCase()) : true;
        const passRef  = fRef.value  ? ref.includes(fRef.value.toLowerCase())   : true;
        const passDate = fDate.value ? (String(a.fecha || a.date) === fDate.value) : true;
        return hit && passProv && passRef && passDate;
      })
      .sort((a, b) => new Date(b.fecha || b.date) - new Date(a.fecha || a.date));

    if (filtered.length === 0) {
      listDiv.innerHTML = `<p class="text-center text-slate-400 py-10 italic text-sm">No se encontraron albaranes.</p>`;
      return;
    }

    const summaryHTML = ownerFilter === 'Socios' ? renderSociosSummary(filtered) : '';
    listDiv.innerHTML = summaryHTML + filtered.map((alb) => {
      const { base, iva, total } = computeTotals(alb);
      const hasNotes = !!(alb.notes && String(alb.notes).trim().length);
      const invoiced = !!alb.invoiced;
      const socio = (alb.socio || 'Arume').trim();
      const isSocio = (socio !== 'Arume' && socio !== 'Restaurante');
      const socioBadge = isSocio
        ? `<span class="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">${escapeHtml(socio)}</span>`
        : `<span class="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Arume</span>`;

      return `
      <div class="p-5 rounded-3xl border ${hasNotes ? 'border-red-400 bg-red-50/40' : 'border-slate-100 bg-white'} shadow-sm flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer"
           onclick="verDetalleAlbaran('${alb.id}')">
        <div>
          <p class="font-bold text-slate-800 text-base">${escapeHtml(alb.proveedor || alb.prov || "—")}</p>
          <div class="flex gap-2 mt-1 items-center">
              <span class="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">${escapeHtml(alb.fecha || alb.date || "")}</span>
              <span class="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono">#${escapeHtml(alb.numero || alb.num || "S/N")}</span>
              ${socioBadge}
              ${invoiced ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">FACTURADO</span>` : ``}
              ${hasNotes ? `<span class="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">NOTAS</span>` : ``}
          </div>
          ${hasNotes ? `<div class="text-[10px] text-red-600 mt-1 font-bold">${escapeHtml(alb.notes)}</div>` : ''}
        </div>
        <div class="text-right">
          <p class="font-black text-slate-900 text-lg">${fmt(total)}€</p>
          <p class="text-[9px] text-slate-400 font-bold uppercase">Base: ${fmt(base)}€ | IVA: ${fmt(iva)}€</p>
        </div>
      </div>`;
    }).join("");
  }

  function renderSociosSummary(albaranesFiltrados) {
    const map = new Map(); // socio -> total
    albaranesFiltrados.forEach(a => {
      const socio = (a.socio || 'Arume').trim();
      if (socio === 'Arume' || socio === 'Restaurante') return;
      const { total } = computeTotals(a);
      map.set(socio, (map.get(socio) || 0) + total);
    });
    if (map.size === 0) return '';
    const items = [...map.entries()]
      .sort((a,b) => b[1]-a[1])
      .map(([s, t]) => `<div class="flex justify-between text-[10px]"><span class="font-bold text-slate-600">${escapeHtml(s)}</span><span class="font-mono">${fmt(t)}€</span></div>`)
      .join('');
    return `
      <div class="mb-3 bg-purple-50 border border-purple-200 rounded-2xl p-3">
        <div class="text-[10px] font-black text-purple-900 uppercase tracking-widest mb-1">Cuenta Socios (Periodo visible)</div>
        ${items}
      </div>`;
  }

  /* =============================================================
     👁️ Detalle + Edición Cabecera (proveedor/fecha/ref/notas)
     ============================================================= */
  window.verDetalleAlbaran = function(id) {
    const alb = albaranes.find(a => a.id === id);
    if (!alb) return;

    const { base, iva, total } = computeTotals(alb);
    const productos = alb.items || [];
    const modal = document.getElementById("albaranModal");
    modal.classList.remove("hidden");

    const socioOptions = ['Arume','Restaurante', ...listaSocios]
      .map(s => `<option value="${s}" ${String(alb.socio||'Arume')===s?'selected':''}>${s}</option>`).join('');

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
        <div class="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 relative animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
          <button onclick="document.getElementById('albaranModal').classList.add('hidden')" class="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition text-2xl">✕</button>
          
          <h3 class="text-2xl font-black text-slate-800 mb-1">${escapeHtml(alb.proveedor || alb.prov || '')}</h3>
          <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-6">Detalle de Productos</p>

          <div class="grid grid-cols-4 gap-2 mb-4">
            <input id="ed-prov"  class="p-2 border rounded-xl" placeholder="Proveedor" value="${escapeHtml(alb.proveedor || alb.prov || '')}">
            <input id="ed-ref"   class="p-2 border rounded-xl" placeholder="Referencia/Factura" value="${escapeHtml(alb.numero || alb.num || '')}">
            <input id="ed-fecha" type="date" class="p-2 border rounded-xl" value="${escapeHtml(alb.fecha || alb.date || '')}">
            <select id="ed-socio" class="p-2 border rounded-xl">${socioOptions}</select>
          </div>

          <textarea id="ed-notes" class="w-full p-3 border rounded-xl text-sm mb-4" rows="2" placeholder="Notas / Incidencias...">${escapeHtml(alb.notes || '')}</textarea>

          <div class="flex-1 overflow-y-auto custom-scrollbar mb-6 pr-2">
            <table class="w-full text-left">
              <thead class="sticky top-0 bg-white text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-50">
                <tr><th class="pb-2">Producto</th><th class="pb-2 text-center">Cant.</th><th class="pb-2 text-right">Precio</th><th class="pb-2 text-right">IVA</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                ${productos.length > 0 ? productos.map(p => `
                  <tr>
                      <td class="py-3 text-sm font-bold text-slate-700">${escapeHtml(p.n || p.nombre || 'Item')}</td>
                      <td class="py-3 text-sm text-center font-mono text-slate-500">${fmt(p.q || p.cantidad || 1)} ${escapeHtml(p.unit || '')}</td>
                      <td class="py-3 text-sm text-right font-black text-slate-800">${fmt(p.p || p.precio || 0)}€</td>
                      <td class="py-3 text-sm text-right font-mono text-slate-500">${fmt(p.tax ?? 10)}%</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" class="py-10 text-center text-slate-400 italic">No hay productos desglosados en este albarán.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="bg-slate-50 rounded-3xl p-6 border border-slate-100">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-slate-400 uppercase">Base Imponible</span>
                <span class="font-bold text-slate-700">${fmt(base)}€</span>
            </div>
            <div class="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                <span class="text-xs font-bold text-slate-400 uppercase">IVA Aplicado</span>
                <span class="font-bold text-slate-700">${fmt(iva)}€</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-sm font-black text-indigo-600 uppercase">Total Gastado</span>
                <span class="text-3xl font-black text-slate-900">${fmt(total)}€</span>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-3 gap-3">
            <button class="text-xs border rounded-xl py-2" id="btnSaveHead">💾 GUARDAR</button>
            <button class="text-xs border rounded-xl py-2 text-red-600" id="btnDelete">🗑 BORRAR</button>
            <button class="bg-slate-800 text-white py-3 text-xs rounded-xl" onclick="document.getElementById('albaranModal').classList.add('hidden')">CERRAR</button>
          </div>
        </div>
      </div>
    `;

    // Guardar cabecera
    modal.querySelector('#btnSaveHead').onclick = async () => {
      alb.prov      = modal.querySelector('#ed-prov').value.trim();
      alb.proveedor = alb.prov;
      alb.num       = modal.querySelector('#ed-ref').value.trim();
      alb.numero    = alb.num;
      alb.date      = modal.querySelector('#ed-fecha').value;
      alb.fecha     = alb.date;
      const socioSel= modal.querySelector('#ed-socio').value;
      alb.socio     = (socioSel === 'Arume' || socioSel === 'Restaurante') ? 'Arume' : socioSel;
      alb.notes     = modal.querySelector('#ed-notes').value.trim();

      const t = computeTotals(alb);
      alb.subtotal = t.base;
      alb.taxes    = t.iva;
      alb.total    = t.total;

      const idx = db.albaranes.findIndex(a => a.id === alb.id);
      if (idx >= 0) db.albaranes[idx] = alb;
      await saveFn("Cabecera actualizada");
      updateLocalState();
      updateView();
    };

    // Eliminar albarán (sin tocar stock aquí)
    modal.querySelector('#btnDelete').onclick = async () => {
      if (!confirm("¿Borrar albarán?")) return;
      db.albaranes = db.albaranes.filter(a => a.id !== alb.id);
      await saveFn("Albarán eliminado");
      updateLocalState();
      updateView();
      modal.classList.add('hidden');
    };
  };

  /* =============================================================
     📥 Import CSV (usa base/iva si están; si no, 10% por defecto)
     ============================================================= */
  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(r => r.trim().length);
    const headers = rows.shift().split(/[;,]/);

    const nuevos = rows.map((r) => {
      const cols = r.split(/[;,]/);
      const record = {};
      headers.forEach((h, i) => record[h.trim()] = (cols[i] || '').trim());
      
      const total = parseFloat(record.total || record.Importe || record.Total || 0) || 0;
      const prov  = record.proveedor || record.Proveedor || record.PROVEEDOR || "—";
      const fecha = normDate(record.fecha || record.Fecha);
      const num   = record.numero || record['Nº'] || record.Numero || record.Num || '';
      const socio = record.socio || record.Socio || 'Arume';

      const base = parseFloat(record.base || record.Base) || (total / 1.10);
      const iva  = parseFloat(record.iva  || record.IVA)  || (total - base);

      return {
        id: genId(),
        prov, proveedor: prov,
        date: fecha, fecha,
        num,  numero: num,
        socio: (socio === 'Arume' || socio === 'Restaurante') ? 'Arume' : socio,
        total: round2(total), subtotal: round2(base), taxes: round2(iva),
        invoiced: false,
        notes: "",
        items: [] // si el CSV los trae, aquí se incorporan
      };
    });

    db.albaranes = [...albaranes, ...nuevos];
    await saveFn(`Sincronizados ${nuevos.length} gastos con IVA ✅`);
    updateLocalState();
    updateView();
    e.target.value = '';
  }

  /* =============================================================
     📋 Pegado inteligente (líneas → items) + Socio + Packs + IVA
     ============================================================= */
  function openPasteModal() {
    const modal = document.getElementById("pasteModal");
    modal.classList.remove("hidden");
    const socioOptions = ['Arume','Restaurante', ...listaSocios]
      .map(s => `<option value="${s}">${s}</option>`).join('');

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
        <div class="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl p-8 relative animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
          <button onclick="document.getElementById('pasteModal').classList.add('hidden')" class="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition text-2xl">✕</button>
          <h3 class="text-2xl font-black text-slate-800 mb-1">Pegar líneas de albarán</h3>
          <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-4">Detecta cantidades, precio, unidad y packs</p>

          <div class="grid grid-cols-4 gap-2 mb-2">
            <input id="pm-prov"  class="p-2 border rounded-xl" placeholder="Proveedor">
            <input id="pm-ref"   class="p-2 border rounded-xl" placeholder="Ref/Factura">
            <input id="pm-fecha" type="date" class="p-2 border rounded-xl" value="${getISO()}">
            <select id="pm-socio" class="p-2 border rounded-xl">${socioOptions}</select>
          </div>

          <textarea id="pm-text" rows="8" class="w-full p-3 border rounded-2xl font-mono text-xs mb-3" placeholder="Ej: Solomillo 5.5 kg 22,90 (10%)"></textarea>
          <div class="flex gap-2">
            <button class="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95" id="pm-parse">LEER TEXTO</button>
            <button class="bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl text-xs font-black border" onclick="document.getElementById('pasteModal').classList.add('hidden')">CANCELAR</button>
          </div>

          <div class="mt-4">
            <h4 class="text-xs font-bold text-slate-400 uppercase mb-2">Previsualización</h4>
            <div id="pm-grid" class="max-h-64 overflow-y-auto border rounded-xl p-2"></div>
          </div>

          <div class="mt-4 flex justify-end">
            <button class="bg-emerald-600 text-white px-5 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95" id="pm-commit">GUARDAR ALBARÁN</button>
          </div>
        </div>
      </div>
    `;

    let tempItems = [];
    const pmSocioEl = modal.querySelector('#pm-socio');

    modal.querySelector('#pm-parse').onclick = () => {
      const raw = modal.querySelector('#pm-text').value || '';
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      tempItems = [];
      lines.forEach(ln => {
        const res = detectLinePattern(ln);
        if (!res || !res.name || res.name.length < 2) return;
        const conv = detectPackSize(res.name);
        const item = {
          n: res.name,
          q: Number(res.q || 1),
          unit: res.unit || 'ud',
          p: Number(res.p || 0),
          d: Number(res.d || 0),
          tax: Number(res.t ?? guessTax(res.name)),
          conv: conv > 0 ? conv : 1,
        };
        tempItems.push(item);
      });
      renderPreview();
      // Actualiza duplicados en contexto de socio:
      const prov = modal.querySelector('#pm-prov').value;
      const ref  = modal.querySelector('#pm-ref').value;
      detectDuplicate(prov, ref, pmSocioEl.value);
    };

    pmSocioEl.onchange = () => {
      const prov = modal.querySelector('#pm-prov').value;
      const ref  = modal.querySelector('#pm-ref').value;
      detectDuplicate(prov, ref, pmSocioEl.value);
    };

    modal.querySelector('#pm-commit').onclick = async () => {
      const prov  = modal.querySelector('#pm-prov').value.trim() || '—';
      const num   = modal.querySelector('#pm-ref').value.trim()  || `A-${Date.now().toString().slice(-6)}`;
      const fecha = modal.querySelector('#pm-fecha').value || getISO();
      const socioSel = modal.querySelector('#pm-socio').value;

      // Totales por mezcla de IVAs
      const totals = tempItems.reduce((acc, it) => {
        const net = Number(it.p || 0) * (1 - (Number(it.d || 0))/100);
        const lineBase = (Number(it.q || 0) * net);
        const lineIVA  = lineBase * (Number(it.tax || 10) / 100);
        acc.base  += lineBase;
        acc.iva   += lineIVA;
        acc.total += lineBase + lineIVA;
        return acc;
      }, { base:0, iva:0, total:0 });

      const newAlb = {
        id: genId(),
        prov, proveedor: prov,
        num, numero: num,
        date: fecha, fecha,
        socio: (socioSel === 'Arume' || socioSel === 'Restaurante') ? 'Arume' : socioSel,
        items: tempItems,
        subtotal: round2(totals.base),
        taxes: round2(totals.iva),
        total: round2(totals.total),
        invoiced: false,
        notes: ""
      };

      db.albaranes = [...db.albaranes, newAlb];
      await saveFn(`Albarán ${num} guardado ✅`);
      updateLocalState();
      updateView();
      modal.classList.add('hidden');
    };

    function renderPreview() {
      const grid = modal.querySelector('#pm-grid');
      if (!tempItems.length) {
        grid.innerHTML = `<div class="text-center text-slate-400 py-6 italic text-sm">Nada para mostrar</div>`;
        return;
      }
      grid.innerHTML = tempItems.map((it, i) => {
        const net = Number(it.p || 0) * (1 - (Number(it.d || 0))/100);
        const line = Number(it.q || 0) * net * (1 + (Number(it.tax || 10))/100);
        const packBadge = it.conv > 1 ? `<span class="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-bold">PACK x${it.conv}</span>` : '';
        return `
          <div class="grid grid-cols-12 gap-2 items-center border-b py-2 text-xs">
            <div class="col-span-6 font-bold text-slate-700">${escapeHtml(it.n)} ${packBadge}</div>
            <div class="col-span-2 text-center font-mono">${fmt(it.q)} ${escapeHtml(it.unit)}</div>
            <div class="col-span-2 text-right font-mono">${fmt(it.p)}€</div>
            <div class="col-span-2 text-right font-mono">${fmt(line)}€</div>
          </div>`;
      }).join('');
    }
  }

  /* =============================================================
     ⛏️ Utilidades de cálculo/parse
     ============================================================= */
  function computeTotals(alb) {
    const t = { base: 0, iva: 0, total: 0 };
    if (alb?.items?.length) {
      alb.items.forEach(it => {
        const q = Number(it.q || 0);
        const p = Number(it.p || 0);
        const d = Number(it.d || 0);
        const tax = Number(it.tax ?? 10);
        const net = p * (1 - d/100);
        const base = q * net;
        t.base += base;
        t.iva  += base * (tax/100);
      });
      t.total = t.base + t.iva;
      return { base: round2(t.base), iva: round2(t.iva), total: round2(t.total) };
    }
    const total = Number(alb.total || 0);
    const base  = Number(alb.subtotal || (total / 1.10));
    const iva   = Number(alb.taxes || (total - base));
    return { base: round2(base), iva: round2(iva), total: round2(total) };
  }

  function detectLinePattern(line) {
    let clean = line.replace(/[€$£"]/g, '').replace(/\s{2,}/g, ' ').trim();
    const rawNumbers = clean.match(/(-?\d+(?:[.,]\d+)?)/g);
    if (!rawNumbers || rawNumbers.length < 1) return null;
    const nums = rawNumbers.map(n => parseNum(n));
    let q = 1, p = 0;
    if (nums.length >= 2) {
      q = nums[0];
      p = nums.length >= 3 ? nums[nums.length - 2] : nums[nums.length - 1];
    } else {
      q = nums[0];
    }
    // limpiar nombre
    let name = clean;
    [q, p].forEach(val => {
      if (val > 0) name = name.replace(new RegExp(`\\b${String(val).replace('.', '[.,]')}\\b`, 'g'), '');
    });
    // Detectar unidad física (dejamos “caja/pack” en el nombre)
    let unit = 'ud';
    const simpleUnits = /\b(kg|kilo|gr|g|l|litro|ml|cl|oz|lb)\b/i;
    const uMatch = name.match(simpleUnits);
    if (uMatch) {
      unit = UnitConverter.normalize(uMatch[0]);
      name = name.replace(uMatch[0], '');
    }
    // IVA explícito
    let t = null;
    const ivaMatch = clean.match(/\b(21|10|4|0)\s*%/);
    if (ivaMatch) t = Number(ivaMatch[1]);

    name = name.replace(/[^\w\sñÑáéíóúÁÉÍÓÚ%\-()]/g, '').trim();
    return { name, q, p, d: 0, t, unit };
  }

  function detectPackSize(name) {
    if (!name) return 1;
    const rex = /(\d+)\s*(?:x|pack|caja|bulto)\b/i; // 24x / pack 6 / caja 12
    const m = name.match(rex);
    if (m) return parseInt(m[1], 10) || 1;
    return 1;
  }

  function guessTax(name) {
    const n = String(name).toLowerCase();
    if (n.includes('vino') || n.includes('cerveza') || n.includes('licor') || n.includes('alcohol')) return 21;
    if (n.includes('refresco') || n.includes('coca') || n.includes('fanta') || n.includes('agua')) return 10;
    if (n.includes('pan') || n.includes('leche') || n.includes('huevo') || n.includes('harina') || n.includes('fruta') || n.includes('verdura')) return 4;
    return 10;
  }

  // ====== Export CSV de lo visible ======
  function exportFilteredToCSV(){
    const rows = [];
    rows.push(['Fecha','Proveedor','Ref','Socio','Base','IVA','Total','Notas','Facturado'].join(';'));
    // Obtiene IDs de cards visibles
    const nodes = listDiv.querySelectorAll(':scope > div');
    const idsVisible = [...nodes].filter(n => n.getAttribute('onclick'))
      .map(n => (n.getAttribute('onclick').match(/'([^']+)'/)||[])[1])
      .filter(Boolean);

    const set = new Set(idsVisible);
    const out = albaranes.filter(a => set.has(a.id));
    out.forEach(a => {
      const {base, iva, total} = computeTotals(a);
      rows.push([
        a.fecha || a.date || '',
        (a.proveedor || a.prov || '').replace(/;/g, ','),
        a.numero || a.num || '',
        (a.socio || 'Arume').replace(/;/g, ','),
        fmt(base).replace('.',','), 
        fmt(iva).replace('.',','), 
        fmt(total).replace('.',','), 
        (a.notes||'').replace(/[\r\n;]+/g,' ').trim(),
        a.invoiced ? 'PAGADO' : 'PENDIENTE'
      ].join(';'));
    });

    const blob = new Blob(["\uFEFF"+rows.join('\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Albaranes_${getISO()}.csv`;
    a.click();
  }

  function updateLocalState(){ albaranes = [...db.albaranes]; }

  // ====== Helpers ======
  function fmt(n){ const x = Number(n||0); return x.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function parseNum(s){ if (typeof s==='number') return s; const c = String(s).replace(/[^\d,.-]/g,'').replace(/,/g,'.'); return parseFloat(c)||0; }
  function round2(x){ return Math.round((Number(x)||0)*100)/100; }
  function normDate(s){
    if (!s) return getISO();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y] = s.split('/'); return `${y}-${m}-${d}`; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return getISO();
  }
  function getISO(){ return new Date().toLocaleDateString('en-CA'); }
  function escapeHtml(str){ return String(str||'').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function genId(){ return Math.random().toString(36).slice(2,11); }
}
