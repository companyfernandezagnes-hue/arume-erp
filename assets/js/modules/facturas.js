/* =============================================================
   📄 MÓDULO: FACTURAS v12.1 (Compatible con Fechas ISO)
   ============================================================= */

// --- 🛠️ HELPER: EL MISMO TRADUCTOR DE FECHAS ---
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
            <h2 class="text-xl font-black text-slate-800 mb-1">Centro de Facturación</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Agrupación de Albaranes (Compras)</p>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-1 rounded-full border">
            <button id="btnModeProv" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Proveedor</button>
            <button id="btnModeSocio" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all">Socio</button>
          </div>
        </div>

        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
          <button id="btnTabPend" class="flex-1 py-3 rounded-xl font-black text-xs transition">📦 ALBARANES PENDIENTES</button>
          <button id="btnTabHist" class="flex-1 py-3 rounded-xl font-black text-xs transition">💰 FACTURAS RECIBIDAS</button>
        </div>

        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3 bg-white border px-3 py-1 rounded-2xl shadow-sm">
            <button id="btnYearPrev" class="text-indigo-600 font-bold p-1">‹</button>
            <span id="lblYear" class="text-sm font-black text-slate-700 w-10 text-center">${year}</span>
            <button id="btnYearNext" class="text-indigo-600 font-bold p-1">›</button>
          </div>
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

  function renderPendientes() {
    const albs = db.albaranes.filter(a => !a.invoiced && isInYear(a.date, year));
    const byMonth = {};

    albs.forEach(a => {
      const mk = keyMonth(a.date);
      if (!mk) return;
      if (!byMonth[mk]) byMonth[mk] = { name: nameMonthKey(mk), groups: {} };

      const owner = (mode === 'proveedor') ? (a.prov || 'Sin Proveedor') : (a.socio || 'Arume');
      const g = byMonth[mk].groups;
      if (!g[owner]) g[owner] = { label: owner, t: 0, ids: [], count: 0 };
      
      g[owner].t += (parseFloat(a.total) || 0);
      g[owner].count += 1;
      g[owner].ids.push(a.id);
    });

    const keys = Object.keys(byMonth).sort().reverse(); // De más reciente a más antiguo
    if (!keys.length) {
        contentArea.innerHTML = `<div class="py-20 text-center text-slate-400 italic text-sm">No hay albaranes pendientes en ${year}</div>`;
        return;
    }

    contentArea.innerHTML = keys.map(k => `
      <div class="mb-8">
        <h3 class="text-xs font-black text-indigo-500 uppercase mb-3 px-2">${byMonth[k].name}</h3>
        ${Object.values(byMonth[k].groups).map(g => `
          <div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-2 hover:border-indigo-200 transition group">
            <div class="cursor-pointer flex-1" onclick="window.auditarAlbaranes('${g.ids.join(',')}', '${escapeHtml(g.label)}')">
              <p class="font-bold text-slate-800 group-hover:text-indigo-600 underline decoration-dotted decoration-indigo-200">${escapeHtml(g.label)}</p>
              <p class="text-[10px] font-black text-slate-400 uppercase">${g.count} albaranes (Tocar para ver)</p>
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

  function renderHistorial() {
    const list = (db.facturas || []).filter(f => isInYear(f.date, year));
    if(!list.length) {
        contentArea.innerHTML = `<div class="py-20 text-center text-slate-400 italic text-sm">Sin facturas registradas en ${year}</div>`;
        return;
    }

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

  window.auditarAlbaranes = (idsString, label) => {
    if (!idsString) return alert("Sin albaranes vinculados.");
    const ids = idsString.split(',');
    const albaranes = db.albaranes.filter(a => ids.includes(a.id));
    
    const modal = container.querySelector("#modalAuditoria");
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative overflow-hidden flex flex-col max-h-[90vh]">
        <button onclick="document.getElementById('modalAuditoria').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl z-10 transition">✕</button>
        <h3 class="text-xl font-black text-slate-800 mb-2">${label}</h3>
        <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Desglose de la compra</p>
        
        <div class="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          ${albaranes.map(a => `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-bold text-slate-700 text-sm">${formatearFechaISO(a.date)}</p>
                  <p class="text-[9px] font-mono text-slate-400 uppercase">Socio: ${a.socio || 'Arume'}</p>
                </div>
                <p class="font-black text-slate-900">${fmt(a.total)}€</p>
              </div>
              ${a.notes ? `<p class="mt-2 text-[10px] text-amber-600 font-bold">⚠️ ${a.notes}</p>` : ''}
            </div>
          `).join('')}
        </div>
        
        <div class="mt-6 pt-6 border-t flex justify-between items-center mb-4">
            <p class="text-[10px] font-black text-slate-400 uppercase">Total agrupado</p>
            <p class="text-2xl font-black text-slate-900">${fmt(albaranes.reduce((t,x)=>t+parseFloat(x.total||0),0))}€</p>
        </div>

        <button id="btnN8nGestoria" onclick="window.enviarGestoriaN8n('${idsString}', '${label}')" class="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white py-4 rounded-2xl font-black shadow-lg hover:shadow-xl hover:scale-[1.02] transition flex justify-center items-center gap-2">
            <span>☁️</span> ENVIAR A GESTORÍA (n8n)
        </button>
      </div>
    `;
  };

  // --- 6.5 NUEVO: ENVIAR A GESTORÍA (n8n Webhook) ---
  window.enviarGestoriaN8n = async (idsString, label) => {
    const btn = document.getElementById("btnN8nGestoria");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="animate-spin inline-block">🔄</span> PROCESANDO...`;
    btn.disabled = true;

    try {
        const ids = idsString.split(',');
        const albaranes = db.albaranes.filter(a => ids.includes(a.id));
        const total = albaranes.reduce((t,x) => t + parseFloat(x.total || 0), 0);

        // Aquí usarás la misma URL que configuramos para el banco si quieres
        const n8nWebhookURL = db.config?.n8nUrlBanco || ""; 
        
        if(!n8nWebhookURL) {
            alert("⚠️ No hay URL de n8n configurada.");
            return;
        }

        const payload = {
            tipo: "ENVIO_GESTORIA",
            proveedor_o_socio: label,
            fecha_envio: new Date().toISOString().split('T')[0],
            total_factura: total,
            desglose_albaranes: albaranes
        };

        const response = await fetch(n8nWebhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Error conectando con n8n");

        alert("✅ ¡Factura enviada a la gestoría correctamente!");
        document.getElementById('modalAuditoria').classList.add('hidden');

    } catch (error) {
        console.error(error);
        alert("Error al enviar. Revisa el túnel n8n.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
  };

  window.facturarAgrupado = async (monthKey, ownerLabel) => {
    const num = prompt(`Nº de Factura Oficial para ${ownerLabel}:`);
    if (!num) return;

    const sel = db.albaranes.filter(a => {
        const o = (mode === 'proveedor') ? a.prov : (a.socio || 'Arume');
        return !a.invoiced && keyMonth(a.date) === monthKey && o === ownerLabel;
    });

    let total = 0;
    const albaranIds = sel.map(a => {
        a.invoiced = true;
        total += (parseFloat(a.total) || 0);
        return a.id;
    });

    db.facturas.push({
        id: 'fac-' + Date.now() + Math.random().toString(36).slice(2,5),
        num,
        date: new Date().toISOString().split('T')[0],
        prov: mode === 'proveedor' ? ownerLabel : 'Varios',
        cliente: mode === 'socio' ? ownerLabel : 'Arume',
        total: Math.round(total * 100) / 100,
        albaranIds: albaranIds.join(','),
        paid: false,
        reconciled: false
    });

    await saveFn("Factura generada ✅");
    rerender();
  };

  window.togglePago = async (id) => {
    const f = db.facturas.find(x => x.id === id);
    if (f) { f.paid = !f.paid; await saveFn(`Actualizado`); rerender(); }
  };

  // --- NUEVAS FUNCIONES DE FECHA BLINDADAS ---
  function isInYear(d, y) { 
      const iso = formatearFechaISO(d);
      return iso.startsWith(y.toString());
  }

  function keyMonth(d) { 
      const iso = formatearFechaISO(d); // YYYY-MM-DD
      return iso.substring(0, 7); // Devuelve YYYY-MM
  }

  function nameMonthKey(k) { 
      const [y, m] = k.split('-');
      const names = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; 
      return `${names[parseInt(m)]} ${y}`; 
  }

  function fmt(n) { return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2}); }
  function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

  rerender();
}
