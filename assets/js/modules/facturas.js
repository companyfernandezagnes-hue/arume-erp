/* =============================================================
   📄 MÓDULO: FACTURAS PRO+ (Con Trazabilidad y Auditoría)
   ============================================================= */
export async function render(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  if (!Array.isArray(db.facturas))  db.facturas  = [];

  let activeTab = 'pend';
  let mode = 'proveedor';
  let year = new Date().getFullYear();

  // 1. ESTRUCTURA BASE
  container.innerHTML = `
    <div class="animate-fade-in space-y-6">
      <section class="p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-xl font-black text-slate-800 mb-1">Centro de Facturación</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Revisión y Trazabilidad</p>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-1 rounded-full border">
            <button id="btnModeProv" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Proveedor</button>
            <button id="btnModeSocio" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Socio</button>
          </div>
        </div>

        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
          <button id="btnTabPend" class="flex-1 py-3 rounded-xl font-black text-xs transition">📦 PENDIENTES</button>
          <button id="btnTabHist" class="flex-1 py-3 rounded-xl font-black text-xs transition">💰 HISTORIAL</button>
        </div>

        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3 bg-white border px-3 py-1 rounded-2xl shadow-sm">
            <button id="btnYearPrev" class="text-indigo-600 font-bold p-1">‹</button>
            <span id="lblYear" class="text-sm font-black text-slate-700 w-10 text-center">${year}</span>
            <button id="btnYearNext" class="text-indigo-600 font-bold p-1">›</button>
          </div>
          <button id="btnSEPA" class="px-4 py-2 rounded-2xl text-[10px] font-black border bg-white uppercase">🏦 SEPA (XML)</button>
        </div>

        <div id="contentArea" class="space-y-4"></div>
      </section>
    </div>
    <div id="modalAuditoria" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4"></div>
  `;

  const contentArea = container.querySelector("#contentArea");
  const btnTabPend  = container.querySelector("#btnTabPend");
  const btnTabHist  = container.querySelector("#btnTabHist");
  const btnModeProv = container.querySelector("#btnModeProv");
  const btnModeSoc  = container.querySelector("#btnModeSocio");

  // Navegación
  container.querySelector("#btnYearPrev").onclick = () => { year--; rerender(); };
  container.querySelector("#btnYearNext").onclick = () => { year++; rerender(); };
  btnTabPend.onclick = () => { activeTab = 'pend'; rerender(); };
  btnTabHist.onclick = () => { activeTab = 'hist'; rerender(); };
  btnModeProv.onclick = () => { mode = 'proveedor'; rerender(); };
  btnModeSoc.onclick  = () => { mode = 'socio'; rerender(); };

  function rerender() {
    container.querySelector("#lblYear").innerText = year;
    btnTabPend.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='pend' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`;
    btnTabHist.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='hist' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`;
    btnModeProv.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='proveedor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`;
    btnModeSoc.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='socio' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`;

    if (activeTab === 'pend') renderPendientes();
    else renderHistorial();
  }

  rerender();

  /* =============================================================
     1) VISTA: ALBARANES PENDIENTES
     ============================================================= */
  function renderPendientes() {
    const albs = (db.albaranes || []).filter(a => !a.invoiced && isInYear(a.fecha || a.date, year));
    const byMonth = {};

    albs.forEach(a => {
      const mk = keyMonth(a.fecha || a.date);
      if (!mk) return;
      if (!byMonth[mk]) byMonth[mk] = { name: nameMonthKey(mk), groups: {} };

      const owner = (mode === 'proveedor') ? (a.proveedor || a.prov || 'S/N') : ((a.socio && a.socio !== 'Restaurante') ? a.socio : 'Arume');

      const g = byMonth[mk].groups;
      if (!g[owner]) g[owner] = { label: owner, t: 0, ids: [], count: 0 };
      
      g[owner].t += (parseFloat(a.total) || 0);
      g[owner].count += 1;
      g[owner].ids.push(a.id);
    });

    const keys = Object.keys(byMonth).sort();
    if (!keys.length) {
        contentArea.innerHTML = `<div class="py-20 text-center text-slate-400 italic text-sm">Todo facturado en ${year} ✅</div>`;
        return;
    }

    contentArea.innerHTML = keys.map(k => `
      <div class="mb-8">
        <h3 class="text-xs font-black text-indigo-500 uppercase mb-3">${byMonth[k].name}</h3>
        ${Object.values(byMonth[k].groups).map(g => `
          <div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-2 hover:border-indigo-200 transition group">
            <div class="cursor-pointer flex-1" onclick="window.auditarAlbaranes('${g.ids.join(',')}', '${escapeHtml(g.label)}')">
              <p class="font-bold text-slate-800 group-hover:text-indigo-600 underline decoration-dotted decoration-indigo-200">
                ${escapeHtml(g.label)}
              </p>
              <p class="text-[10px] font-black text-slate-400 uppercase">${g.count} albaranes (Ver desglose)</p>
            </div>
            <div class="text-right">
              <p class="font-black text-slate-900 text-base">${fmt(g.t)}€</p>
              <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black mt-1 shadow-sm active:scale-90 transition" 
                      onclick="window.facturarAgrupado('${k}','${escapeHtml(g.label)}')">FACTURAR</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  /* =============================================================
     2) VISTA: HISTORIAL CON AUDITORÍA
     ============================================================= */
  function renderHistorial() {
    const list = (db.facturas || []).filter(f => isInYear(f.date, year));

    contentArea.innerHTML = `
      <div class="overflow-hidden rounded-3xl border border-slate-100 shadow-sm bg-white">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr><th class="p-4">Factura / Proveedor</th><th class="p-4 text-right">Total</th><th class="p-4 text-center">Estado</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            ${list.map(f => `
              <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="window.auditarAlbaranes('${f.albaranIds || ''}', '${escapeHtml(f.prov || f.cliente)}')">
                <td class="p-4">
                  <p class="font-bold text-slate-800 underline decoration-indigo-100">${escapeHtml(f.prov || f.cliente || '—')}</p>
                  <p class="text-[10px] text-slate-400 font-mono">#${f.num} | ${f.date}</p>
                </td>
                <td class="p-4 text-right font-black text-slate-900">${fmt(f.total)}€</td>
                <td class="p-4 text-center" onclick="event.stopPropagation()">
                  <button onclick="window.togglePago('${f.id}')" class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${f.paid ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                    ${f.paid ? 'PAGADO' : 'PENDIENTE'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* =============================================================
     🧪 VENTANA DE AUDITORÍA (Muestra los albaranes originales)
     ============================================================= */
  window.auditarAlbaranes = (idsString, label) => {
    if (!idsString) return alert("Esta factura no tiene albaranes vinculados.");
    const ids = idsString.split(',');
    const albaranes = db.albaranes.filter(a => ids.includes(a.id));
    
    const modal = container.querySelector("#modalAuditoria");
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative overflow-hidden">
        <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl">✕</button>
        <h3 class="text-xl font-black text-slate-800 mb-2">${label}</h3>
        <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Desglose de albaranes agrupados</p>
        
        <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          ${albaranes.map(a => `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <p class="font-bold text-slate-700 text-sm">${a.fecha || a.date}</p>
                  <p class="text-[10px] font-mono text-slate-400">ID: ${a.id}</p>
                </div>
                <p class="font-black text-slate-900">${fmt(a.total)}€</p>
              </div>
              ${a.notes ? `<div class="bg-amber-100/50 p-2 rounded-lg text-[11px] text-amber-800 font-medium">⚠️ NOTA: ${a.notes}</div>` : ''}
            </div>
          `).join('')}
        </div>
        
        <div class="mt-8 pt-6 border-t flex justify-between items-center">
            <p class="text-[10px] font-black text-slate-400 uppercase">Suma Total Auditoría</p>
            <p class="text-2xl font-black text-slate-900">${fmt(albaranes.reduce((t,x)=>t+parseFloat(x.total||0),0))}€</p>
        </div>
      </div>
    `;
  };

  /* =============================================================
     GENERACIÓN DE FACTURA (Ahora guarda los IDs)
     ============================================================= */
  window.facturarAgrupado = async (monthKey, ownerLabel) => {
    const num = prompt(`Nº de Factura para ${ownerLabel}:`);
    if (!num) return;

    const sel = db.albaranes.filter(a => {
        const o = (mode === 'proveedor') ? (a.proveedor || a.prov) : (a.socio || 'Arume');
        return !a.invoiced && keyMonth(a.fecha || a.date) === monthKey && o === ownerLabel;
    });

    let total = 0;
    const albaranIds = sel.map(a => {
        a.invoiced = true;
        total += (parseFloat(a.total) || 0);
        return a.id;
    });

    const nuevaFra = {
        id: Math.random().toString(36).slice(2,11),
        num,
        date: new Date().toISOString().split('T')[0],
        prov: mode === 'proveedor' ? ownerLabel : undefined,
        cliente: mode === 'socio' ? ownerLabel : undefined,
        total: round2(total),
        albaranIds: albaranIds.join(','), // AQUÍ GUARDAMOS EL VÍNCULO
        paid: false
    };

    db.facturas.push(nuevaFra);
    await saveFn("Factura generada con trazabilidad ✅");
    rerender();
  };

  window.togglePago = async (id) => {
    const f = db.facturas.find(x => x.id === id);
    if (f) { f.paid = !f.paid; await saveFn(`Factura ${f.num} actualizada`); rerender(); }
  };

  // HELPERS
  function isInYear(d, y) { try { return new Date(d).getFullYear() === y; } catch { return false; } }
  function keyMonth(d) { if(!d) return null; const date = new Date(d); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
  function nameMonthKey(k) { const names = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; return `${names[parseInt(k.split('-')[1])]} ${k.split('-')[0]}`; }
  function fmt(n) { return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2}); }
  function round2(x) { return Math.round(x * 100) / 100; }
  function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }
}
