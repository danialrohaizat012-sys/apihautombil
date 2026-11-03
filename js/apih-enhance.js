/* Apih Automobile — lapisan UI tambahan untuk katalog awam.
   Dijalankan selepas katalog dipaparkan; tidak mengubah logik data atau Supabase. */
(() => {
  'use strict';
  const HOURS = 'Sabtu–Khamis · 9pg–6ptg';
  const RATE = 0.035; // kadar faedah flat anggaran setahun
  const TENURES = [5, 7, 9];
  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const money = n => 'RM ' + Math.max(0, Math.round(n)).toLocaleString('en-MY');
  const digits = t => Number(String(t || '').replace(/[^0-9]/g, '')) || 0;
  const icon = {
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z"/><path d="M9 8.5c0 3.5 2.5 6.5 6.5 6.8l1-1.6-2-1-1 .9c-1.2-.5-2.3-1.6-2.8-2.8l.9-1-1-2-1.6.7Z"/></svg>',
    calc: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/></svg>'
  };

  const host = () => document.getElementById('ada-cloud-gate') || document.body;

  function toast(text) {
    let t = document.getElementById('apih-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'apih-toast';
      t.setAttribute('role', 'status');
      host().appendChild(t);
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function clearGlobals() {
    $$(document, '[data-apih-global]').forEach(n => n.remove());
  }

  function waLink(box) {
    const a = $(box, 'a[href*="wa.me"]');
    return a ? a.href : '';
  }

  function openWhatsApp(box, carTitle) {
    const href = waLink(box);
    if (href) { window.open(href, '_blank', 'noopener'); return; }
    toast('Demo: butang ini akan terus buka WhatsApp jurujual Apih' + (carTitle ? ' untuk ' + carTitle : '') + '.');
  }

  /* ---------- Senarai katalog ---------- */
  function enhanceList(box) {
    const hero = $(box, '.ada-cat-hero');
    const countEl = $(box, '#ada-cat-count');
    const grid = $(box, '#ada-cat-grid');
    const tools = $(box, '.ada-cat-tools');
    if (!hero || !grid || !tools) return;
    box.classList.add('apih-list');

    // Chip maklumat di hero
    const total = digits(countEl && countEl.textContent);
    hero.querySelector('.apih-tagline')?.insertAdjacentHTML('afterend',
      `<div class="apih-hero-chips"><span class="live"><i></i>${total} unit sedia</span><span>${icon.clock}${HOURS}</span><span>${icon.shield}Pembiayaan mudah</span></div>`);

    // Penapis -> bottom sheet di telefon
    const sheet = document.createElement('div');
    sheet.className = 'apih-sheet';
    sheet.innerHTML = '<div class="apih-sheet-backdrop"></div><div class="apih-sheet-panel" role="dialog" aria-modal="true" aria-label="Tapis dan susun"><div class="apih-sheet-grip"></div><div class="apih-sheet-head"><h3>Tapis &amp; Susun</h3><button type="button" class="apih-sheet-close" aria-label="Tutup">✕</button></div><div class="apih-sheet-body"></div><div class="apih-sheet-actions"><button type="button" class="apih-sheet-reset">Reset</button><button type="button" class="apih-sheet-apply">Tunjuk kereta</button></div></div>';
    tools.before(sheet);
    $(sheet, '.apih-sheet-body').appendChild(tools);

    const toolbar = document.createElement('div');
    toolbar.className = 'apih-toolbar';
    toolbar.innerHTML = `<button type="button" class="apih-filter-btn">${icon.filter}<span>Tapis &amp; Susun</span><b hidden></b></button>`;
    sheet.before(toolbar);

    const openSheet = () => { sheet.classList.add('open'); document.documentElement.classList.add('apih-lock'); };
    const closeSheet = () => { sheet.classList.remove('open'); document.documentElement.classList.remove('apih-lock'); };
    $(toolbar, '.apih-filter-btn').onclick = openSheet;
    $(sheet, '.apih-sheet-backdrop').onclick = closeSheet;
    $(sheet, '.apih-sheet-close').onclick = closeSheet;
    $(sheet, '.apih-sheet-apply').onclick = () => { closeSheet(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $(sheet, '.apih-sheet-reset').onclick = () => $(box, '#ada-cat-reset')?.click();

    const syncCounts = () => {
      const n = digits(countEl.textContent);
      $(sheet, '.apih-sheet-apply').textContent = `Tunjuk ${n} kereta`;
      const active = ['#ada-cat-make', '#ada-cat-model', '#ada-cat-price'].filter(s => $(box, s)?.value).length + ($(box, '#ada-cat-sort')?.value !== 'new' ? 1 : 0);
      const b = $(toolbar, 'b');
      b.hidden = !active;
      b.textContent = active;
    };
    new MutationObserver(syncCounts).observe(countEl, { childList: true, characterData: true, subtree: true });
    $$(tools, 'select').forEach(s => s.addEventListener('change', syncCounts));
    syncCounts();

    // Animasi kad masuk + seluruh kad boleh ditekan
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('apih-in'); io.unobserve(e.target); } });
    }, { root: box, rootMargin: '0px 0px -6% 0px' }) : null;
    const prepCards = () => {
      $$(grid, '.ada-public-card:not([data-apih])').forEach((card, i) => {
        card.dataset.apih = '1';
        card.style.setProperty('--apih-delay', Math.min(i, 6) * 60 + 'ms');
        if (io) io.observe(card); else card.classList.add('apih-in');
        card.addEventListener('click', e => {
          if (e.target.closest('a,button')) return;
          $(card, 'a.ada-public-view')?.click();
        });
      });
    };
    new MutationObserver(prepCards).observe(grid, { childList: true });
    prepCards();

    // Dok terapung: kembali ke atas + WhatsApp
    clearGlobals();
    const dock = document.createElement('div');
    dock.className = 'apih-dock';
    dock.dataset.apihGlobal = '1';
    dock.innerHTML = `<button type="button" class="apih-dock-up" aria-label="Kembali ke atas">${icon.up}</button><button type="button" class="apih-dock-filter">${icon.filter}<span>Tapis</span></button><button type="button" class="apih-dock-wa">${icon.wa}<span>WhatsApp</span></button>`;
    host().appendChild(dock);
    $(dock, '.apih-dock-up').onclick = () => box.scrollTo({ top: 0, behavior: 'smooth' });
    $(dock, '.apih-dock-filter').onclick = openSheet;
    $(dock, '.apih-dock-wa').onclick = () => openWhatsApp(box);
    const onScroll = () => {
      const y = box.scrollTop;
      dock.classList.toggle('show', y > 260);
      box.classList.toggle('apih-scrolled', y > 24);
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Halaman detail kereta ---------- */
  function enhanceDetail(box) {
    const copy = $(box, '.ada-public-detail-copy');
    if (!copy) return;
    box.classList.add('apih-detail');
    const title = ($(box, '.ada-public-detail-copy h1')?.textContent || '').trim();
    const priceEl = $(box, '.ada-public-detail-price strong');
    const price = digits(priceEl && priceEl.textContent);
    const statusTxt = ($(box, '.ada-public-detail-copy .ada-public-eyebrow')?.textContent || '').trim().toLowerCase();
    const sold = statusTxt === 'sold';

    // Butang kembali terapung di atas gambar
    const photo = $(box, '.ada-public-main-photo');
    if (photo) {
      photo.insertAdjacentHTML('beforeend', `<button type="button" class="apih-photo-back" aria-label="Semua kereta">${icon.back}</button>`);
      $(photo, '.apih-photo-back').onclick = () => $(box, '#ada-cat-back')?.click();
    }

    // Kalkulator ansuran
    if (price > 0 && !sold) {
      const maxDep = Math.round(price * 0.3 / 500) * 500;
      const defDep = Math.round(price * 0.1 / 500) * 500;
      const calc = document.createElement('section');
      calc.className = 'apih-calc';
      calc.innerHTML = `
        <div class="apih-calc-head">${icon.calc}<div><h3>Kira Ansuran Bulanan</h3><small>Anggaran sahaja · kadar ${(RATE * 100).toFixed(1)}% setahun (flat)</small></div></div>
        <div class="apih-calc-result"><span>Anggaran bulanan</span><strong data-out>—</strong><small data-loan></small></div>
        <label class="apih-calc-row"><span>Deposit <b data-dep></b></span><input type="range" min="0" max="${maxDep}" step="500" value="${defDep}" data-in-dep aria-label="Deposit"></label>
        <div class="apih-calc-row"><span>Tempoh</span><div class="apih-calc-tenure">${TENURES.map(y => `<button type="button" data-y="${y}" class="${y === 9 ? 'on' : ''}">${y} tahun</button>`).join('')}</div></div>`;
      const anchor = $(box, '.ada-public-trust') || priceEl?.closest('.ada-offer-price');
      (anchor || copy.firstElementChild).after(calc);
      let years = 9, shown = 0, raf = 0;
      const out = $(calc, '[data-out]');
      const animateTo = target => {
        cancelAnimationFrame(raf);
        const from = shown, t0 = performance.now();
        const step = t => {
          const k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3);
          shown = from + (target - from) * e;
          out.textContent = money(shown);
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      };
      const update = () => {
        const dep = Number($(calc, '[data-in-dep]').value);
        const loan = Math.max(0, price - dep);
        const monthly = loan * (1 + RATE * years) / (years * 12);
        $(calc, '[data-dep]').textContent = money(dep);
        $(calc, '[data-loan]').textContent = `Pinjaman ${money(loan)} · ${years} tahun`;
        const r = $(calc, '[data-in-dep]');
        r.style.setProperty('--p', (maxDep ? dep / maxDep * 100 : 0) + '%');
        animateTo(monthly);
      };
      $(calc, '[data-in-dep]').addEventListener('input', update);
      $$(calc, '[data-y]').forEach(b => b.onclick = () => {
        years = Number(b.dataset.y);
        $$(calc, '[data-y]').forEach(x => x.classList.toggle('on', x === b));
        update();
      });
      update();
    }

    // Bar tindakan melekat di bawah
    clearGlobals();
    const bar = document.createElement('div');
    bar.className = 'apih-buybar';
    bar.dataset.apihGlobal = '1';
    const monthlyTxt = ($(box, '.ada-public-detail-price small')?.textContent || '').trim();
    bar.innerHTML = `<div class="apih-buybar-price"><small>${sold ? 'Telah dijual' : 'Harga'}</small><strong>${price ? money(price) : '—'}</strong>${monthlyTxt ? `<em>${monthlyTxt}</em>` : ''}</div><button type="button" class="apih-buybar-wa" ${sold ? 'disabled' : ''}>${icon.wa}<span>${sold ? 'Unit telah dijual' : 'WhatsApp Jurujual'}</span></button>`;
    host().appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('show'));
    $(bar, '.apih-buybar-wa').onclick = () => openWhatsApp(box, title);
  }

  function check() {
    const box = document.getElementById('ada-public-catalogue');
    if (!box) { clearGlobals(); return; }
    if (box.dataset.apih) return;
    box.dataset.apih = '1';
    if ($(box, '#ada-cat-grid')) enhanceList(box);
    else if ($(box, '.ada-public-detail')) enhanceDetail(box);
    else clearGlobals();
  }

  const start = () => {
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
    check();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
