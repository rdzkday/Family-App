/* Kantong — Tab Catat (halaman awal Kantong).
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ---------- Catat (home) ----------
var HomeView = {
  render: function (el) {
    el.innerHTML = fiturHead(longToday()) +
      '<div id="home-budget"></div>' +
      '<section class="section"><div class="entry" id="entry"></div></section>' +
      '<div id="home-utang"></div><div id="home-reim"></div>' +
      '<section class="section"><div class="section-h"><h2>Catatan hari ini</h2><span class="aside" id="today-total"></span></div><div id="today"></div></section>';
    txForm($('#entry', el), null, { allowAdd: true });
    this.update(el);
  },
  update: function (el) {
    var m = ensureMonth(thisMonth());
    var budgetEl = $('#home-budget', el), todayEl = $('#today', el);
    if (!m) { budgetEl.innerHTML = '<div class="skeleton"></div>'; todayEl.innerHTML = skeleton(2); return; }
    var d = db(), user = me();
    var mine = C.writableBuku(d, user);
    budgetEl.innerHTML = '<div class="hero"><div class="section-h" style="margin:0 0 14px"><h2>Jatah ' + BULAN[new Date().getMonth()] + ' tinggal segini</h2></div>' +
      mine.map(function (b, i) {
        var s = C.summarize(d, m.transaksi, m.budget, b.id);
        var used = s.budgetTotal ? Math.min(1, s.pengeluaran / s.budgetTotal) : 0;
        return '<div style="' + (i ? 'margin-top:16px' : '') + '"><div class="budget-head"><span class="muted" style="display:flex;align-items:center;gap:8px"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:' + bukuColor(b.id) + '"></span>' + (b.tipe === 'Bersama' ? esc(b.nama) : 'Pribadi') + '</span>' +
          '<span class="big num' + (s.sisaBudget < 0 ? ' over' : '') + '" style="font-size:18px">' + (s.budgetTotal ? rp(s.sisaBudget) : '<span class="faint" style="font-size:13px;font-weight:500">Budget belum diatur</span>') + '</span></div>' +
          (s.budgetTotal ? '<div class="meter' + (s.sisaBudget < 0 ? ' over' : '') + '" style="--c:' + bukuColor(b.id) + '"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div>' +
          '<div class="budget-foot"><span>Terpakai ' + rp(s.pengeluaran) + '</span><span>dari ' + rp(s.budgetTotal) + '</span></div>' : '') + '</div>';
      }).join('') + '</div>';
    var t = todayISO();
    var list = m.transaksi.filter(function (x) { return x.tanggal === t && mine.some(function (b) { return C.txInBuku(d, x, b.id); }); });
    var out = list.reduce(function (s, x) { return s + (isCounted(x) ? x.nominal : 0); }, 0);
    $('#today-total', el).textContent = out ? 'Keluar ' + rp(out) : '';
    todayEl.innerHTML = list.length ? '<div class="list">' + list.sort(function (a, b) { return String(b.dibuat || '9').localeCompare(String(a.dibuat || '9')); })
      .map(function (x) { return txRow(x, null); }).join('') + '</div>' : '<div class="list">' + emptyIl('kosong-transaksi', 'Hari ini masih bersih. Catat jajan pertamamu di atas.', { size: 'sm' }) + '</div>';
    bindTxRows(todayEl);
    renderTalangan($('#home-utang', el), null);
    var waits = [];
    Object.keys(S.months).forEach(function (b) { (S.months[b].transaksi || []).forEach(function (x) { if (reimStatus(x) === 'wait' && canWrite(x.buku)) waits.push(x); }); });
    waits.sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });
    var re = $('#home-reim', el);
    re.innerHTML = waits.length ? '<section class="section"><div class="section-h"><h2>Menunggu reimburse</h2><span class="aside">' + rp(waits.reduce(function (s, x) { return s + x.nominal; }, 0)) + '</span></div><div class="list">' +
      waits.slice(0, 5).map(function (x) { return txRow(x, null); }).join('') + '</div>' + (waits.length > 5 ? '<p class="faint" style="font-size:12px;text-align:center">+' + (waits.length - 5) + ' lainnya, lihat di Riwayat</p>' : '') + '</section>' : '';
    bindTxRows(re);
  }
};

// ---------- daftar halaman Kantong (shared/shell.js) ----------
daftarHalaman('kantong', [['home', 'Catat', HomeView], ['ringkasan', 'Ringkasan', RingkasanView], ['riwayat', 'Riwayat', RiwayatView]]);
