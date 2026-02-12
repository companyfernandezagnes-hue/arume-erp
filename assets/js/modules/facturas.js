/* =============================================================
   📄 MÓDULO: FACTURAS PRO+ (Mes/Proveedor o Socio, Base/IVA, CSV, SEPA)
   Uso: import { renderFacturas } from './FacturasProPlus.js'
        renderFacturas(container, supabase, db, { save: window.save })
   Requisitos: db.albaranes[], db.facturas[]
   ============================================================= */
export async function renderFacturas(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  if (!Array.isArray(db.facturas))  db.facturas  = [];

  // Estado UI
  let activeTab = 'pend';   // 'pend' | 'hist'
  let mode = 'proveedor';   // 'proveedor' | 'socio'
  let year  = new Date().getFullYear();

  container.innerHTML = `
    <div class="animate-fade-in space-y-6">
      <section class="p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-xl font-black text-slate-800 mb-1">Centro de Facturación</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Revisión y Cierre de Ciclo</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnModeProv" class="px-3 py-1 rounded-full text-[10px] border bg-white">Por Proveedor</button>
            <button id="btnModeSocio" class="px-3 py-1 rounded-full text-[10px] border">Por Socio</button>
          </div>
        </div>

        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
          <button id="btnTabPend" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition bg-white shadow-sm text-indigo-600">📦 PENDIENTES</button>
          <button id="btnTabHist" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition text-slate-500">💰 HISTORIAL</button>
        </div>

        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <button id="btnYearPrev" class="px-2 py-1 rounded bg-white border">‹</button>
            <span id="lblYear" class="text-sm font-black text-slate-700">${year}</span>
            <button id="btnYearNext" class="px-2 py-1 rounded bg-white border">›</button>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnExportHist" class="px-3 py-2 rounded-2xl text-xs border bg-white">⬇️ Export Historial (CSV)</button>
            <button id="btnSEPA" class="px-3 py-2 rounded-2xl text-xs border bg-white">🏦 Remesa SEPA (XML)</button>
          </div>
        </div>

        <div id="contentArea"></div>
      </section>
    </div>

    <div id="modalFactura" class="hidden"></div>
  `;

  // Refs
  const contentArea = container.querySelector("#contentArea");
  const btnTabPend  = container.querySelector("#btnTabPend");
  const btnTabHist  = container.querySelector("#btnTabHist");
  const btnModeProv = container.querySelector("#btnModeProv");
  const btnModeSoc  = container.querySelector("#btnModeSocio");
  const lblYear     = container.querySelector("#lblYear");

  container.querySelector("#btnYearPrev").onclick = () => { year--; lblYear.innerText = year; rerender(); };
  container.querySelector("#btnYearNext").onclick = () => { year++; lblYear.innerText = year; rerender(); };
  btnTabPend.onclick = () => { activeTab = 'pend'; rerender(); };
  btnTabHist.onclick = () => { activeTab = 'hist'; rerender(); };
  btnModeProv.onclick = () => { mode = 'proveedor'; btnModeProv.classList.add('bg-white'); btnModeSoc.classList.remove('bg-white'); rerender(); };
  btnModeSoc.onclick  = () => { mode = 'socio'; btnModeSoc.classList.add('bg-white'); btnModeProv.classList.remove('bg-white'); rerender(); };

  rerender();

  function rerender() {
    actualizarTabs();
    if (activeTab === 'pend') renderPendientes();
    else renderHistorial();
  }

  /* =============================================================
     📌 Filtrado helpers
     ============================================================= */
  const monthNames = ["", "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Sept.","Oct.","Nov.","Dic."];

  function isInYear(dateStr, y) {
    if (!dateStr) return false;
    try { return new Date(dateStr).getFullYear() === y; } catch { return false; }
  }

  function keyMonth(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const m = d.getMonth()+1, yyyy = d.getFullYear();
    return `${yyyy}-${String(m).padStart(2,'0')}`;
  }

  function nameMonthKey(key) {
    const [yyyy, mm] = key.split('-');
    return `${monthNames[Number(mm)]} ${yyyy}`;
  }

  /* =============================================================
     1) PENDIENTES — agrupados por Mes → (Proveedor | Socio)
     - alerta si es mes anterior
     - badge NOTAS si algún albarán del grupo la trae
     ============================================================= */
  function renderPendientes() {
    const albs = (db.albaranes || []).filter(a => !a.invoiced && isInYear(a.fecha || a.date, year));

    // Mapa: { 'YYYY-MM': { name, groups: { key -> { label, total, ids, hasNotes } } } }
    const byMonth = {};
    albs.forEach(a => {
      const mk = keyMonth(a.fecha || a.date);
      if (!mk) return;
      if (!byMonth[mk]) byMonth[mk] = { name: nameMonthKey(mk), groups: {} };

      const owner = (mode === 'proveedor')
        ? (a.proveedor || a.prov || 'S/N')
        : ((a.socio && a.socio !== 'Restaurante' && a.socio !== 'Arume') ? a.socio : 'Arume');

      const g = byMonth[mk].groups;
      if (!g[owner]) g[owner] = { label: owner, t: 0, ids: [], hasNotes: false, count: 0 };
      g[owner].t     += safeNum(a.total);
      g[owner].count += 1;
      g[owner].ids.push(a.id);
      if (a.notes && String(a.notes).trim().length) g[owner].hasNotes = true;
    });

    const keys = Object.keys(byMonth).sort(); // cronológico
    if (!keys.length) {
      contentArea.innerHTML = `<div class="py-12 text-center text-slate-400 italic text-sm">No hay albaranes pendientes ✅</div>`;
      return;
    }

    const todayKey = keyMonth(new Date().toISOString().slice(0,10));

    const html = keys.map(k => {
      const m = byMonth[k];
      const isPast = k < todayKey;
      const headerColor = isPast ? 'text-red-500' : 'text-indigo-500';
      const borderClass = isPast ? 'border-red-400' : 'border-indigo-500';

      const groups = Object.values(m.groups).sort((a,b) => a.label.localeCompare(b.label)).map(g => {
        const alertStyle = g.hasNotes
          ? 'bg-red-50 border-l-4 border-red-500 my-2 rounded-r-xl shadow-sm'
          : 'border-b border-slate-100 last:border-0';

        const listLines = g.ids.map(id => {
          const alb = db.albaranes.find(x => x.id === id) || {};
          const num = alb.numero || alb.num || '—';
          const dt  = alb.fecha  || alb.date || '';
          return `
            <div class="flex items-center justify-between bg-white/80 p-2 rounded border border-slate-200 hover:border-indigo-400 transition">
              <div class="text-[10px] text-slate-500 font-mono">#${escapeHtml(num)} · ${escapeHtml(dt)}</div>
              <div class="text-[10px] font-black text-slate-800">${fmt(alb.total)}€</div>
            </div>
          `;
        }).join('');

        return `
          <div class="flex justify-between items-start py-3 px-2 ${alertStyle}">
            <div class="flex-1 pr-3">
              <div class="font-bold text-slate-800 text-sm">${escapeHtml(g.label)}</div>
              <div class="text-[10px] text-slate-400 bg-white px-2 rounded inline-block border">${g.count} albaranes</div>
              ${g.hasNotes ? `<div class="text-[10px] font-black text-red-600 animate-pulse mt-1">⚠ REVISAR NOTAS</div>` : ''}
              <div class="mt-2 grid grid-cols-2 gap-2">${listLines}</div>
            </div>
            <div class="text-right">
              <div class="font-black text-slate-700 text-sm mb-2">${fmt(g.t)}€</div>
              <button class="bg-indigo-600 text-white px-3 py-2 rounded-xl text-[10px] font-bold shadow-lg active:scale-95 transition"
                      onclick="window.openFacturaWizard('${k}','${escapeAttr(g.label)}')">
                FACTURAR
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="bg-white rounded-[2rem] p-6 mb-6 border-l-4 ${borderClass} shadow-sm">
          <h3 class="font-black text-sm ${headerColor} mb-3 uppercase tracking-widest flex justify-between">
            <span>⚠ PENDIENTES ${escapeHtml(m.name)}</span>
            ${isPast ? '<span class="text-[9px] bg-red-100 px-2 py-1 rounded">MES ANTERIOR</span>' : ''}
          </h3>
          ${groups}
        </div>
      `;
    }).join('');

    contentArea.innerHTML = html;

    // Wizard para consolidar (Mes + Proveedor/Socio)
    window.openFacturaWizard = (monthKey, ownerLabel) => {
      const ids = (db.albaranes || [])
        .filter(a => !a.invoiced && keyMonth(a.fecha||a.date) === monthKey)
        .filter(a => (mode==='proveedor'
            ? (a.proveedor===ownerLabel || a.prov===ownerLabel)
            : ((a.socio && a.socio!== 'Restaurante' && a.socio!=='Arume') ? a.socio : 'Arume') === ownerLabel))
        .map(a => a.id);

      const set = new Set(ids);
      const sel = (db.albaranes || []).filter(a => set.has(a.id));

      // Sumar base/iva/total (si faltan base/tax en algún albarán, recalcular)
      const totals = sel.reduce((acc, a) => {
        const t = computeAlbTotals(a);
        acc.base  += t.base;
        acc.iva   += t.iva;
        acc.total += t.total;
        return acc;
      }, {base:0, iva:0, total:0});

      const modal = container.querySelector('#modalFactura');
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
          <div class="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl p-6 relative animate-slide-up overflow-hidden">
            <button onclick="document.getElementById('modalFactura').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition text-2xl">✕</button>
            <h3 class="text-xl font-black text-slate-800 mb-1">Generar Factura</h3>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">${escapeHtml(nameMonthKey(monthKey))} · ${escapeHtml(ownerLabel)}</p>

            <div class="grid grid-cols-2 gap-2 mb-3">
              <input id="fw-num"   class="p-2 border rounded-xl font-mono" placeholder="Número factura (obligatorio)">
              <input id="fw-date"  type="date" class="p-2 border rounded-xl" value="${getISO()}">
            </div>

            <div class="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-3">
              <div class="flex items-center justify-between text-sm"><span>Base imponible</span><b>${fmt(totals.base)}€</b></div>
              <div class="flex items-center justify-between text-sm"><span>Cuota IVA</span><b>${fmt(totals.iva)}€</b></div>
              <div class="flex items-center justify-between text-sm border-t mt-2 pt-2"><span>Total</span><b>${fmt(totals.total)}€</b></div>
            </div>

            <div class="text-[10px] text-slate-400 mb-2">Incluye ${sel.length} albaranes</div>
            <button id="fw-confirm" class="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition">
              CONFIRMAR Y GUARDAR
            </button>
          </div>
        </div>
      `;

      modal.querySelector('#fw-confirm').onclick = async () => {
        const num  = modal.querySelector('#fw-num').value.trim();
        const date = modal.querySelector('#fw-date').value;
        if (!num) { alert("Falta el número de factura."); return; }

        // Marcar albaranes como facturados y consolidar base/iva/total
        let base=0, iva=0, total=0;
        sel.forEach(a => {
          a.invoiced = true;
          const t = computeAlbTotals(a);
          base  += t.base; iva += t.iva; total += t.total;
        });

        const fra = {
          id: genId(),
          num,
          date,
          prov: (mode==='proveedor') ? ownerLabel : undefined,
          cliente: (mode==='socio')  ? ownerLabel : undefined,
          base:  round2(base),
          tax:   round2(iva),
          total: round2(total),
          paid:  false
        };
        db.facturas.push(fra);
        await saveFn(`Factura ${num} generada ✅`);
        modal.classList.add('hidden');
        rerender();
      };
    };
  }

  /* =============================================================
     2) HISTORIAL — vista mensual con CSV + toggle pago
     ============================================================= */
  function renderHistorial() {
    const list = (db.facturas || []).filter(f => isInYear(f.date, year))
                  .sort((a,b) => b.date.localeCompare(a.date));

    // Agrupar por mes para export rápido
    const byMonth = {};
    list.forEach(f => {
      const m = (new Date(f.date).getMonth()+1);
      if (!byMonth[m]) byMonth[m] = { name: monthNames[m], total: 0, items: [] };
      byMonth[m].items.push(f);
      byMonth[m].total += safeNum(f.total);
    });

    const html = Object.keys(byMonth).sort((a,b)=>b-a).map(mKey => {
      const data = byMonth[mKey];
      const rows = data.items.map(f => `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-4">
            <p class="font-bold text-slate-800">
              ${escapeHtml(f.prov || f.cliente || '—')}
            </p>
            <p class="text-[10px] text-slate-400 font-mono">${escapeHtml(f.date)} | #${escapeHtml(f.num || f.numero || '')}</p>
            ${ (typeof f.base !== 'undefined')
                ? `<p class="text-[10px] text-slate-400 font-mono">Base: ${fmt(f.base)}€ · IVA: ${fmt(f.tax||0)}€</p>`
                : '' }
          </td>
          <td class="p-4 text-right font-black text-slate-900">${fmt(f.total)}€</td>
          <td class="p-4 text-center">
            <button data-id="${f.id}" class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition ${f.paid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-rose-100 text-rose-600 border border-rose-200'}">
              ${f.paid ? 'PAGADO' : 'PENDIENTE'}
            </button>
          </td>
        </tr>
      `).join('');

      return `
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <div>
              <h3 class="font-black text-slate-800 uppercase text-lg tracking-tight">${escapeHtml(data.name)} ${year}</h3>
              <div class="text-[10px] font-bold text-slate-400">Total Mes: ${fmt(data.total)} €</div>
            </div>
            <button class="px-3 py-2 rounded-lg text-[10px] border bg-emerald-50 text-emerald-700" onclick="window.exportMonthCSV(${mKey}, '${escapeAttr(data.name)}')">EXCEL</button>
          </div>
          <div class="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
            <table class="w-full text-left text-sm bg-white">
              <thead class="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                <tr><th class="p-4">Empresa / Fecha</th><th class="p-4 text-right">Total</th><th class="p-4 text-center">Estado</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-50">${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    contentArea.innerHTML = html || `<div class="py-12 text-center text-slate-400 italic text-sm">Aún no hay facturas generadas.</div>`;

    // Toggle pago
    contentArea.querySelectorAll('button[data-id]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.id;
        const f = db.facturas.find(x => x.id === id);
        if (!f) return;
        f.paid = !f.paid;
        await saveFn(`Estado de factura ${f.num} actualizado`);
        renderHistorial();
      };
    });

    // Export mensual
    window.exportMonthCSV = (monthIndex, monthName) => {
      const rows = [['Fecha','Factura_Num','Proveedor/Cliente','Estado','Base_Imponible','Cuota_IVA','Total_EUR']];
      const monthList = (db.facturas || []).filter(f => {
        const d = new Date(f.date);
        return d.getFullYear() === year && (d.getMonth()+1) === monthIndex;
      });
      if (!monthList.length) return alert("No hay datos para exportar");

      monthList.forEach(f => {
        const base = typeof f.base !== 'undefined' ? f.base : (f.total || 0);
        const tax  = typeof f.tax  !== 'undefined' ? f.tax  : 0;
        rows.push([
          f.date,
          `"${f.num||''}"`,
          `"${(f.prov || f.cliente || '').replace(/"/g,'""')}"`,
          f.paid ? 'PAGADO' : 'PENDIENTE',
          csvNum(base),
          csvNum(tax),
          csvNum(f.total||0)
        ].join(';'));
      });

      const blob = new Blob(["\uFEFF"+rows.join('\n')], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Contabilidad_${monthName}_${year}.csv`;
      a.click();
    };
  }

  /* =============================================================
     🏦 Remesa SEPA (XML) — stub simple
     - toma facturas PENDIENTES del año actual
     ============================================================= */
  container.querySelector("#btnSEPA").onclick = () => {
    const pending = (db.facturas || []).filter(f => isInYear(f.date, year) && !f.paid);
    if (!pending.length) { alert("No hay facturas pendientes en el año seleccionado"); return; }

    // ¡OJO! Rellena tus datos reales de acreedor/IBAN/BIC aquí:
    const creditorName = (db?.config?.empresa || db?.config?.empresaFiscal || 'ARUME').toString();
    const creditorIBAN = (db?.config?.iban || 'ES00 0000 0000 0000 0000 0000'); // Sustituir
    const msgId = `SEPA-${Date.now()}`;

    // SEPA pain.001 minimalista (ejemplo)
    const itemsXml = pending.map((f,i) => `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${escapeXml((f.num||'SINNUM')+'-'+i)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${Number(f.total||0).toFixed(2)}</InstdAmt></Amt>
        <Cdtr>
          <Nm>${escapeXml(creditorName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${escapeXml(creditorIBAN.replace(/\s/g,''))}</IBAN></Id>
        </CdtrAcct>
        <RmtInf><Ustrd>${escapeXml('Pago factura '+(f.num||''))}</Ustrd></RmtInf>
      </CdtTrfTxInf>
    `).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <NbOfTxs>${pending.length}</NbOfTxs>
      <CtrlSum>${Number(pending.reduce((a,b)=>a+Number(b.total||0),0)).toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${escapeXml(creditorName)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(msgId+'-BATCH')}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${pending.length}</NbOfTxs>
      <CtrlSum>${Number(pending.reduce((a,b)=>a+Number(b.total||0),0)).toFixed(2)}</CtrlSum>
      ${itemsXml}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

    const blob = new Blob([xml], {type:'application/xml;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SEPA_${year}.xml`;
    a.click();
  };

  /* =============================================================
     Utils
     ============================================================= */
  function actualizarTabs() {
    container.querySelector("#btnTabPend").className = `flex-1 py-2.5 rounded-xl font-bold text-xs transition ${activeTab==='pend' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`;
    container.querySelector("#btnTabHist").className = `flex-1 py-2.5 rounded-xl font-bold text-xs transition ${activeTab==='hist' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`;
    if (mode==='proveedor') { btnModeProv.classList.add('bg-white'); btnModeSoc.classList.remove('bg-white');}
    else { btnModeSoc.classList.add('bg-white'); btnModeProv.classList.remove('bg-white');}
  }

  function computeAlbTotals(a) {
    // Usa subtotales si existen; si no, calcula por items; si no, fallback 10%
    if (a?.subtotal != null && a?.taxes != null) {
      return { base: safeNum(a.subtotal), iva: safeNum(a.taxes), total: safeNum(a.total) };
    }
    if (Array.isArray(a?.items) && a.items.length) {
      return a.items.reduce((acc, it) => {
        const q = Number(it.q||0), p = Number(it.p||0), d = Number(it.d||0), tax=Number((it.tax??10));
        const net = p*(1-d/100); const base = q*net;
        acc.base  += base; acc.iva += base*(tax/100); acc.total += base*(1+tax/100);
        return acc;
      }, {base:0, iva:0, total:0});
    }
    const total = safeNum(a.total);
    const base  = total/1.10;
    const iva   = total-base;
    return {base,iva,total};
  }

  function fmt(n) { return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2});}
  function csvNum(n){ return String(Number(n||0).toFixed(2)).replace('.',','); }
  function round2(x){ return Math.round((Number(x)||0)*100)/100; }
  function safeNum(x){ const n=Number(x); return isNaN(n)?0:n; }
  function getISO(){ return new Date().toLocaleDateString('en-CA'); }
  function genId(){ return Math.random().toString(36).slice(2,11); }
  function escapeHtml(s){ return String(s||'').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function escapeAttr(s){ return String(s||'').replace(/"/g,'&quot;'); }
  function escapeXml(s){ return String(s||'').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
}
