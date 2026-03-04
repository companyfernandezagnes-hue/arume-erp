/* =============================================================
   📄 MÓDULO: FACTURAS v16.0 PRO (Bandeja IA, Anti-Dup, Checkboxes y Totales Positivos)
   ============================================================= */

// --- 🛠️ HELPERS ---
const formatearFechaISO = (fechaRaw) => {
    if (!fechaRaw) return new Date().toISOString().split('T')[0];
    const s = String(fechaRaw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) {
        let [d, m, y] = s.split(/[\/\-]/);
        if (y.length === 2) y = '20' + y;
        return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch(e) {}
    return new Date().toISOString().split('T')[0];
};

// Normalizador para el buscador y anti-duplicados
const norm = (s) => s ? String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
const fmt = (n) => Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2});
const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));

export async function render(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  if (!Array.isArray(db.facturas))  db.facturas  = [];

  let activeTab = 'pend';
  let mode = 'proveedor';
  let year = new Date().getFullYear();
  let searchQ = ''; 
  let filterStatus = 'all'; 

  container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
      
      <div id="bandejaIA" class="hidden"></div>

      <section class="p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
        
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-xl font-black text-slate-800 mb-1">Cierre de Facturas</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Control total y conciliación bancaria</p>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-1 rounded-full border border-slate-200">
            <button id="btnModeProv" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Proveedores</button>
            <button id="btnModeSocio" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Socios</button>
          </div>
        </div>

        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
          <button id="btnTabPend" class="flex-1 py-3 rounded-xl font-black text-xs transition">📦 ALBARANES PENDIENTES</button>
          <button id="btnTabHist" class="flex-1 py-3 rounded-xl font-black text-xs transition">💰 FACTURAS CERRADAS</button>
        </div>

        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div class="flex items-center gap-3 bg-white border px-3 py-1 rounded-2xl shadow-sm w-full md:w-auto justify-center">
            <button id="btnYearPrev" class="text-indigo-600 font-bold p-1 hover:scale-110 transition">‹</button>
            <span id="lblYear" class="text-sm font-black text-slate-700 w-10 text-center">${year}</span>
            <button id="btnYearNext" class="text-indigo-600 font-bold p-1 hover:scale-110 transition">›</button>
          </div>
          
          <input type="text" id="inSearch" placeholder="🔍 Buscar proveedor, socio o nº de factura..." 
                 class="w-full md:w-96 p-2 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition shadow-inner">
        </div>

        <div id="filterChips" class="hidden flex flex-wrap gap-2 mb-6">
            <button data-filter="all" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-indigo-600 text-white border-indigo-600">Todas</button>
            <button data-filter="pending" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-white text-slate-500 border-slate-200 hover:bg-slate-50">⏳ Pendientes</button>
            <button data-filter="paid" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-white text-emerald-600 border-slate-200 hover:bg-emerald-50">✔️ Pagadas</button>
            <button data-filter="reconciled" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-white text-blue-600 border-slate-200 hover:bg-blue-50">🔗 Banco OK</button>
        </div>

        <div id="contentArea" class="space-y-4"></div>
      </section>
    </div>
    
    <div id="modalAuditoria" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4 transition-all"></div>
  `;

  const contentArea = container.querySelector("#contentArea");
  const bandejaIA = container.querySelector("#bandejaIA");
  const btnTabPend  = container.querySelector("#btnTabPend");
  const btnTabHist  = container.querySelector("#btnTabHist");
  const btnModeProv = container.querySelector("#btnModeProv");
  const btnModeSoc  = container.querySelector("#btnModeSocio");
  const inSearch    = container.querySelector("#inSearch");
  const filterChipsContainer = container.querySelector("#filterChips");

  // Event Listeners
  container.querySelector("#btnYearPrev").onclick = () => { year--; rerender(); };
  container.querySelector("#btnYearNext").onclick = () => { year++; rerender(); };
  btnTabPend.onclick = () => { activeTab = 'pend'; filterStatus='all'; inSearch.value=''; searchQ=''; rerender(); };
  btnTabHist.onclick = () => { activeTab = 'hist'; inSearch.value=''; searchQ=''; rerender(); };
  btnModeProv.onclick = () => { mode = 'proveedor'; rerender(); };
  btnModeSoc.onclick  = () => { mode = 'socio'; rerender(); };

  // Buscador con debounce
  let timeoutId;
  inSearch.addEventListener('input', (e) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { searchQ = norm(e.target.value); rerender(); }, 300);
  });

  // Filtros Chips
  container.querySelectorAll('.filter-chip').forEach(btn => {
      btn.onclick = (e) => { filterStatus = e.target.dataset.filter; rerender(); };
  });

  // --- MOTOR PRINCIPAL RENDER ---
  function rerender() {
    container.querySelector("#lblYear").innerText = year;
    
    // UI Tabs
    btnTabPend.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='pend' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`;
    btnTabHist.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='hist' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`;
    btnModeProv.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='proveedor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`;
    btnModeSoc.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='socio' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`;

    // Mostrar/Ocultar Chips
    if(activeTab === 'hist') {
        filterChipsContainer.classList.remove('hidden');
        filterChipsContainer.querySelectorAll('.filter-chip').forEach(c => {
            if(c.dataset.filter === filterStatus) {
                c.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600');
                c.classList.remove('bg-white', 'text-slate-500', 'text-emerald-600', 'text-blue-600');
            } else {
                c.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600');
                c.classList.add('bg-white');
                if(c.dataset.filter === 'paid') c.classList.add('text-emerald-600');
                else if(c.dataset.filter === 'reconciled') c.classList.add('text-blue-600');
                else c.classList.add('text-slate-500');
            }
        });
    } else {
        filterChipsContainer.classList.add('hidden');
    }

    renderBandejaIA();
    if (activeTab === 'pend') renderPendientes();
    else renderHistorial();
  }

  // --- RENDER BANDEJA IA ---
  function renderBandejaIA() {
      const drafts = db.facturas.filter(f => f.status === 'draft');
      if (drafts.length === 0) {
          bandejaIA.classList.add('hidden');
          bandejaIA.innerHTML = '';
          return;
      }

      bandejaIA.classList.remove('hidden');
      bandejaIA.innerHTML = `
        <div class="bg-purple-50 p-6 rounded-[2.5rem] border border-purple-200 shadow-sm animate-pulse-slow">
            <h3 class="text-lg font-black text-purple-900 flex items-center gap-2 mb-2">
                🤖 Bandeja de Entrada IA <span class="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">${drafts.length}</span>
            </h3>
            <p class="text-xs text-purple-700 mb-4 font-bold">Estas facturas han llegado por email y necesitan tu aprobación.</p>
            <div class="space-y-3">
                ${drafts.map(d => `
                <div class="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-purple-100 gap-4">
                    <div class="w-full md:w-auto">
                        <p class="font-black text-slate-800">${escapeHtml(d.prov || d.cliente)}</p>
                        <p class="text-[10px] text-slate-500 font-mono">📅 ${d.date} | 🏷️ Ref: ${d.num}</p>
                    </div>
                    <div class="flex items-center justify-between w-full md:w-auto gap-6">
                        <p class="text-xl font-black text-purple-900">${fmt(Math.abs(d.total))}€</p>
                        <div class="flex gap-2">
                            <button onclick="window.aprobarDraftIA('${d.id}')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] px-4 py-2 rounded-xl font-black transition shadow-sm">✔️ APROBAR</button>
                            <button onclick="window.descartarDraftIA('${d.id}')" class="bg-rose-100 hover:bg-rose-200 text-rose-600 text-[10px] px-3 py-2 rounded-xl font-bold transition">🗑️</button>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
      `;
  }

  // --- RENDER PENDIENTES (Albaranes Sueltos) ---
  function renderPendientes() {
    const albs = db.albaranes.filter(a => {
        if (a.invoiced || !isInYear(a.date, year)) return false;
        if (searchQ) {
            const owner = norm(mode === 'proveedor' ? a.prov : a.socio);
            const num = norm(a.num);
            if (!owner.includes(searchQ) && !num.includes(searchQ)) return false;
        }
        return true;
    });

    const byMonth = {};
    albs.forEach(a => {
      const mk = keyMonth(a.date);
      if (!mk) return;
      if (!byMonth[mk]) byMonth[mk] = { name: nameMonthKey(mk), groups: {} };

      let rawOwner = (mode === 'proveedor') ? (a.prov || 'Sin Proveedor') : (a.socio || 'Arume');
      let ownerKey = String(rawOwner).trim().toUpperCase();
      
      const g = byMonth[mk].groups;
      if (!g[ownerKey]) g[ownerKey] = { label: rawOwner, t: 0, ids: [], count: 0 };
      
      g[ownerKey].t += (parseFloat(a.total) || 0);
      g[ownerKey].count += 1;
      g[ownerKey].ids.push(a.id);
    });

    const keys = Object.keys(byMonth).sort().reverse(); 
    if (!keys.length) {
        contentArea.innerHTML = `<div class="py-20 flex flex-col items-center justify-center opacity-50"><span class="text-4xl mb-3">📦</span><p class="text-slate-500 font-bold text-sm">Todo agrupado al día.</p></div>`;
        return;
    }

    contentArea.innerHTML = keys.map(k => `
      <div class="mb-8 animate-fade-in">
        <h3 class="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 px-2 border-b border-indigo-100 pb-2">${byMonth[k].name}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${Object.values(byMonth[k].groups).map(g => `
            <div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition cursor-pointer group"
                 onclick="window.abrirModalAgrupacion('${escapeHtml(g.label)}', '${g.ids.join(',')}')">
                <div>
                <p class="font-black text-slate-800 group-hover:text-indigo-600 transition">${escapeHtml(g.label)}</p>
                <span class="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase">${g.count} Albaranes</span>
                </div>
                <div class="text-right">
                <p class="font-black text-slate-900 text-lg">${fmt(g.t)}€</p>
                <p class="text-[9px] font-bold text-indigo-400 group-hover:underline mt-1">AGRUPAR ➔</p>
                </div>
            </div>
            `).join('')}
        </div>
      </div>
    `).join('');
  }

  // --- RENDER HISTORIAL (Facturas Aprobadas) ---
  function renderHistorial() {
    const list = db.facturas.filter(f => {
        if (f.status === 'draft') return false; // OCULTAR BORRADORES AQUÍ
        if (!isInYear(f.date, year)) return false;
        
        if (filterStatus === 'pending' && f.paid) return false;
        if (filterStatus === 'paid' && !f.paid) return false;
        if (filterStatus === 'reconciled' && !f.reconciled) return false;

        if (searchQ) {
            const owner = norm(f.prov || f.cliente);
            const num = norm(f.num);
            if (!owner.includes(searchQ) && !num.includes(searchQ)) return false;
        }
        return true;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(!list.length) {
        contentArea.innerHTML = `<div class="py-20 flex flex-col items-center justify-center opacity-50"><span class="text-4xl mb-3">🗄️</span><p class="text-slate-500 font-bold text-sm">No hay facturas en esta vista.</p></div>`;
        return;
    }

    contentArea.innerHTML = `
      <div class="space-y-3">
        ${list.map(f => {
            // Distinguir origen para la etiqueta
            const isIA = f.source === 'email-ia' || (!f.albaranIds && !f.albaranIdsArr?.length);
            
            return `
          <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition">
            <div class="flex-1 cursor-pointer" onclick="window.verFacturaDetalle('${f.id}')">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                 <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">${f.date}</span>
                 
                 ${isIA 
                   ? `<span class="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">🤖 EMAIL IA</span>` 
                   : `<span class="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">📦 AGRUPADA</span>`
                 }

                 ${f.reconciled ? `<span class="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">🔗 BANCO OK</span>` : `<span class="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">ESPERANDO BANCO</span>`}
              </div>
              <p class="font-black text-slate-800 text-base">${escapeHtml(f.prov || f.cliente || '—')}</p>
              <p class="text-xs text-indigo-500 font-bold">Nº: ${f.num}</p>
            </div>
            
            <div class="flex items-center justify-between md:justify-end gap-6 md:w-auto w-full border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
              <div class="text-left md:text-right">
                <p class="font-black text-slate-900 text-xl">${fmt(Math.abs(f.total))}€</p>
              </div>
              <div class="flex gap-2">
                  <button onclick="window.togglePago('${f.id}')" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${f.paid ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}">
                    ${f.paid ? '✔️ PAGADA' : '⏳ PENDIENTE'}
                  </button>
                  <button onclick="window.borrarFactura('${f.id}')" class="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition shadow-sm" title="Eliminar">
                      🗑️
                  </button>
              </div>
            </div>
          </div>
        `}).join('')}
      </div>`;
  }

  // --- LÓGICA BANDEJA IA ---
  window.aprobarDraftIA = async (id) => {
      const fac = db.facturas.find(f => f.id === id);
      if (!fac) return;

      // Check anti-duplicado contra facturas ya oficiales
      const existe = db.facturas.some(f2 => 
          f2.id !== id && 
          f2.status !== 'draft' && 
          norm(f2.num) === norm(fac.num) && 
          norm(f2.prov || f2.cliente) === norm(fac.prov || fac.cliente)
      );

      if (existe) {
          if (!confirm(`⚠️ ALERTA DUPLICADO: Ya existe una factura oficial ${fac.num} de este proveedor. ¿Estás segura de aprobarla de todos modos?`)) return;
      }

      fac.status = 'approved'; // Magia: la convertimos en oficial
      fac.source = 'email-ia';
      
      await saveFn(`Factura ${fac.num} aprobada ✅`);
      rerender();
  };

  window.descartarDraftIA = async (id) => {
      if (!confirm("¿Descartar esta factura detectada por IA? (No se guardará en contabilidad)")) return;
      db.facturas = db.facturas.filter(f => f.id !== id);
      await saveFn("Borrador IA descartado 🗑️");
      rerender();
  };

  // --- MODAL DE CREACIÓN CON CHECKBOXES ---
  window.abrirModalAgrupacion = (label, idsString) => {
    const ids = idsString.split(',');
    const albaranes = db.albaranes.filter(a => ids.includes(a.id)).sort((a,b) => new Date(a.date) - new Date(b.date));
    const totalGroup = albaranes.reduce((t,x)=>t+parseFloat(x.total||0),0);
    
    const modal = container.querySelector("#modalAuditoria");
    modal.classList.remove("hidden");
    
    modal.innerHTML = `
      <div class="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
        <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl z-10 transition">✕</button>
        
        <div class="border-b border-slate-100 pb-4 mb-4">
            <h3 class="text-2xl font-black text-slate-800">${label}</h3>
            <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Selecciona los albaranes a facturar</p>
        </div>
        
        <div class="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar bg-slate-50 rounded-2xl p-4 border border-slate-100 inset-shadow">
          ${albaranes.map(a => `
            <label class="flex justify-between items-center py-3 border-b border-slate-200 last:border-0 cursor-pointer hover:bg-slate-100 px-2 rounded-xl transition">
              <div class="flex items-center gap-3">
                <input type="checkbox" checked value="${a.id}" data-total="${a.total}" class="alb-checkbox w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" onchange="window.recalcModal()">
                <div>
                    <p class="font-bold text-slate-700 text-sm">${formatearFechaISO(a.date)}</p>
                    <p class="text-[9px] font-mono text-slate-400">Ref: ${a.num || 'S/N'}</p>
                </div>
              </div>
              <p class="font-black text-slate-900">${fmt(a.total)}€</p>
            </label>
          `).join('')}
        </div>
        
        <div class="mt-6 space-y-4">
            <div class="flex items-center justify-between bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Total Seleccionado</span>
                <span id="modalTotalFinal" class="text-3xl font-black text-emerald-400">${fmt(totalGroup)}€</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Nº de Factura Oficial</label>
                    <input type="text" id="inNumFactura" placeholder="Ej: F-2026/012" class="w-full p-4 bg-white border-2 border-indigo-100 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition shadow-sm">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Fecha de Emisión</label>
                    <input type="date" id="inDateFactura" value="${new Date().toISOString().split('T')[0]}" class="w-full p-4 bg-white border-2 border-indigo-100 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition shadow-sm">
                </div>
            </div>

            <button onclick="window.confirmarCreacionFactura('${label}')" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 transition flex justify-center items-center gap-2">
                <span>📑</span> GENERAR FACTURA
            </button>
        </div>
      </div>
    `;

    setTimeout(() => document.getElementById('inNumFactura').focus(), 100);
    document.getElementById('inNumFactura').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') window.confirmarCreacionFactura(label);
    });
  };

  window.recalcModal = () => {
      let sum = 0;
      document.querySelectorAll('.alb-checkbox:checked').forEach(cb => sum += parseFloat(cb.dataset.total || 0));
      document.getElementById('modalTotalFinal').innerText = fmt(sum) + '€';
  };

  window.confirmarCreacionFactura = async (ownerLabel) => {
      const numFactura = document.getElementById("inNumFactura").value.trim();
      const dateFactura = document.getElementById("inDateFactura").value;

      if(!numFactura) return alert("Por favor, introduce el número de factura oficial.");

      // Check anti-duplicados
      const existe = db.facturas.some(f => 
          f.status !== 'draft' && 
          norm(f.num) === norm(numFactura) && 
          norm(f.prov || f.cliente) === norm(ownerLabel)
      );
      
      if (existe) {
          alert(`⚠️ ¡CUIDADO! Ya existe una factura con el número "${numFactura}" para este proveedor.`);
          return;
      }

      const selectedIds = [];
      let totalFactura = 0;
      document.querySelectorAll('.alb-checkbox:checked').forEach(cb => {
          selectedIds.push(cb.value);
          totalFactura += parseFloat(cb.dataset.total || 0);
      });

      if (selectedIds.length === 0) return alert("Debes seleccionar al menos un albarán.");

      // Marcar albaranes como facturados
      db.albaranes.forEach(a => { if (selectedIds.includes(a.id)) a.invoiced = true; });

      db.facturas.push({
          id: 'fac-' + Date.now() + Math.random().toString(36).slice(2,5),
          num: numFactura,
          date: dateFactura,
          prov: mode === 'proveedor' ? ownerLabel : 'Varios',
          cliente: mode === 'socio' ? ownerLabel : 'Arume',
          total: Math.abs(Math.round(totalFactura * 100) / 100), // Siempre en positivo
          albaranIds: selectedIds.join(','),
          albaranIdsArr: selectedIds, // Formato limpio
          paid: false,
          reconciled: false,
          source: 'manual-group',
          status: 'approved'
      });

      await saveFn("Factura agrupada correctamente ✅");
      document.getElementById('modalAuditoria').classList.add('hidden');
      rerender();
  };

  // --- VER DETALLES DE FACTURA Y CTA BANCO ---
  window.verFacturaDetalle = (facId) => {
      const fac = db.facturas.find(f => f.id === facId);
      if(!fac) return;

      const isIA = fac.source === 'email-ia' || (!fac.albaranIds && !fac.albaranIdsArr?.length);
      const ids = (fac.albaranIds || '').split(',').filter(Boolean);
      const albaranes = db.albaranes.filter(a => ids.includes(a.id));

      const modal = container.querySelector("#modalAuditoria");
      modal.classList.remove("hidden");
      
      modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
          <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl z-10 transition">✕</button>
          
          <h3 class="text-xl font-black text-slate-800">${escapeHtml(fac.prov || fac.cliente)}</h3>
          <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1 mb-6">Factura: ${fac.num}</p>

          <div class="space-y-2 mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            ${isIA 
              ? `<div class="p-4 bg-purple-50 rounded-xl border border-purple-100 text-center">
                   <span class="text-3xl mb-2 block">🤖</span>
                   <p class="text-xs font-bold text-purple-700">Esta factura se procesó automáticamente<br>vía Email con IA.</p>
                 </div>`
              : `<p class="text-[10px] font-black text-slate-400 uppercase mb-2">Albaranes Incluidos:</p>
                 ${albaranes.map(a => `
                   <div class="flex justify-between text-xs border-b border-slate-100 py-1 text-slate-600 font-bold">
                     <span>${formatearFechaISO(a.date)}</span>
                     <span>${fmt(a.total)}€</span>
                   </div>
                 `).join('')}`
            }
          </div>

          <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span class="text-xs font-black text-slate-500 uppercase">Total Factura</span>
              <span class="text-2xl font-black text-slate-900">${fmt(Math.abs(fac.total))}€</span>
          </div>

          <div class="mt-4 flex gap-2">
              <button onclick="window.irABancoPorImporte(${Math.abs(fac.total)})" 
                  class="w-full bg-sky-50 text-sky-700 border border-sky-200 py-3 rounded-xl text-xs font-black hover:bg-sky-100 transition shadow-sm">
                  🏦 Buscar en Banco por importe
              </button>
          </div>

        </div>
      `;
  };

  // Acción para el nuevo botón CTA
  window.irABancoPorImporte = (importe) => {
      // Sustituye este alert por tu sistema de navegación (ej: hash router)
      alert(`Función en desarrollo: Te llevará a la pestaña del Banco filtrando por ${importe}€.`);
  };

  window.borrarFactura = async (facId) => {
      const fac = db.facturas.find(f => f.id === facId);
      if(!fac) return;

      if(fac.reconciled) {
          alert("⚠️ Esta factura ya ha sido conciliada con el banco. Bórrala primero desde el módulo Banco si quieres eliminarla.");
          return;
      }

      if(!confirm(`¿Seguro que quieres borrar la factura ${fac.num}?`)) return;

      const ids = (fac.albaranIds || '').split(',');
      db.albaranes.forEach(a => {
          if (ids.includes(a.id)) a.invoiced = false;
      });

      db.facturas = db.facturas.filter(f => f.id !== facId);
      
      await saveFn("Factura eliminada 🗑️");
      rerender();
  };

  window.togglePago = async (id) => {
    const f = db.facturas.find(x => x.id === id);
    if (f) { f.paid = !f.paid; await saveFn(`Estado de pago actualizado`); rerender(); }
  };

  function isInYear(d, y) { return formatearFechaISO(d).startsWith(y.toString()); }
  function keyMonth(d) { return formatearFechaISO(d).substring(0, 7); }
  function nameMonthKey(k) { 
      const [y, m] = k.split('-');
      const names = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]; 
      return `${names[parseInt(m)]} ${y}`; 
  }

  rerender(); // Inicializar vista
}
