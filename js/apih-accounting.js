/* Apih Automobile — Modul Akaun (cashbook owner).
   Konsep ikut cashbook 3 Abdul Motor: akaun bank/tunai dengan baki pembukaan,
   catatan manual yang tidak boleh diubah (pembatalan = entri songsang),
   bayaran pelanggan daripada modul Jualan dipaparkan automatik, semakan, resit,
   jejak audit dan CSV bulanan. Amaun disimpan dalam sen (integer).

   MOD DEMO: data disimpan dalam localStorage pelayar ini sahaja.
   Untuk produksi, jadual Supabase (accounts, accounting_entries, audit) diperlukan. */
(() => {
  'use strict';
  const KEY = 'apih-akaun-demo-v1';
  const KINDS = {
    expense: { label: 'Perbelanjaan', sign: -1, short: 'Belanja' },
    income: { label: 'Pendapatan lain', sign: 1, short: 'Pendapatan' },
    capital: { label: 'Modal owner', sign: 1, short: 'Modal' },
    drawings: { label: 'Ambilan owner', sign: -1, short: 'Ambilan' },
    transfer: { label: 'Pindahan akaun', sign: 0, short: 'Pindahan' },
    adjustment: { label: 'Pelarasan baki', sign: 1, short: 'Pelarasan' },
    receipt: { label: 'Bayaran pelanggan', sign: 1, short: 'Terimaan' },
    refund: { label: 'Refund pelanggan', sign: -1, short: 'Refund' }
  };
  const EXPENSE_CATS = ['Pembelian stok kereta', 'Baik pulih & servis', 'Cat & bodywork', 'Sewa premis', 'Gaji', 'Utiliti', 'Iklan & pemasaran', 'Operasi kedai', 'Lain-lain'];
  const INCOME_CATS = ['Komisen pembiayaan', 'Komisen insurans', 'Lain-lain'];
  const MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rm = cents => (cents < 0 ? '−' : '') + 'RM ' + (Math.abs(cents) / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rm0 = cents => (cents < 0 ? '−' : '') + 'RM ' + Math.round(Math.abs(cents) / 100).toLocaleString('en-MY');
  const pad = n => String(n).padStart(2, '0');
  const todayKL = () => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(t => p.find(x => x.type === t).value).join('-');
  };
  const monthKey = d => d.slice(0, 7);
  const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const monthLabel = key => { const [y, m] = key.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
  const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + MONTHS[m - 1].slice(0, 3) + ' ' + y; };
  const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function parseMoney(value, allowNegative) {
    const v = String(value || '').trim().replace(/,/g, '');
    if (!/^-?\d+(\.\d{1,2})?$/.test(v)) throw Error('Amaun mesti nombor, maksimum 2 tempat perpuluhan.');
    if (v.startsWith('-') && !allowNegative) throw Error('Amaun mesti positif.');
    const [w, f = ''] = v.replace('-', '').split('.');
    const c = Number(w) * 100 + Number(f.padEnd(2, '0'));
    if (!Number.isSafeInteger(c) || c > 1e12) throw Error('Amaun terlalu besar.');
    if (c === 0) throw Error('Amaun tidak boleh sifar.');
    return v.startsWith('-') ? -c : c;
  }

  /* ---------- Storan demo ---------- */
  function seedState() {
    const t = todayKL(), cur = monthKey(t), prev = shiftMonth(cur, -1), td = Number(t.slice(8));
    const lastPrev = new Date(Number(prev.slice(0, 4)), Number(prev.slice(5)), 0).getDate();
    const d = (mk, day) => mk + '-' + pad(mk === cur ? Math.min(day, td) : Math.min(day, lastPrev));
    const E = (mk, day, kind, amt, account, extra = {}) => ({ id: uid('TRX'), date: d(mk, day), kind, amount: amt * 100, account, toAccount: null, category: '', description: '', reference: '', reviewed: true, receipts: [], receiptExempt: '', reversalOf: null, reason: '', createdAt: new Date().toISOString(), ...extra });
    const entries = [
      E(prev, 2, 'expense', 21000, 'bank', { category: 'Pembelian stok kereta', description: 'Beli stok · Proton X70 1.8 Premium', reference: 'INV-PBK-0141', receipts: ['invois-pembekal-x70.pdf'] }),
      E(prev, 3, 'expense', 1500, 'bank', { category: 'Sewa premis', description: 'Sewa premis bulan ' + MONTHS[Number(prev.slice(5)) - 1], reference: 'SEWA-' + prev, receipts: ['resit-sewa.jpg'] }),
      E(prev, 5, 'expense', 850, 'cash', { category: 'Baik pulih & servis', description: 'Servis & tukar minyak · Perodua Myvi', receipts: ['resit-bengkel.jpg'] }),
      E(prev, 8, 'expense', 3200, 'bank', { category: 'Gaji', description: 'Gaji jurujual & pembantu', receiptExempt: 'Slip gaji disimpan berasingan' }),
      E(prev, 10, 'transfer', 2000, 'bank', { toAccount: 'cash', description: 'Keluarkan tunai untuk kegunaan kedai' }),
      E(prev, 12, 'expense', 300, 'bank', { category: 'Iklan & pemasaran', description: 'Iklan Facebook & TikTok', receipts: ['meta-ads.pdf'] }),
      E(prev, 15, 'expense', 1200, 'cash', { category: 'Cat & bodywork', description: 'Cat semula bumper · Honda City', receipts: ['resit-cat.jpg'] }),
      E(prev, 20, 'income', 600, 'bank', { category: 'Komisen pembiayaan', description: 'Komisen pinjaman kereta' }),
      E(prev, 25, 'expense', 420, 'bank', { category: 'Utiliti', description: 'Bil elektrik & air', receipts: ['bil-tnb.pdf'] }),
      E(prev, 28, 'capital', 10000, 'bank', { description: 'Suntikan modal owner' }),
      E(cur, 1, 'expense', 1500, 'bank', { category: 'Sewa premis', description: 'Sewa premis bulan ' + MONTHS[Number(cur.slice(5)) - 1], reference: 'SEWA-' + cur, receipts: ['resit-sewa.jpg'] }),
      E(cur, 2, 'expense', 18500, 'bank', { category: 'Pembelian stok kereta', description: 'Beli stok · Honda City 1.5 E', reference: 'INV-PBK-0152' }),
      E(cur, 4, 'expense', 650, 'cash', { category: 'Baik pulih & servis', description: 'Tukar pad brek & tayar · Toyota Vios', receipts: ['resit-tayar.jpg'] }),
      E(cur, 6, 'expense', 250, 'bank', { category: 'Iklan & pemasaran', description: 'Boost iklan TikTok', receipts: ['tiktok-ads.pdf'] }),
      E(cur, 7, 'drawings', 1000, 'bank', { description: 'Ambilan peribadi owner' }),
      E(cur, 9, 'expense', 380, 'bank', { category: 'Utiliti', description: 'Bil elektrik', reviewed: false }),
      E(cur, 10, 'income', 350, 'cash', { category: 'Komisen insurans', description: 'Komisen insurans kereta', reviewed: false })
    ];
    return {
      version: 1,
      accounts: [
        { id: 'bank', name: 'Akaun Bank Utama', type: 'bank', opening: 4500000, openingDate: prev + '-01' },
        { id: 'cash', name: 'Tunai Kedai', type: 'cash', opening: 500000, openingDate: prev + '-01' }
      ],
      entries,
      paymentMap: { 'pay-1': 'bank', 'pay-3': 'cash' },
      paymentReviewed: { 'pay-1': true },
      audit: [{ at: new Date().toISOString(), entry: null, action: 'Data contoh dimuatkan', by: 'Sistem' }]
    };
  }
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.version === 1) return s; } catch (_) {} return seedState(); };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} };

  let state = null, ui = { month: monthKey(todayKL()), q: '', kind: '', account: '', attention: false }, ctx = null, root = null;
  const audit = (entry, action, detail) => state.audit.unshift({ at: new Date().toISOString(), entry, action, detail: detail || '', by: ctx?.profile?.full_name || 'Owner' });

  /* ---------- Model ---------- */
  function paymentRows() {
    const sales = ctx.sales || [], vehicles = ctx.vehicles || [], customers = ctx.customers || [];
    return (ctx.payments || []).map(p => {
      const sale = sales.find(s => s.id === p.sale_id) || {};
      const v = vehicles.find(x => x.id === sale.vehicle_id) || {};
      const c = customers.find(x => x.id === sale.customer_id) || {};
      const cents = Math.round(Number(p.amount || 0) * 100);
      const kindLabel = p.kind === 'deposit' ? 'Deposit' : p.kind === 'full_payment' ? 'Bayaran penuh' : 'Bayaran';
      return {
        id: 'PAY:' + p.id, paymentId: p.id, source: 'Jualan', date: String(p.confirmed_at || '').slice(0, 10) || todayKL(),
        kind: cents < 0 ? 'refund' : 'receipt', amount: Math.abs(cents), account: state.paymentMap[p.id] || null, toAccount: null,
        category: kindLabel, description: kindLabel + ' · ' + [v.make, v.model].filter(Boolean).join(' ') + (c.full_name ? ' · ' + c.full_name : ''),
        reference: p.reference_no || '', vehicleRef: v.vehicle_id || '', reviewed: !!state.paymentReviewed[p.id], receipts: [], receiptExempt: 'Rekod jualan', reversalOf: null
      };
    });
  }
  function allRows() {
    const reversed = new Set(state.entries.filter(e => e.reversalOf).map(e => e.reversalOf));
    const manual = state.entries.map(e => ({ ...e, source: 'Manual', voided: reversed.has(e.id) }));
    return manual.concat(paymentRows()).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  // Pergerakan baki untuk satu akaun (sen). Entri tanpa akaun tidak dikira dalam baki.
  function movementFor(e, accountId) {
    if (e.kind === 'transfer') return (e.account === accountId ? -e.amount : 0) + (e.toAccount === accountId ? e.amount : 0);
    if (e.account !== accountId) return 0;
    return KINDS[e.kind].sign * e.amount;
  }
  function balance(acc, rows, upTo) {
    return acc.opening + rows.filter(e => e.date >= acc.openingDate && (!upTo || e.date <= upTo)).reduce((s, e) => s + movementFor(e, acc.id), 0);
  }
  const isIn = e => ['receipt', 'income', 'capital'].includes(e.kind);
  const isOut = e => ['expense', 'drawings', 'refund'].includes(e.kind);
  const needsAttention = e => !e.voided && !e.reversalOf && (!e.reviewed || (!e.account && e.kind !== 'transfer') || (e.kind === 'expense' && !e.receipts.length && !e.receiptExempt));
  function grossProfit(month) {
    return (ctx.sales || []).filter(s => s.status === 'sold' && String(s.sold_at || '').slice(0, 7) === month).reduce((sum, s) => {
      const v = (ctx.vehicles || []).find(x => x.id === s.vehicle_id) || {};
      return sum + Math.round((Number(s.agreed_price || 0) - Number(v.purchase_cost || 0)) * 100);
    }, 0);
  }

  /* ---------- Paparan ---------- */
  function chartWeekly(rows, month) {
    const [y, m] = month.split('-').map(Number), days = new Date(y, m, 0).getDate();
    const weeks = [];
    for (let st = 1; st <= days; st += 7) weeks.push({ st, en: Math.min(days, st + 6), inn: 0, out: 0 });
    rows.forEach(e => { const w = weeks[Math.floor((Number(e.date.slice(8)) - 1) / 7)]; if (!w) return; if (isIn(e)) w.inn += e.amount; else if (isOut(e)) w.out += e.amount; });
    const max = Math.max(1, ...weeks.flatMap(w => [w.inn, w.out]));
    const W = 700, H = 230, base = 180, top = 34, gw = (W - 40) / weeks.length, bw = Math.min(46, gw * 0.3);
    const k = v => (v >= 1000000 ? Math.round(v / 100000) + 'k' : (v / 100000).toFixed(1).replace(/\.0$/, '') + 'k');
    const mon = MONTHS[m - 1].slice(0, 3);
    const groups = weeks.map((w, i) => {
      const cx = 20 + gw * i + gw / 2, hi = w.inn / max * (base - top), ho = w.out / max * (base - top);
      const xi = cx - bw - 3, xo = cx + 3;
      return `<g><title>${esc(`${w.st}–${w.en} ${mon}: masuk ${rm0(w.inn)} · keluar ${rm0(w.out)}`)}</title>
        <rect x="${xi}" y="${base - hi}" width="${bw}" height="${Math.max(hi, w.inn ? 2 : 0)}" rx="4" class="ak-bar-in"/>
        <rect x="${xo}" y="${base - ho}" width="${bw}" height="${Math.max(ho, w.out ? 2 : 0)}" rx="4" class="ak-bar-out"/>
        ${w.inn ? `<text x="${xi + bw / 2}" y="${base - hi - 6}" text-anchor="middle" class="ak-val in">${k(w.inn)}</text>` : ''}
        ${w.out ? `<text x="${xo + bw / 2}" y="${base - ho - 6}" text-anchor="middle" class="ak-val out">${k(w.out)}</text>` : ''}
        <text x="${cx}" y="${base + 20}" text-anchor="middle" class="ak-tick">${w.st}–${w.en} ${mon}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="ak-chart" role="img" aria-label="Wang masuk dan keluar mengikut minggu, ${esc(monthLabel(month))}"><line x1="20" x2="${W - 20}" y1="${base}" y2="${base}" class="ak-axis"/>${groups}</svg>`;
  }
  function categoryBars(rows) {
    const map = new Map();
    rows.filter(e => e.kind === 'expense').forEach(e => map.set(e.category || 'Lain-lain', (map.get(e.category || 'Lain-lain') || 0) + e.amount));
    const list = [...map].filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    if (!list.length) return '<p class="ak-empty">Tiada perbelanjaan bulan ini.</p>';
    const max = list[0][1];
    return list.map(([c, v]) => `<div class="ak-cat"><div class="ak-cat-top"><span>${esc(c)}</span><b>${rm0(v)}</b></div><div class="ak-cat-track"><i style="width:${Math.max(3, v / max * 100)}%"></i></div></div>`).join('');
  }
  function rowHtml(e) {
    const k = KINDS[e.kind], acc = state.accounts.find(a => a.id === e.account), to = state.accounts.find(a => a.id === e.toAccount);
    const signed = e.kind === 'transfer' ? 0 : k.sign * e.amount;
    const tags = [];
    if (e.source === 'Jualan') tags.push('<span class="ak-tag sale">Jualan</span>');
    if (e.voided) tags.push('<span class="ak-tag void">Dibatalkan</span>');
    if (e.reversalOf) tags.push('<span class="ak-tag void">Pembatalan</span>');
    if (!e.account && e.kind !== 'transfer') tags.push('<span class="ak-tag warn">Belum dipadankan</span>');
    else if (!e.reviewed && !e.voided && !e.reversalOf) tags.push('<span class="ak-tag warn">Belum disemak</span>');
    if (e.kind === 'expense' && !e.receipts.length && !e.receiptExempt && !e.voided && !e.reversalOf) tags.push('<span class="ak-tag warn">Tiada resit</span>');
    if (e.receipts.length) tags.push(`<span class="ak-tag">📎 ${e.receipts.length}</span>`);
    return `<button type="button" class="ak-row ${e.voided ? 'is-void' : ''}" data-ak-open="${esc(e.id)}">
      <span class="ak-row-ic ${e.kind}">${k.short.slice(0, 1)}</span>
      <span class="ak-row-main"><strong>${esc(e.description || k.label)}</strong><small>${fmtDate(e.date)} · ${esc(k.label)}${e.category && e.source !== 'Jualan' ? ' · ' + esc(e.category) : ''} · ${e.kind === 'transfer' ? esc((acc?.name || '?') + ' → ' + (to?.name || '?')) : esc(acc?.name || 'Tiada akaun')}</small><span class="ak-tags">${tags.join('')}</span></span>
      <span class="ak-row-amt ${signed > 0 ? 'pos' : signed < 0 ? 'neg' : ''}">${e.kind === 'transfer' ? '⇄ ' + rm(e.amount) : (signed > 0 ? '+' : '') + rm(signed)}</span>
    </button>`;
  }

  function render(view, context) {
    root = view; ctx = context;
    if (!ctx.demo) {
      view.innerHTML = `<div class="ak"><div class="ak-locked"><strong>Modul Akaun belum diaktifkan untuk data sebenar</strong><p class="muted">Jadual kewangan Supabase (akaun, transaksi, audit dan storan resit) perlu dipasang dahulu. Hubungi BinaLab untuk pengaktifan.</p></div></div>`;
      return;
    }
    if (!state) state = load();
    draw();
  }

  function draw() {
    const rowsAll = allRows();
    const monthRows = rowsAll.filter(e => monthKey(e.date) === ui.month);
    const inT = monthRows.filter(isIn).reduce((s, e) => s + e.amount, 0);
    const outT = monthRows.filter(isOut).reduce((s, e) => s + e.amount, 0);
    const gp = grossProfit(ui.month);
    const today = todayKL();
    const accCards = state.accounts.map(a => `<div class="ak-acc ${a.type}"><div class="ak-acc-top"><span>${a.type === 'cash' ? '💵' : '🏦'} ${esc(a.name)}</span><small>${a.type === 'cash' ? 'Tunai' : 'Bank'}</small></div><strong>${rm(balance(a, rowsAll, today))}</strong><small>Baki pembukaan ${rm0(a.opening)} · ${fmtDate(a.openingDate)}</small></div>`).join('');
    const unassigned = rowsAll.filter(e => !e.account && e.kind !== 'transfer' && !e.voided);
    const unVal = unassigned.reduce((s, e) => s + KINDS[e.kind].sign * e.amount, 0);
    const attention = rowsAll.filter(needsAttention);
    let list = monthRows;
    if (ui.attention) list = rowsAll.filter(needsAttention);
    if (ui.kind) list = list.filter(e => e.kind === ui.kind || (ui.kind === 'sale' && e.source === 'Jualan'));
    if (ui.account) list = list.filter(e => ui.account === 'none' ? !e.account && e.kind !== 'transfer' : e.account === ui.account || e.toAccount === ui.account);
    if (ui.q) { const q = ui.q.toLowerCase(); list = list.filter(e => [e.description, e.category, e.reference, e.vehicleRef].some(x => String(x || '').toLowerCase().includes(q))); }

    root.innerHTML = `<div class="ak">
      <header class="ak-head"><div><span class="ak-kicker">KEWANGAN · OWNER SAHAJA</span><h2>Akaun &amp; Aliran Tunai</h2><p class="muted">Cashbook Apih Automobile: wang masuk, wang keluar dan baki setiap akaun.</p></div>
        <div class="ak-actions"><button type="button" class="ak-btn primary" data-ak="new">＋ Rekod transaksi</button><button type="button" class="ak-btn" data-ak="csv">⇩ CSV ${esc(monthLabel(ui.month))}</button></div></header>
      <div class="ak-demo"><span><b>DATA CONTOH</b> · disimpan dalam pelayar ini sahaja, tidak dikongsi.</span><button type="button" class="ak-link" data-ak="reset">Set semula data contoh</button></div>
      <div class="ak-month"><button type="button" class="ak-icon" data-ak="prev" aria-label="Bulan sebelum">‹</button><strong>${esc(monthLabel(ui.month))}</strong><button type="button" class="ak-icon" data-ak="next" aria-label="Bulan seterusnya" ${ui.month >= monthKey(today) ? 'disabled' : ''}>›</button></div>
      <div class="ak-kpis">
        <div class="ak-kpi in"><span>Wang masuk</span><strong>${rm0(inT)}</strong><small>Terimaan jualan, pendapatan & modal</small></div>
        <div class="ak-kpi out"><span>Wang keluar</span><strong>${rm0(outT)}</strong><small>Perbelanjaan, ambilan & refund</small></div>
        <div class="ak-kpi ${inT - outT >= 0 ? 'in' : 'out'}"><span>Aliran tunai bersih</span><strong>${rm0(inT - outT)}</strong><small>Masuk − keluar bulan ini</small></div>
        <div class="ak-kpi gp"><span>Untung kasar jualan</span><strong>${rm0(gp)}</strong><small>Harga jual − kos beli · tidak termasuk overhead</small></div>
      </div>
      <div class="ak-grid2">
        <section class="ak-card"><div class="ak-card-head"><h3>Wang masuk &amp; keluar ikut minggu</h3><span class="ak-legend"><i class="in"></i>Masuk <i class="out"></i>Keluar</span></div>${chartWeekly(monthRows, ui.month)}</section>
        <section class="ak-card"><div class="ak-card-head"><h3>Perbelanjaan ikut kategori</h3></div><div class="ak-cats">${categoryBars(monthRows)}</div></section>
      </div>
      <section class="ak-card"><div class="ak-card-head"><h3>Baki akaun</h3><span class="muted">setakat ${fmtDate(today)}</span><button type="button" class="ak-link" data-ak="accounts">⚙ Urus akaun</button></div>
        <div class="ak-accs">${accCards}<div class="ak-acc warn"><div class="ak-acc-top"><span>⚠ Belum dipadankan</span><small>${unassigned.length} transaksi</small></div><strong>${rm(unVal)}</strong><small>Tidak dikira dalam baki sehingga dipadankan ke akaun</small></div></div></section>
      <section class="ak-card"><div class="ak-card-head"><h3>Transaksi</h3><button type="button" class="ak-chip ${ui.attention ? 'on' : ''}" data-ak="attention">Perlu semakan <b>${attention.length}</b></button></div>
        <div class="ak-filters"><input type="search" placeholder="Cari butiran, rujukan, kategori…" value="${esc(ui.q)}" data-ak-q>
          <select data-ak-kind><option value="">Semua jenis</option><option value="sale" ${ui.kind === 'sale' ? 'selected' : ''}>Bayaran pelanggan</option>${['expense', 'income', 'capital', 'drawings', 'transfer', 'adjustment'].map(k => `<option value="${k}" ${ui.kind === k ? 'selected' : ''}>${KINDS[k].label}</option>`).join('')}</select>
          <select data-ak-acc><option value="">Semua akaun</option>${state.accounts.map(a => `<option value="${a.id}" ${ui.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}<option value="none" ${ui.account === 'none' ? 'selected' : ''}>Belum dipadankan</option></select></div>
        <div class="ak-list">${list.length ? list.map(rowHtml).join('') : '<p class="ak-empty">Tiada transaksi sepadan.</p>'}</div>
        <p class="ak-foot muted">${ui.attention ? 'Semua bulan · ' : esc(monthLabel(ui.month)) + ' · '}${list.length} transaksi. Rekod yang dicatat tidak boleh diubah atau dipadam; pembatalan menambah entri songsang.</p>
      </section>
    </div>`;
    bind();
  }

  function bind() {
    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));
    on('[data-ak="prev"]', 'click', () => { ui.month = shiftMonth(ui.month, -1); ui.attention = false; draw(); });
    on('[data-ak="next"]', 'click', () => { ui.month = shiftMonth(ui.month, 1); ui.attention = false; draw(); });
    on('[data-ak="new"]', 'click', () => openForm());
    on('[data-ak="csv"]', 'click', exportCsv);
    on('[data-ak="accounts"]', 'click', openAccounts);
    on('[data-ak="attention"]', 'click', () => { ui.attention = !ui.attention; draw(); });
    on('[data-ak="reset"]', 'click', () => { if (confirm('Set semula semua data contoh akaun?')) { state = seedState(); save(state); draw(); toast('Data contoh dimuatkan semula.'); } });
    on('[data-ak-q]', 'input', e => { ui.q = e.target.value; const pos = e.target.selectionStart; draw(); const i = root.querySelector('[data-ak-q]'); i.focus(); i.setSelectionRange(pos, pos); });
    on('[data-ak-kind]', 'change', e => { ui.kind = e.target.value; draw(); });
    on('[data-ak-acc]', 'change', e => { ui.account = e.target.value; draw(); });
    on('[data-ak-open]', 'click', e => openDetail(e.currentTarget.dataset.akOpen));
  }

  /* ---------- Modal ---------- */
  function modal(title, body, onMount) {
    closeModal();
    const host = document.getElementById('ada-cloud-gate') || document.body;
    const m = document.createElement('div');
    m.className = 'ak-modal';
    m.innerHTML = `<div class="ak-modal-bg" data-ak-close></div><div class="ak-modal-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="ak-modal-head"><h3>${esc(title)}</h3><button type="button" class="ak-icon" data-ak-close aria-label="Tutup">✕</button></div><div class="ak-modal-body">${body}</div></div>`;
    host.appendChild(m);
    m.querySelectorAll('[data-ak-close]').forEach(n => n.onclick = closeModal);
    requestAnimationFrame(() => m.classList.add('open'));
    onMount && onMount(m);
    return m;
  }
  function closeModal() { document.querySelectorAll('.ak-modal').forEach(n => n.remove()); }
  function toast(t) {
    const host = document.getElementById('ada-cloud-gate') || document.body;
    let n = host.querySelector('.ak-toast'); if (!n) { n = document.createElement('div'); n.className = 'ak-toast'; n.setAttribute('role', 'status'); host.appendChild(n); }
    n.textContent = t; n.classList.add('show'); clearTimeout(n._t); n._t = setTimeout(() => n.classList.remove('show'), 2600);
  }

  function openForm() {
    const accOpts = state.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    const kinds = ['expense', 'income', 'capital', 'drawings', 'transfer', 'adjustment'];
    modal('Rekod transaksi', `<form class="ak-form" novalidate>
      <div class="ak-seg" role="radiogroup">${kinds.map((k, i) => `<label><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}><span>${KINDS[k].label}</span></label>`).join('')}</div>
      <div class="ak-fields">
        <label>Tarikh<input type="date" name="date" value="${todayKL()}" max="${todayKL()}" required></label>
        <label>Amaun (RM)<input name="amount" inputmode="decimal" placeholder="0.00" required></label>
        <label data-f="account">Akaun<select name="account">${accOpts}</select></label>
        <label data-f="to">Ke akaun<select name="toAccount">${accOpts}</select></label>
        <label data-f="category">Kategori<select name="category"></select></label>
        <label class="wide">Butiran<input name="description" maxlength="120" placeholder="Contoh: Bil elektrik bulan ini" required></label>
        <label data-f="reference">Rujukan (pilihan)<input name="reference" maxlength="40" placeholder="No. invois / resit"></label>
        <label data-f="reason" class="wide">Sebab pelarasan<input name="reason" maxlength="160" placeholder="Wajib untuk pelarasan baki"></label>
        <label data-f="receipt" class="wide">Resit (pilihan)<input type="file" name="receipt" accept="image/*,application/pdf" multiple></label>
      </div>
      <p class="ak-hint" data-hint></p><p class="ak-err" data-err role="alert"></p>
      <div class="ak-form-actions"><button type="button" class="ak-btn" data-ak-close>Batal</button><button type="submit" class="ak-btn primary">Simpan transaksi</button></div>
    </form>`, m => {
      const f = m.querySelector('form');
      const sync = () => {
        const k = f.kind.value;
        const show = (n, v) => m.querySelector(`[data-f="${n}"]`).hidden = !v;
        show('to', k === 'transfer'); show('category', k === 'expense' || k === 'income'); show('reason', k === 'adjustment'); show('receipt', k === 'expense' || k === 'income'); show('reference', k !== 'adjustment');
        m.querySelector('[data-f="account"]').firstChild.textContent = k === 'transfer' ? 'Dari akaun' : 'Akaun';
        if (k === 'expense' || k === 'income') f.category.innerHTML = (k === 'expense' ? EXPENSE_CATS : INCOME_CATS).map(c => `<option>${esc(c)}</option>`).join('');
        f.amount.placeholder = k === 'adjustment' ? 'Contoh: -50.00 atau 120.00' : '0.00';
        m.querySelector('[data-hint]').textContent = {
          expense: 'Wang keluar dari akaun. Lampirkan resit supaya tidak masuk senarai semakan.',
          income: 'Pendapatan selain jualan kereta, contohnya komisen pembiayaan atau insurans.',
          capital: 'Wang owner dimasukkan ke dalam perniagaan.',
          drawings: 'Wang perniagaan diambil untuk kegunaan peribadi owner.',
          transfer: 'Pindah wang antara akaun sendiri. Tidak dikira sebagai wang masuk atau keluar perniagaan.',
          adjustment: 'Betulkan baki supaya sama dengan baki sebenar. Amaun negatif mengurangkan baki.'
        }[k];
      };
      f.querySelectorAll('[name="kind"]').forEach(r => r.addEventListener('change', sync));
      sync();
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const err = m.querySelector('[data-err]');
        try {
          const k = f.kind.value;
          const amount = parseMoney(f.amount.value, k === 'adjustment');
          if (!f.date.value) throw Error('Pilih tarikh.');
          if (f.date.value > todayKL()) throw Error('Tarikh tidak boleh pada masa depan.');
          const description = f.description.value.trim();
          if (!description) throw Error('Isi butiran transaksi.');
          if (k === 'transfer' && f.account.value === f.toAccount.value) throw Error('Akaun asal dan destinasi mesti berbeza.');
          if (k === 'adjustment' && f.reason.value.trim().length < 5) throw Error('Nyatakan sebab pelarasan (sekurang-kurangnya 5 aksara).');
          const acc = state.accounts.find(a => a.id === f.account.value);
          if (acc && f.date.value < acc.openingDate) throw Error('Tarikh sebelum tarikh baki pembukaan akaun (' + fmtDate(acc.openingDate) + ').');
          const files = [...(f.receipt?.files || [])].slice(0, 5).map(x => x.name);
          const e = { id: uid('TRX'), date: f.date.value, kind: k, amount, account: f.account.value, toAccount: k === 'transfer' ? f.toAccount.value : null, category: (k === 'expense' || k === 'income') ? f.category.value : '', description, reference: k === 'adjustment' ? '' : f.reference.value.trim(), reviewed: true, receipts: files, receiptExempt: '', reversalOf: null, reason: k === 'adjustment' ? f.reason.value.trim() : '', createdAt: new Date().toISOString() };
          state.entries.push(e);
          audit(e.id, 'Transaksi dicatat', KINDS[k].label + ' ' + rm(amount));
          save(state); closeModal(); ui.month = monthKey(e.date); ui.attention = false; draw();
          toast(KINDS[k].label + ' ' + rm(Math.abs(amount)) + ' disimpan.');
        } catch (x) { err.textContent = x.message; }
      });
      setTimeout(() => f.amount.focus(), 250);
    });
  }

  function findRow(id) { return allRows().find(e => e.id === id); }

  function openDetail(id) {
    const e = findRow(id); if (!e) return;
    const k = KINDS[e.kind], acc = state.accounts.find(a => a.id === e.account), to = state.accounts.find(a => a.id === e.toAccount);
    const isPay = e.source === 'Jualan';
    const original = e.reversalOf ? state.entries.find(x => x.id === e.reversalOf) : null;
    const trail = state.audit.filter(a => a.entry === (isPay ? e.id : e.id) || (original && a.entry === original.id)).slice(0, 8);
    const signed = e.kind === 'transfer' ? e.amount : k.sign * e.amount;
    const canVoid = !isPay && !e.voided && !e.reversalOf;
    modal(k.label, `<div class="ak-detail">
      <div class="ak-detail-amt ${signed > 0 && e.kind !== 'transfer' ? 'pos' : signed < 0 ? 'neg' : ''}">${e.kind === 'transfer' ? '⇄ ' + rm(e.amount) : (signed > 0 ? '+' : '') + rm(signed)}</div>
      <p class="ak-detail-desc">${esc(e.description)}</p>
      <dl class="ak-dl">
        <dt>Tarikh</dt><dd>${fmtDate(e.date)}</dd>
        <dt>Sumber</dt><dd>${isPay ? 'Modul Jualan (automatik)' : 'Catatan manual'}</dd>
        ${e.category ? `<dt>Kategori</dt><dd>${esc(e.category)}</dd>` : ''}
        <dt>${e.kind === 'transfer' ? 'Dari / ke' : 'Akaun'}</dt><dd>${e.kind === 'transfer' ? esc((acc?.name || '?') + ' → ' + (to?.name || '?')) : acc ? esc(acc.name) : '<span class="ak-tag warn">Belum dipadankan</span>'}</dd>
        ${e.reference ? `<dt>Rujukan</dt><dd>${esc(e.reference)}</dd>` : ''}
        ${e.vehicleRef ? `<dt>Kereta</dt><dd>${esc(e.vehicleRef)}</dd>` : ''}
        ${e.reason ? `<dt>Sebab</dt><dd>${esc(e.reason)}</dd>` : ''}
        <dt>Status</dt><dd>${e.voided ? 'Dibatalkan' : e.reversalOf ? 'Entri pembatalan' : e.reviewed ? 'Disemak ✓' : 'Belum disemak'}</dd>
        ${e.kind === 'expense' || e.kind === 'income' ? `<dt>Resit</dt><dd>${e.receipts.length ? e.receipts.map(r => '📎 ' + esc(r)).join('<br>') : e.receiptExempt ? 'Dikecualikan: ' + esc(e.receiptExempt) : 'Tiada'}</dd>` : ''}
      </dl>
      ${isPay && !e.account ? `<label class="ak-inline">Padankan ke akaun<select data-map><option value="">Pilih akaun…</option>${state.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>` : ''}
      <div class="ak-detail-actions">
        ${!e.reviewed && !e.voided && !e.reversalOf ? '<button type="button" class="ak-btn primary" data-act="review">✓ Tandakan disemak</button>' : ''}
        ${!isPay && (e.kind === 'expense' || e.kind === 'income') && !e.voided && !e.reversalOf ? '<label class="ak-btn file">📎 Lampir resit<input type="file" accept="image/*,application/pdf" multiple data-act="receipt" hidden></label>' : ''}
        ${!isPay && e.kind === 'expense' && !e.receipts.length && !e.receiptExempt && !e.voided && !e.reversalOf ? '<button type="button" class="ak-btn" data-act="exempt">Tiada resit (nyatakan sebab)</button>' : ''}
        ${canVoid ? '<button type="button" class="ak-btn danger" data-act="void">Batalkan transaksi</button>' : ''}
      </div>
      ${isPay ? '<p class="ak-hint">Bayaran pelanggan datang daripada modul Jualan dan tidak boleh diubah di sini.</p>' : ''}
      ${trail.length ? `<div class="ak-trail"><h4>Jejak audit</h4>${trail.map(a => `<div><b>${esc(a.action)}</b>${a.detail ? ' · ' + esc(a.detail) : ''}<small>${new Date(a.at).toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' })} · ${esc(a.by)}</small></div>`).join('')}</div>` : ''}
    </div>`, m => {
      const after = msg => { save(state); closeModal(); draw(); toast(msg); };
      m.querySelector('[data-act="review"]')?.addEventListener('click', () => {
        if (isPay) state.paymentReviewed[e.paymentId] = true; else state.entries.find(x => x.id === e.id).reviewed = true;
        audit(e.id, 'Ditandakan disemak'); after('Transaksi ditandakan disemak.');
      });
      m.querySelector('[data-map]')?.addEventListener('change', ev => {
        if (!ev.target.value) return;
        state.paymentMap[e.paymentId] = ev.target.value;
        audit(e.id, 'Dipadankan ke akaun', state.accounts.find(a => a.id === ev.target.value)?.name);
        after('Bayaran dipadankan ke akaun.');
      });
      m.querySelector('[data-act="receipt"]')?.addEventListener('change', ev => {
        const names = [...ev.target.files].map(x => x.name); if (!names.length) return;
        const t = state.entries.find(x => x.id === e.id);
        const room = 5 - t.receipts.length; if (room <= 0) { toast('Maksimum 5 resit setiap transaksi.'); return; }
        t.receipts.push(...names.slice(0, room)); audit(e.id, 'Resit dilampirkan', names.slice(0, room).join(', ')); after('Resit dilampirkan.');
      });
      m.querySelector('[data-act="exempt"]')?.addEventListener('click', () => {
        const r = (prompt('Sebab tiada resit (contoh: bayaran tunai kepada individu):') || '').trim();
        if (r.length < 5) { if (r) toast('Sebab terlalu pendek.'); return; }
        state.entries.find(x => x.id === e.id).receiptExempt = r; audit(e.id, 'Pengecualian resit', r); after('Pengecualian resit direkodkan.');
      });
      m.querySelector('[data-act="void"]')?.addEventListener('click', () => {
        const r = (prompt('Sebab pembatalan (wajib):') || '').trim();
        if (r.length < 5) { if (r) toast('Sebab terlalu pendek.'); return; }
        const t = state.entries.find(x => x.id === e.id);
        const rev = { ...t, id: uid('TRX'), date: todayKL() < t.date ? t.date : todayKL(), amount: -t.amount, description: 'Pembatalan: ' + t.description, reversalOf: t.id, reason: r, receipts: [], receiptExempt: 'Entri pembatalan', reviewed: true, createdAt: new Date().toISOString() };
        state.entries.push(rev); audit(t.id, 'Dibatalkan', r); audit(rev.id, 'Entri pembatalan dicatat', 'Merujuk ' + t.description);
        after('Transaksi dibatalkan dengan entri songsang.');
      });
    });
  }

  function openAccounts() {
    const rowsAll = allRows(), today = todayKL();
    modal('Urus akaun', `<div class="ak-accmgr">
      ${state.accounts.map(a => `<div class="ak-accmgr-row"><div><strong>${esc(a.name)}</strong><small>${a.type === 'cash' ? 'Tunai' : 'Bank'} · Baki pembukaan ${rm(a.opening)} pada ${fmtDate(a.openingDate)} 🔒</small></div><b>${rm(balance(a, rowsAll, today))}</b></div>`).join('')}
      <p class="ak-hint">Baki pembukaan dikunci selepas ditetapkan. Untuk membetulkan baki, gunakan transaksi <b>Pelarasan baki</b> beserta sebab.</p>
      <form class="ak-form" data-newacc novalidate><h4>Tambah akaun</h4><div class="ak-fields">
        <label class="wide">Nama akaun<input name="name" maxlength="40" placeholder="Contoh: Akaun Bank Kedua" required></label>
        <label>Jenis<select name="type"><option value="bank">Bank</option><option value="cash">Tunai</option></select></label>
        <label>Baki pembukaan (RM)<input name="opening" inputmode="decimal" placeholder="0.00"></label>
        <label>Tarikh mula<input type="date" name="date" value="${today}" max="${today}"></label></div>
        <p class="ak-err" data-err role="alert"></p>
        <div class="ak-form-actions"><button type="submit" class="ak-btn primary">Tambah akaun</button></div></form></div>`, m => {
      m.querySelector('[data-newacc]').addEventListener('submit', ev => {
        ev.preventDefault(); const f = ev.target, err = m.querySelector('[data-err]');
        try {
          const name = f.name.value.trim(); if (name.length < 3) throw Error('Nama akaun terlalu pendek.');
          if (state.accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) throw Error('Nama akaun sudah wujud.');
          const opening = f.opening.value.trim() ? parseMoney(f.opening.value, false) : 0;
          if (!f.date.value) throw Error('Pilih tarikh mula.');
          const a = { id: uid('ACC'), name, type: f.type.value, opening, openingDate: f.date.value };
          state.accounts.push(a); audit(null, 'Akaun ditambah', name + ' · ' + rm(opening)); save(state); closeModal(); draw(); toast('Akaun "' + name + '" ditambah.');
        } catch (x) { err.textContent = x.message; }
      });
    });
  }

  function exportCsv() {
    const cell = v => { const s = String(v ?? ''); return '"' + (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"'; };
    const accName = id => state.accounts.find(a => a.id === id)?.name || '';
    const rows = allRows().filter(e => monthKey(e.date) === ui.month).sort((a, b) => a.date.localeCompare(b.date));
    const head = ['Tarikh', 'ID', 'Rujukan', 'Butiran', 'Jenis', 'Kategori', 'Sumber', 'Akaun', 'Ke akaun', 'Amaun (RM)', 'Pergerakan (RM)', 'Disemak', 'Resit', 'Status'];
    const body = rows.map(e => {
      const mv = e.kind === 'transfer' ? 0 : KINDS[e.kind].sign * e.amount;
      return [e.date, e.id, e.reference, e.description, KINDS[e.kind].label, e.category, e.source, e.account ? accName(e.account) : 'Belum dipadankan', e.toAccount ? accName(e.toAccount) : '', (e.amount / 100).toFixed(2), (mv / 100).toFixed(2), e.reviewed ? 'Ya' : 'Belum', e.receipts.length || (e.receiptExempt ? 'Dikecualikan' : '0'), e.voided ? 'Dibatalkan' : e.reversalOf ? 'Pembatalan' : 'Dicatat'];
    });
    const csv = '﻿' + [['DATA CONTOH — APIH AUTOMOBILE · ' + monthLabel(ui.month)], head, ...body].map(r => r.map(cell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'apih-akaun-' + ui.month + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('CSV ' + monthLabel(ui.month) + ' dimuat turun.');
  }

  window.ApihAccounting = { render };
})();
