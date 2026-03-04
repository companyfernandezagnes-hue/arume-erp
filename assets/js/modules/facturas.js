/* =============================================================
   📄 MÓDULO: FACTURAS v13.0 (Agrupación Perfecta y Control Visual)
   ============================================================= */

// --- 🛠️ HELPER: FECHAS ---
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

export async function render(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  if (!Array.isArray(db.facturas))  db.facturas  = [];

  let activeTab = 'pend';
  let mode = 'proveedor';
  let year = new Date().getFullYear();

  container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
      <section class="p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-xl font-black text-slate-800 mb-1">Cierre de Facturas</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Agrupa albaranes para el banco</p>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-1 rounded-full border border-slate-200">
            <button id="btnModeProv" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Proveedores</button>
            <button id="btnModeSocio" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Socios</button>
          </div>
        </div>

        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
          <button id="btnTabPend" class="flex-1 py-3 rounded-xl font-black text-xs transition">📦 PENDIENTES DE CIERRE</button>
          <button id="btnTabHist" class="flex-1 py-3 rounded-xl font-black text-xs transition">💰 FACTURAS CERRADAS</button>
        </div>

        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3 bg-white border px-3 py-1 rounded-2xl shadow-sm">
            <button id="btnYearPrev" class="text-indigo-600 font-bold p-1 hover:scale-110 transition">‹</button>
            <span id="lblYear" class="text-sm font-black text-slate-700 w-10 text-center">${year}</span>
            <button id="btnYearNext" class="text-indigo-600 font-bold p-1 hover:scale-110 transition">›</button>
          </div>
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

  container.querySelector("#btnYearPrev").onclick = () => { year--; rerender(); };
  container.querySelector("#btnYearNext").onclick = () => { year++; rerender(); };
  btnTabPend.onclick = () => { activeTab = 'pend'; rerender(); };
  btnTabHist.onclick = () => { activeTab = 'hist'; rerender(); };
  btnModeProv.onclick = () => { mode = 'proveedor'; rerender(); };
  btnModeSoc.onclick  = () => { mode = 'socio'; rerender(); };

  function rerender() {
    container.querySelector("#lblYear").innerText = year;
    btnTabPend.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='pend' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`;
    btnTabHist.className = `flex-1 py-3 rounded-xl font-black text-xs transition ${activeTab==='hist' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`;
    btnModeProv.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='proveedor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`;
    btnModeSoc.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${mode==='socio' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`;

    if (activeTab === 'pend') renderPendientes();
    else renderHistorial();
  }

  function renderPendientes() {
    const albs = db.albaranes.filter(a => !a.invoiced && isInYear(a.date, year));
    const byMonth = {};

    albs.forEach(a => {
      const mk = keyMonth(a.date);
      if (!mk) return;
      if (!byMonth[mk]) byMonth[mk] = { name: nameMonthKey(mk), groups: {} };

      // Normalización para agrupar (evita que "Makro" y "makro " se separen)
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
        contentArea.innerHTML = `<div class="py-20 flex flex-col items-center justify-center opacity-50"><span class="text-4xl mb-3">📦</span><p class="text-slate-500 font-bold text-sm">Todo al día en ${year}</p></div>`;
        return;
    }

    contentArea.innerHTML = keys.map(k => `
      <div class="mb-8 animate-fade-in">
        <h3 class="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 px-2 border-b border-indigo-100 pb-2">${byMonth[k].name}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${Object.values(byMonth[k].groups).map(g => `
            <div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition cursor-pointer group"
                 onclick="window.abrirModalAgrupacion('${k}', '${escapeHtml(g.label)}', '${g.ids.join(',')}')">
                <div>
                <p class="font-black text-slate-800 group-hover:text-indigo-600 transition">${escapeHtml(g.label)}</p>
                <span class="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase">${g.count} Albaranes</span>
                </div>
                <div class="text-right">
                <p class="font-black text-slate-900 text-lg">${fmt(g.t)}€</p>
                <p class="text-[9px] font-bold text-indigo-400 group-hover:underline mt-1">REVISAR Y CERRAR ➔</p>
                </div>
            </div>
            `).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderHistorial() {
    const list = (db.facturas || []).filter(f => isInYear(f.date, year)).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(!list.length) {
        contentArea.innerHTML = `<div class="py-20 flex flex-col items-center justify-center opacity-50"><span class="text-4xl mb-3">🗄️</span><p class="text-slate-500 font-bold text-sm">No hay facturas cerradas en ${year}</p></div>`;
        return;
    }

    contentArea.innerHTML = `
      <div class="space-y-3">
        ${list.map(f => `
          <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition">
            
            <div class="flex-1 cursor-pointer" onclick="window.verFacturaDetalle('${f.id}')">
              <div class="flex items-center gap-2 mb-1">
                 <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">${f.date}</span>
                 ${f.reconciled ? `<span class="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">🔗 BANCO OK</span>` : `<span class="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">ESPERANDO BANCO</span>`}
              </div>
              <p class="font-black text-slate-800 text-base">${escapeHtml(f.prov || f.cliente || '—')}</p>
              <p class="text-xs text-indigo-500 font-bold">Nº: ${f.num}</p>
            </div>
            
            <div class="flex items-center justify-between md:justify-end gap-6 md:w-auto w-full border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
              <div class="text-left md:text-right">
                <p class="font-black text-slate-900 text-xl">${fmt(f.total)}€</p>
              </div>
              <div class="flex gap-2">
                  <button onclick="window.togglePago('${f.id}')" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${f.paid ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}">
                    ${f.paid ? '✔️ PAGADA' : '⏳ PENDIENTE'}
                  </button>
                  <button onclick="window.borrarFactura('${f.id}')" class="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition shadow-sm" title="Eliminar y liberar albaranes">
                     🗑️
                  </button>
              </div>
            </div>

          </div>
        `).join('')}
      </div>`;
  }

  // --- VISUALIZAR Y CREAR FACTURA DESDE ALBARANES ---
  window.abrirModalAgrupacion = (monthKey, label, idsString) => {
    const ids = idsString.split(',');
    const albaranes = db.albaranes.filter(a => ids.includes(a.id));
    const totalGroup = albaranes.reduce((t,x)=>t+parseFloat(x.total||0),0);
    
    const modal = container.querySelector("#modalAuditoria");
    modal.classList.remove("hidden");
    
    modal.innerHTML = `
      <div class="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
        <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl z-10 transition">✕</button>
        
        <div class="border-b border-slate-100 pb-4 mb-4">
            <h3 class="text-2xl font-black text-slate-800">${label}</h3>
            <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Generando factura de ${nameMonthKey(monthKey)}</p>
        </div>
        
        <div class="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar bg-slate-50 rounded-2xl p-4 border border-slate-100 inset-shadow">
          ${albaranes.map(a => `
            <div class="flex justify-between items-center py-2 border-b border-slate-200 last:border-0">
              <div>
                <p class="font-bold text-slate-700 text-sm">${formatearFechaISO(a.date)}</p>
                <p class="text-[9px] font-mono text-slate-400">Ref: ${a.num || 'S/N'}</p>
              </div>
              <p class="font-black text-slate-900">${fmt(a.total)}€</p>
            </div>
          `).join('')}
        </div>
        
        <div class="mt-6 space-y-4">
            <div class="flex items-center justify-between bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Suma Total</span>
                <span class="text-3xl font-black text-emerald-400">${fmt(totalGroup)}€</span>
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

            <button onclick="window.confirmarCreacionFactura('${label}', '${idsString}', ${totalGroup})" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 transition flex justify-center items-center gap-2">
                <span>📑</span> CREAR FACTURA MENSUAL
            </button>
        </div>
      </div>
    `;
  };

  window.confirmarCreacionFactura = async (ownerLabel, idsString, totalFactura) => {
      const numFactura = document.getElementById("inNumFactura").value.trim();
      const dateFactura = document.getElementById("inDateFactura").value;

      if(!numFactura) return alert("Por favor, introduce el número de factura oficial.");

      const ids = idsString.split(',');
      
      // Marcar albaranes como facturados
      db.albaranes.forEach(a => {
          if (ids.includes(a.id)) a.invoiced = true;
      });

      // Crear la Factura Master
      db.facturas.push({
          id: 'fac-' + Date.now() + Math.random().toString(36).slice(2,5),
          num: numFactura,
          date: dateFactura,
          prov: mode === 'proveedor' ? ownerLabel : 'Varios',
          cliente: mode === 'socio' ? ownerLabel : 'Arume',
          total: Math.round(totalFactura * 100) / 100,
          albaranIds: idsString,
          paid: false,
          reconciled: false
      });

      await saveFn("Factura creada y agrupada ✅");
      document.getElementById('modalAuditoria').classList.add('hidden');
      rerender();
  };

  // --- VER DETALLES DE UNA FACTURA YA CREADA ---
  window.verFacturaDetalle = (facId) => {
      const fac = db.facturas.find(f => f.id === facId);
      if(!fac) return;

      const ids = (fac.albaranIds || '').split(',');
      const albaranes = db.albaranes.filter(a => ids.includes(a.id));

      const modal = container.querySelector("#modalAuditoria");
      modal.classList.remove("hidden");
      
      modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
          <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl z-10 transition">✕</button>
          
          <h3 class="text-xl font-black text-slate-800">${escapeHtml(fac.prov || fac.cliente)}</h3>
          <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1 mb-6">Factura: ${fac.num}</p>

          <div class="space-y-2 mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Albaranes Incluidos:</p>
            ${albaranes.length > 0 ? albaranes.map(a => `
              <div class="flex justify-between text-xs border-b border-slate-100 py-1 text-slate-600 font-bold">
                <span>${formatearFechaISO(a.date)}</span>
                <span>${fmt(a.total)}€</span>
              </div>
            `).join('') : '<p class="text-xs italic text-slate-400">No hay detalles guardados.</p>'}
          </div>

          <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span class="text-xs font-black text-slate-500 uppercase">Total Factura</span>
              <span class="text-2xl font-black text-slate-900">${fmt(fac.total)}€</span>
          </div>
        </div>
      `;
  };

  // --- BORRAR FACTURA (Y LIBERAR ALBARANES) ---
  window.borrarFactura = async (facId) => {
      const fac = db.facturas.find(f => f.id === facId);
      if(!fac) return;

      if(fac.reconciled) {
          alert("⚠️ Esta factura ya ha sido conciliada con el banco. Bórrala primero desde el módulo Banco si quieres eliminarla.");
          return;
      }

      if(!confirm(`¿Seguro que quieres borrar la factura ${fac.num}?\n\nLos albaranes que contiene volverán a la pestaña de "Pendientes".`)) return;

      // Liberar los albaranes
      const ids = (fac.albaranIds || '').split(',');
      db.albaranes.forEach(a => {
          if (ids.includes(a.id)) a.invoiced = false;
      });

      // Eliminar la factura
      db.facturas = db.facturas.filter(f => f.id !== facId);
      
      await saveFn("Factura eliminada. Albaranes liberados 📦");
      rerender();
  };

  window.togglePago = async (id) => {
    const f = db.facturas.find(x => x.id === id);
    if (f) { f.paid = !f.paid; await saveFn(`Estado de pago actualizado`); rerender(); }
  };

  // --- FUNCIONES DE FECHA ---
  function isInYear(d, y) { 
      const iso = formatearFechaISO(d);
      return iso.startsWith(y.toString());
  }

  function keyMonth(d) { 
      const iso = formatearFechaISO(d); 
      return iso.substring(0, 7); 
  }

  function nameMonthKey(k) { 
      const [y, m] = k.split('-');
      const names = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]; 
      return `${names[parseInt(m)]} ${y}`; 
  }

  function fmt(n) { return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2}); }
  function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

  rerender();
}
