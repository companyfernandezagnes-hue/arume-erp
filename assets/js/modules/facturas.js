/* =============================================================
   📄 MÓDULO: FACTURAS v17.0 PRO-AUDIT (Con Realtime de Supabase)
   ============================================================= */

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

// Normalizador estricto para que "Makro" y "makro " hagan match
const norm = (s) => s ? String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
const fmt = (n) => Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2});
const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));

export async function render(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  if (!Array.isArray(db.facturas))  db.facturas  = [];

  // --- 🚀 LA MAGIA DEL REALTIME (Solo se suscribe una vez) ---
  if (!window.realtimeSubscribed) {
      supabase.channel('arume-data')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'arume_data' }, payload => {
            console.log('🔄 Cambio detectado desde n8n!', payload);
            // Actualizamos la base de datos local de la App
            window.db = payload.new.data; 
            // Forzamos que la pantalla se vuelva a pintar
            if (typeof window.renderCurrentView === 'function') {
                window.renderCurrentView(); 
            } else {
                window.location.reload();
            }
        })
        .subscribe();
      window.realtimeSubscribed = true;
  }

  let activeTab = 'pend';
  let mode = 'proveedor';
  let year = new Date().getFullYear();
  let searchQ = ''; 
  let filterStatus = 'all'; 

  // --- MOTOR DE AUDITORÍA IA ---
  const draftsIA = db.facturas.filter(f => f.status === 'draft').map(draft => {
      const mesDraft = draft.date.substring(0, 7); 
      const provDraft = norm(draft.prov);
      
      const albaranesCandidatos = db.albaranes.filter(a => 
          !a.invoiced && 
          norm(a.prov) === provDraft && 
          a.date.startsWith(mesDraft)
      );

      const sumaAlbaranes = albaranesCandidatos.reduce((acc, a) => acc + parseFloat(a.total || 0), 0);
      const diferencia = Math.abs(sumaAlbaranes - Math.abs(draft.total));
      const cuadraPerfecto = diferencia < 0.05 && albaranesCandidatos.length > 0;

      return {
          ...draft,
          candidatos: albaranesCandidatos,
          sumaAlbaranes,
          diferencia,
          cuadraPerfecto
      };
  });

  container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">

      ${draftsIA.length > 0 ? `
      <div class="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl border border-slate-800 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500"></div>
        <h3 class="text-white text-lg font-black flex items-center gap-2 mb-4">
            <span class="animate-bounce">🤖</span> Auditoría de Facturas Email <span class="bg-purple-600 text-xs px-2 py-0.5 rounded-full">${draftsIA.length}</span>
        </h3>
        
        <div class="space-y-4">
            ${draftsIA.map(d => `
            <div class="bg-slate-800/50 p-5 rounded-3xl border ${d.cuadraPerfecto ? 'border-emerald-500/50' : 'border-amber-500/50'}">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    
                    <div class="flex-1">
                        <p class="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">Leído en el PDF</p>
                        <h4 class="text-white font-black text-xl">${escapeHtml(d.prov)}</h4>
                        <p class="text-slate-400 text-xs font-mono">Ref: ${d.num} | Fecha: ${d.date}</p>
                        <p class="text-3xl font-black text-white mt-2">${fmt(Math.abs(d.total))}€</p>
                    </div>

                    <div class="flex-1 bg-slate-900 p-4 rounded-2xl w-full">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] text-slate-400 font-bold uppercase">Tus Albaranes (${d.candidatos.length})</span>
                            <span class="text-sm font-black text-white">${fmt(d.sumaAlbaranes)}€</span>
                        </div>
                        ${d.candidatos.length > 0 ? `
                            <div class="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                                ${d.candidatos.map(c => `
                                    <div class="flex justify-between text-[10px] text-slate-500 border-b border-slate-800 pb-1">
                                        <span>📅 ${c.date} - ${c.num}</span>
                                        <span class="text-slate-300 font-bold">${fmt(c.total)}€</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `<p class="text-rose-400 text-[10px] font-bold italic py-2">⚠️ No hay albaranes pendientes este mes.</p>`}
                    </div>
                </div>

                <div class="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-2 items-center justify-between">
                    <div>
                        ${d.cuadraPerfecto 
                          ? `<span class="bg-emerald-500/20 text-emerald-400 text-xs font-black px-3 py-1 rounded-lg">✅ CUADRA PERFECTO</span>`
                          : `<span class="bg-amber-500/20 text-amber-400 text-xs font-black px-3 py-1 rounded-lg">⚠️ DESCUADRE: ${fmt(d.diferencia)}€</span>`
                        }
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.confirmarAuditoriaIA('${d.id}')" class="${d.cuadraPerfecto ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'} text-white text-xs px-5 py-2.5 rounded-xl font-black shadow-lg transition active:scale-95">
                            ${d.cuadraPerfecto ? 'VINCULAR Y CERRAR MES' : 'CERRAR IGNORANDO DIFERENCIA'}
                        </button>
                        <button onclick="window.descartarDraftIA('${d.id}')" class="bg-slate-700 hover:bg-rose-500 text-white text-xs p-2.5 rounded-xl font-black transition" title="Eliminar borrador">🗑️</button>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>
      </div>
      ` : ''}

      <section class="p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
        
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-xl font-black text-slate-800 mb-1">Cierre de Facturas</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Control total y conciliación bancaria</p>
          </div>
          <div class="flex items-center gap-3">
            <button id="btnSyncIA" class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:shadow-lg hover:scale-105 transition flex items-center gap-2">
                <span>⚡</span> FORZAR LECTURA EMAILS
            </button>
            <div class="flex items-center gap-2 bg-slate-50 p-1 rounded-full border border-slate-200">
                <button id="btnModeProv" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Proveedores</button>
                <button id="btnModeSocio" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Socios</button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
          <button id="btnTabPend" class="flex-1 py-3 rounded-xl font-black text-xs transition">📦 ALBARANES SUELTOS</button>
          <button id="btnTabHist" class="flex-1 py-3 rounded-xl font-black text-xs transition">💰 FACTURAS CERRADAS</button>
        </div>

        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div class="flex items-center gap-3 bg-white border px-3 py-1 rounded-2xl shadow-sm w-full md:w-auto justify-center">
            <button id="btnYearPrev" class="text-indigo-600 font-bold p-1 hover:scale-110 transition">‹</button>
            <span id="lblYear" class="text-sm font-black text-slate-700 w-10 text-center">${year}</span>
            <button id="btnYearNext" class="text-indigo-600 font-bold p-1 hover:scale-110 transition">›</button>
          </div>
          
          <input type="text" id="inSearch" placeholder="🔍 Buscar proveedor o ref..." 
                 class="w-full md:w-96 p-2 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition shadow-inner">
        </div>

        <div id="filterChips" class="hidden flex flex-wrap gap-2 mb-6">
            <button data-filter="all" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-indigo-600 text-white border-indigo-600">Todas</button>
            <button data-filter="pending" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-white text-slate-500 border-slate-200 hover:bg-slate-50">⏳ Pendientes</button>
            <button data-filter="paid" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-white text-emerald-600 border-slate-200 hover:bg-emerald-50">✔️ Pagadas Efectivo</button>
            <button data-filter="reconciled" class="filter-chip px-3 py-1 rounded-full text-[10px] font-bold border transition-all bg-white text-blue-600 border-slate-200 hover:bg-blue-50">🔗 Pagadas Banco</button>
        </div>

        <div id="contentArea" class="space-y-4"></div>
      </section>
    </div>
    
    <div id="modalAuditoria" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4 transition-all"></div>
  `;

  const contentArea = container.querySelector("#contentArea");
  const btnTabPend  = container.querySelector("#btnTabPend");
  const btnTabHist  = container.querySelector("#btnTabHist");
  const btnModeProv = container.querySelector("#btnModeProv");
  const btnModeSoc  = container.querySelector("#btnModeSocio");
  const inSearch    = container.querySelector("#inSearch");
  const filterChipsContainer = container.querySelector("#filterChips");

  container.querySelector("#btnSyncIA").onclick = async (e) => {
      const btn = e.target.closest('button');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<span class="animate-spin">⏳</span> LEYENDO...`;
      btn.disabled = true;
      try {
          const webhookN8N = "https://ia.permatunnelopen.org/webhook/forzar-facturas";
          await fetch(webhookN8N, { method: "POST" });
          // No hace falta alert, el Realtime actualizará la pantalla solo
      } catch (err) {
          alert("Error conectando con la IA. ¿Está el túnel activo?");
      } finally {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
      }
  };

  container.querySelector("#btnYearPrev").onclick = () => { year--; rerender(); };
  container.querySelector("#btnYearNext").onclick = () => { year++; rerender(); };
  btnTabPend.onclick = () => { activeTab = 'pend'; filterStatus='all'; inSearch.value=''; searchQ=''; rerender(); };
  btnTabHist.onclick = () => { activeTab = 'hist'; inSearch.value=''; searchQ=''; rerender(); };
  btnModeProv.onclick = () => { mode = 'proveedor'; rerender(); };
  btnModeSoc.onclick  = () => { mode = 'socio'; rerender(); };

  let timeoutId;
  inSearch.addEventListener('input', (e) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { searchQ = norm(e.target.value); rerender(); }, 300);
  });

  container.querySelectorAll('.filter-chip').forEach(btn => {
      btn.onclick = (e) => { filterStatus = e.target.dataset.filter; rerender(); };
  });

  function rerender() {
    container.querySelector("#lblYear").innerText = year;
    
    btnTabPend.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='pend' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`;
    btnTabHist.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='hist' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`;
    btnModeProv.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='proveedor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`;
    btnModeSoc.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='socio' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`;

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
    } else { filterChipsContainer.classList.add('hidden'); }

    if (activeTab === 'pend') renderPendientes();
    else renderHistorial();
  }

  // --- FUNCIONES IA ---
  window.confirmarAuditoriaIA = async (draftId) => {
      const draft = db.facturas.find(f => f.id === draftId);
      const audit = draftsIA.find(d => d.id === draftId);
      if (!draft || !audit) return;

      if (audit.candidatos.length > 0) {
          const idsVincular = audit.candidatos.map(a => a.id);
          db.albaranes.forEach(a => { if (idsVincular.includes(a.id)) a.invoiced = true; });
          draft.albaranIdsArr = idsVincular;
          draft.albaranIds = idsVincular.join(',');
      }

      draft.status = 'approved';
      await saveFn(`Mes cerrado para ${draft.prov} ✅`);
      rerender();
  };

  window.descartarDraftIA = async (id) => {
      if (!confirm("¿Eliminar factura leída por IA?")) return;
      db.facturas = db.facturas.filter(f => f.id !== id);
      await saveFn("Factura IA eliminada 🗑️");
      rerender();
  };

  // --- RENDER PENDIENTES ---
  function renderPendientes() {
    const albs = db.albaranes.filter(a => {
        if (a.invoiced || !isInYear(a.date, year)) return false;
        if (searchQ) {
            const owner = norm(mode === 'proveedor' ? a.prov : a.socio);
            if (!owner.includes(searchQ) && !norm(a.num).includes(searchQ)) return false;
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
        contentArea.innerHTML = `<div class="py-20 flex flex-col items-center justify-center opacity-50"><span class="text-4xl mb-3">📦</span><p class="text-slate-500 font-bold text-sm">No hay albaranes sueltos.</p></div>`;
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
                <p class="text-[9px] font-bold text-indigo-400 group-hover:underline mt-1">CERRAR MANUAL ➔</p>
                </div>
            </div>
            `).join('')}
        </div>
      </div>
    `).join('');
  }

  // --- RENDER HISTORIAL ---
  function renderHistorial() {
    const list = db.facturas.filter(f => {
        if (f.status === 'draft') return false; 
        if (!isInYear(f.date, year)) return false;
        
        if (filterStatus === 'pending' && f.paid) return false;
        if (filterStatus === 'paid' && !f.paid) return false;
        if (filterStatus === 'reconciled' && !f.reconciled) return false;

        if (searchQ) {
            const owner = norm(f.prov || f.cliente);
            if (!owner.includes(searchQ) && !norm(f.num).includes(searchQ)) return false;
        }
        return true;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(!list.length) {
        contentArea.innerHTML = `<div class="py-20 flex flex-col items-center justify-center opacity-50"><span class="text-4xl mb-3">🗄️</span><p class="text-slate-500 font-bold text-sm">No hay facturas cerradas.</p></div>`;
        return;
    }

    contentArea.innerHTML = `
      <div class="space-y-3">
        ${list.map(f => {
            const isIA = f.source === 'email-ia';
            return `
          <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition">
            <div class="flex-1 cursor-pointer" onclick="window.verFacturaDetalle('${f.id}')">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                 <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">${f.date}</span>
                 
                 ${isIA 
                   ? `<span class="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">🤖 AUDITADA IA</span>` 
                   : `<span class="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">📦 CERRADA MANUAL</span>`
                 }

                 ${f.reconciled 
                   ? `<span class="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">🔗 BANCO OK</span>` 
                   : `<span class="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">ESPERANDO BANCO</span>`
                 }
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
                    ${f.paid ? '✔️ CASH OK' : '⏳ PENDIENTE'}
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

  // --- MODAL AGRUPACIÓN MANUAL ---
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
            <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Cierre de mes manual</p>
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
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Suma Seleccionada</span>
                <span id="modalTotalFinal" class="text-3xl font-black text-emerald-400">${fmt(totalGroup)}€</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Nº Factura Oficial</label>
                    <input type="text" id="inNumFactura" placeholder="Ej: F-2026/012" class="w-full p-4 bg-white border-2 border-indigo-100 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition shadow-sm">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Fecha Emisión</label>
                    <input type="date" id="inDateFactura" value="${new Date().toISOString().split('T')[0]}" class="w-full p-4 bg-white border-2 border-indigo-100 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition shadow-sm">
                </div>
            </div>

            <button onclick="window.confirmarCreacionFactura('${label}')" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 active:scale-95 transition">
                GUARDAR FACTURA OFICIAL
            </button>
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('inNumFactura').focus(), 100);
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

      const existe = db.facturas.some(f => 
          f.status !== 'draft' && 
          norm(f.num) === norm(numFactura) && 
          norm(f.prov || f.cliente) === norm(ownerLabel)
      );
      if (existe) return alert(`⚠️ Ya existe una factura con el número "${numFactura}" para este proveedor.`);

      const selectedIds = [];
      let totalFactura = 0;
      document.querySelectorAll('.alb-checkbox:checked').forEach(cb => {
          selectedIds.push(cb.value);
          totalFactura += parseFloat(cb.dataset.total || 0);
      });

      if (selectedIds.length === 0) return alert("Debes seleccionar al menos un albarán.");

      db.albaranes.forEach(a => { if (selectedIds.includes(a.id)) a.invoiced = true; });

      db.facturas.push({
          id: 'fac-' + Date.now() + Math.random().toString(36).slice(2,5),
          num: numFactura,
          date: dateFactura,
          prov: mode === 'proveedor' ? ownerLabel : 'Varios',
          cliente: mode === 'socio' ? ownerLabel : 'Arume',
          total: Math.abs(Math.round(totalFactura * 100) / 100),
          albaranIdsArr: selectedIds,
          paid: false,
          reconciled: false,
          source: 'manual-group',
          status: 'approved' 
      });

      await saveFn("Factura guardada ✅");
      rerender();
  };

  // --- DETALLES Y BORRADO ---
  window.verFacturaDetalle = (facId) => {
      const fac = db.facturas.find(f => f.id === facId);
      if(!fac) return;

      const ids = fac.albaranIdsArr || [];
      const albaranes = db.albaranes.filter(a => ids.includes(a.id));

      const modal = container.querySelector("#modalAuditoria");
      modal.classList.remove("hidden");
      
      modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
          <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl z-10">✕</button>
          
          <h3 class="text-xl font-black text-slate-800">${escapeHtml(fac.prov || fac.cliente)}</h3>
          <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1 mb-6">Factura: ${fac.num}</p>

          <div class="space-y-2 mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            ${albaranes.length > 0 
                ? `<p class="text-[10px] font-black text-slate-400 uppercase mb-2">Albaranes Incluidos (${albaranes.length}):</p>
                   ${albaranes.map(a => `
                     <div class="flex justify-between text-xs border-b border-slate-100 py-1 text-slate-600 font-bold">
                       <span>${formatearFechaISO(a.date)}</span>
                       <span>${fmt(a.total)}€</span>
                     </div>
                   `).join('')}`
                : `<p class="text-xs text-slate-400 italic">No hay albaranes vinculados. Es un gasto directo.</p>`
            }
          </div>

          <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span class="text-xs font-black text-slate-500 uppercase">Total Factura</span>
              <span class="text-2xl font-black text-slate-900">${fmt(Math.abs(fac.total))}€</span>
          </div>
        </div>
      `;
  };

  window.borrarFactura = async (facId) => {
      const fac = db.facturas.find(f => f.id === facId);
      if(!fac) return;

      if(fac.reconciled) return alert("⚠️ No puedes borrar una factura que ya ha pasado por el Banco.");
      if(!confirm(`¿Borrar la factura ${fac.num} y liberar sus albaranes?`)) return;

      const ids = fac.albaranIdsArr || [];
      db.albaranes.forEach(a => { if (ids.includes(a.id)) a.invoiced = false; });
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

  rerender(); 
}
