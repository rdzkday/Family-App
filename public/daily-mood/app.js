(function(){
  // fitur dimatikan admin → tutup halaman (shared/fitur.js)
  if (!window.Fitur.jaga('mood')) return;
  // tema dari Beranda › Pengaturan (sama untuk semua halaman)
  try { if (JSON.parse(localStorage.getItem('k_theme')) === 'light') document.documentElement.setAttribute('data-theme', 'light'); } catch (e) {}
  const KEY = window.DM_DATA.KEY;
  const MOODS = [
    {v:1,label:'Berat',c:'var(--m1)',hex:'#F0646B'},
    {v:2,label:'Kurang',c:'var(--m2)',hex:'#FF9F43'},
    {v:3,label:'Biasa',c:'var(--m3)',hex:'#F4CF4C'},
    {v:4,label:'Baik',c:'var(--m4)',hex:'#5CC98B'},
    {v:5,label:'Sangat baik',c:'var(--m5)',hex:'#3BB3C9'}
  ];
  const EMO_POS = ['Senang','Tenang','Bersyukur','Bangga','Lega','Semangat'];
  const EMO_NEG = ['Cemas','Sedih','Lelah','Kesal','Marah','Kecewa','Kesepian','Bingung','Takut'];
  const { AGES, BASE_TAGS, CONDITIONS } = window.DM_DATA;
  const BANK = {
    any:['Satu hal kecil yang kamu syukuri hari ini?','Apa yang paling menyita pikiranmu hari ini?','Kalau hari ini punya judul, apa judulnya?','Apa yang tubuhmu rasakan sekarang?','Siapa yang kamu temui hari ini, dan bagaimana rasanya?','Hal apa yang ingin kamu lepaskan sebelum tidur?','Apa satu hal yang kamu lakukan dengan baik hari ini?','Apa yang kamu butuhkan tapi belum kamu dapatkan?'],
    low:['Apa yang terjadi sebelum perasaan ini muncul?','Apa yang biasanya sedikit membantu saat kamu merasa seperti ini?','Kalau temanmu merasakan hal yang sama, apa yang akan kamu katakan padanya?','Pikiran apa yang paling sering muncul hari ini?'],
    high:['Apa yang membuat hari ini terasa lebih ringan?','Momen apa yang ingin kamu ingat dari hari ini?','Siapa yang berperan membuat harimu baik?']
  };

  const pad = n => String(n).padStart(2,'0');
  const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); };
  const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const fmtLong = s => { const d = parse(s); return HARI[d.getDay()]+', '+d.getDate()+' '+BULAN[d.getMonth()]+' '+d.getFullYear(); };
  const fmtShort = s => { const d = parse(s); return d.getDate()+' '+BULAN[d.getMonth()].slice(0,3); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq = a => a.filter((x,i) => a.indexOf(x) === i);
  // `let` supaya tanggal ikut ganti kalau app dibiarkan terbuka lewat tengah malam
  let todayIso = iso(new Date());

  // mulai kosong (tanpa data contoh)
  function fresh(){ return {profile:null, entries:{}, custom:[], randomToo:true, demo:false}; }

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || null; } catch(e){ state = null; }
  if (!state) state = fresh();
  if (state.demo) { state.entries = {}; state.demo = false; }   // data contoh versi lama di HP dibuang
  function simpanLokal(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){ toast('Gagal menyimpan, memori perangkat penuh?'); } }
  function save(){ simpanLokal(); antreKirim(); }

  // ================= Sinkron ke Supabase (pribadi) =================
  // Pakai kode koneksi yang sama dengan Beranda/Kantong. Satu baris per hari + satu baris pengaturan.
  // Perubahan masuk antrean dulu (jalan offline), dikirim saat online. Data contoh tidak pernah dikirim.
  const RC_CONN = (() => { try { return JSON.parse(localStorage.getItem('k_conn')); } catch (e) { return null; } })();
  const RC_USER = (() => { try { const b = JSON.parse(localStorage.getItem('k_boot')); return b && b.user ? b.user.id : ''; } catch (e) { return ''; } })();
  const REMOTE = !!(RC_CONN && RC_CONN.mode === 'remote' && RC_USER);
  const SYNC_KEY = window.DM_DATA.SYNC_KEY;
  let sy = { snap: {}, outbox: [], at: 0 };
  try { sy = Object.assign(sy, JSON.parse(localStorage.getItem(SYNC_KEY)) || {}); } catch (e) {}
  function sySave(){ try { localStorage.setItem(SYNC_KEY, JSON.stringify(sy)); } catch (e) {} }
  // keadaan lokal sebagai peta kunci -> JSON (yang dibandingkan dengan snapshot terakhir dari server)
  function petaLokal(){
    const m = {};
    if (state.profile) m._pengaturan = window.DM_DATA.pengaturanIsi(state);
    if (!state.demo) Object.keys(state.entries || {}).forEach(k => { m[k] = JSON.stringify(state.entries[k]); });
    return m;
  }
  function antreKirim(){
    if (!REMOTE) return;
    const lokal = petaLokal(), ops = {};
    sy.outbox.forEach(o => { ops[o.k] = o; });
    Object.keys(lokal).forEach(k => { if (lokal[k] !== sy.snap[k]) { ops[k] = { k, action: 'jurnal.save', isi: lokal[k] }; sy.snap[k] = lokal[k]; } });
    Object.keys(sy.snap).forEach(k => {
      if (lokal[k] !== undefined) return;
      if (k === '_pengaturan' && !state.profile && !ops[k]) return;
      if (state.demo && k !== '_pengaturan') return;     // entri asli disembunyikan sementara oleh data contoh? jangan hapus
      ops[k] = { k, action: 'jurnal.delete' }; delete sy.snap[k];
    });
    sy.outbox = Object.keys(ops).map(k => ops[k]);
    sySave();
    kirim();
  }
  function rcRpc(action, payload){
    return fetch(RC_CONN.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: RC_CONN.token, action, payload: payload || {} }) })
      .then(r => { if (!r.ok) throw new Error('Server ' + r.status); return r.json(); })
      .then(j => { if (!j.ok) { const e = new Error(j.error || 'Gagal'); e.server = true; throw e; } return j.data; });
  }
  let sedangKirim = false, ulang = false;
  function kirim(tarik){
    if (!REMOTE) return Promise.resolve();
    if (sedangKirim) { ulang = true; return Promise.resolve(); }
    sedangKirim = true;
    const ops = sy.outbox.slice();
    const batch = ops.map((o, i) => ({ opId: 'o' + i, action: o.action, payload: o.action === 'jurnal.save' ? { id: RC_USER + '|' + o.k, isi: o.isi } : { id: RC_USER + '|' + o.k } }));
    if (tarik) batch.push({ opId: '_list', action: 'jurnal.list' });
    if (!batch.length) { sedangKirim = false; return Promise.resolve(); }
    return rcRpc('batch', { ops: batch }).then(d => {
      const terkirim = {};
      d.results.forEach(r => {
        if (r.opId === '_list') { if (r.ok) gabung(r.data.jurnal || []); return; }
        const o = ops[Number(r.opId.slice(1))];
        if (r.ok) terkirim[o.k] = o; else toast('Gagal sinkron: ' + r.error);
      });
      sy.outbox = sy.outbox.filter(o => terkirim[o.k] !== o);
      sy.at = Date.now(); sySave(); tandaSinkron();
    }).catch(() => { tandaSinkron(true); }).then(() => {
      sedangKirim = false;
      if (ulang) { ulang = false; kirim(); }
    });
  }
  // terapkan data server ke HP. Yang masih antre di HP menang (belum sempat terkirim).
  function gabung(rows){
    const antre = {}; sy.outbox.forEach(o => { antre[o.k] = 1; });
    const server = {};
    rows.forEach(r => { const k = String(r.id).slice(RC_USER.length + 1); server[k] = r.isi; });
    let berubah = false;
    Object.keys(server).forEach(k => {
      if (antre[k] || server[k] === sy.snap[k]) return;
      let v; try { v = JSON.parse(server[k]); } catch (e) { return; }
      if (k === '_pengaturan') { state.profile = v.profile || state.profile; state.custom = v.custom || []; state.randomToo = v.randomToo !== false; state.lastBackup = v.lastBackup || ''; }
      else { if (state.demo) { state.entries = {}; state.demo = false; } state.entries[k] = v; }
      sy.snap[k] = server[k]; berubah = true;
    });
    Object.keys(sy.snap).forEach(k => {          // dihapus dari HP lain
      if (server[k] !== undefined || antre[k] || k === '_pengaturan') return;
      delete state.entries[k]; delete sy.snap[k]; berubah = true;
    });
    if (berubah) { simpanLokal(); render(); }
  }
  function tandaSinkron(gagal){
    const el = document.querySelector('.lock'); if (!el) return;
    const ic = el.querySelector('svg') ? el.querySelector('svg').outerHTML : '';
    el.innerHTML = ic + (!REMOTE ? 'Hanya di perangkat ini' : gagal || sy.outbox.length ? 'Belum terkirim · ' + sy.outbox.length : 'Tersimpan · hanya kamu');
  }


  // Minta browser tidak menghapus data otomatis (terutama Safari/iPhone)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}

  // ?tab=berdua atau #berdua (dari Pengaturan) membuka Couple Journaling
  let tab = (new URLSearchParams(location.search).get('tab') === 'berdua' || location.hash === '#berdua') ? 'berdua' : 'today';
  let onboardStep = 0;
  let draftProfile = {name:'', age:'', conditions:[], extraTags:[]};
  let calMonth = new Date(); calMonth.setDate(1);
  let selDay = todayIso;
  let calMode = 'view';
  let sum = {from: iso(addDays(new Date(),-6)), to: todayIso, sel:{}};
  let stepIdx = 0;
  let randomPrompt = null;

  const view = document.getElementById('view');
  const tabsEl = document.getElementById('tabs');
  const toastEl = document.getElementById('toast');
  let toastT;
  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>toastEl.classList.remove('show'), 1800); }

  function face(v){
    const m = MOODS[v-1];
    const mouths = {1:'M14 31 Q24 23 34 31',2:'M15 30 Q24 26 33 30',3:'M15 29 L33 29',4:'M14 27 Q24 34 34 27',5:'M13 26 Q24 38 35 26 Z'};
    const brows = v===1 ? '<path d="M12 15 L19 17 M36 15 L29 17" stroke="var(--face)" stroke-width="2.4" stroke-linecap="round"/>' : '';
    const cheeks = v>=4 ? '<circle cx="12" cy="26" r="3" fill="#fff" opacity=".35"/><circle cx="36" cy="26" r="3" fill="#fff" opacity=".35"/>' : '';
    const eyes = v===5 ? '<path d="M14 20 Q17 16 20 20 M28 20 Q31 16 34 20" stroke="var(--face)" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : '<circle cx="17" cy="20" r="2.6" fill="var(--face)"/><circle cx="31" cy="20" r="2.6" fill="var(--face)"/>';
    const mouth = v===5 ? '<path d="'+mouths[5]+'" fill="var(--face)"/>' : '<path d="'+mouths[v]+'" stroke="var(--face)" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 C36 3 45 11 45 24 C45 37 36 45 24 45 C11 45 3 37 3 24 C3 11 12 3 24 3Z" fill="'+m.c+'"/>'+cheeks+brows+eyes+mouth+'</svg>';
  }

  function influenceTags(p){
    if (!p) return BASE_TAGS;
    let t = [];
    CONDITIONS.forEach(g => g.items.forEach(it => { if (p.conditions.includes(it.id)) t = t.concat(it.tags); }));
    return uniq(t.concat(BASE_TAGS, p.extraTags || []));
  }

  function pickRandom(mood){
    let pool = BANK.any.slice();
    if (mood && mood <= 2) pool = pool.concat(BANK.low, BANK.low);
    if (mood && mood >= 4) pool = pool.concat(BANK.high, BANK.high);
    let p; do { p = pool[Math.floor(Math.random()*pool.length)]; } while (pool.length > 1 && p === randomPrompt);
    return p;
  }

  function promptSteps(entry){
    const steps = state.custom.slice();
    if (state.randomToo || !steps.length){
      if (!randomPrompt){
        const prev = entry && entry.answers.find(a => !state.custom.includes(a.prompt));
        randomPrompt = prev ? prev.prompt : pickRandom(entry && entry.mood);
      }
      steps.push(randomPrompt);
    }
    return steps;
  }


  function conditionPicker(p){
    return CONDITIONS.map(g => {
      const items = g.items.filter(it => !it.ages || it.ages.includes(p.age) || p.conditions.includes(it.id));
      return '<div class="card"><h3>'+g.group+'</h3><div class="chips">'+items.map(it => '<button type="button" class="chip" data-cond="'+it.id+'" aria-pressed="'+p.conditions.includes(it.id)+'">'+esc(it.label)+'</button>').join('')+'</div></div>';
    }).join('');
  }
  function extraTagEditor(p){
    const list = (p.extraTags||[]).map((t,i) => '<button type="button" class="chip" data-rmtag="'+i+'" aria-label="Hapus '+esc(t)+'" aria-pressed="true">'+esc(t)+' ×</button>').join('');
    return '<div class="card"><h3>Ada hal lain yang sering memengaruhi?</h3><div class="chips">'+(list||'<span class="small muted">Belum ada.</span>')+'</div><div class="row"><input type="text" id="newTag" placeholder="Contoh: Hobi, Ibadah, Hewan peliharaan" style="flex:1;min-width:160px"><button type="button" class="btn sm" data-act="add-tag">Tambah</button></div></div>';
  }

  function renderOnboard(){
    tabsEl.classList.add('hidden');
    const p = draftProfile;
    if (onboardStep === 0){
      view.innerHTML = '<div class="hero">'+ilus('onboarding-05-daily-mood','lg')+'<h2>Kenalan dulu</h2><p class="muted">Dua pertanyaan singkat supaya pilihan di aplikasi pas dengan kondisimu. '+(REMOTE ? 'Tersimpan di akunmu, hanya kamu yang bisa membaca.' : 'Semua tersimpan di perangkat ini.')+'</p></div>' +
        '<div class="card"><label for="nm"><h3>Mau dipanggil siapa?</h3></label><input type="text" id="nm" value="'+esc(p.name)+'" placeholder="Opsional"></div>' +
        '<div class="card"><h3>Usia kamu</h3><div class="age">'+AGES.map(a => '<button type="button" class="chip" data-age="'+a+'" aria-pressed="'+(p.age===a)+'">'+a+'</button>').join('')+'</div></div>' +
        '<button type="button" class="btn wide" data-act="ob-next" '+(p.age?'':'disabled')+'>Lanjut</button>';
    } else {
      view.innerHTML = '<div><span class="tag">Langkah 2 dari 2</span><h1>Apa yang sedang kamu jalani?</h1><p class="muted small">Pilih semua yang sesuai. Ini menentukan pilihan "apa yang memengaruhi" di catatan harianmu, dan bisa diubah kapan saja di Beranda › Pengaturan › Daily Mood.</p></div>' +
        conditionPicker(p) + extraTagEditor(p) +
        '<div class="row"><button type="button" class="btn ghost" data-act="ob-back">Kembali</button><button type="button" class="btn" style="flex:1" data-act="ob-done">Mulai mencatat</button></div>';
    }
  }

  function greeting(){
    const h = new Date().getHours();
    const g = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    return g + (state.profile && state.profile.name ? ', '+esc(state.profile.name) : '');
  }

  function renderToday(){
    const e = state.entries[todayIso];
    let html = '<div><p class="muted small">'+fmtLong(todayIso)+'</p><h2 class="greet">'+greeting()+'</h2></div>' +
      '<div class="card"><h3>Gimana perasaanmu hari ini?</h3><div class="moods" role="group" aria-label="Pilih mood">' +
      MOODS.map(m => '<button type="button" class="mood'+(e && e.mood!==m.v ? ' dim' : '')+'" data-mood="'+m.v+'" aria-pressed="'+(!!e && e.mood===m.v)+'">'+face(m.v)+m.label+'</button>').join('') +
      '</div><p class="small muted">'+(e ? 'Tersimpan. Sisanya opsional, isi kalau mau.' : 'Satu ketukan sudah cukup.')+'</p></div>';
    if (e){
      const emos = e.mood >= 4 ? EMO_POS.concat(EMO_NEG) : e.mood <= 2 ? EMO_NEG.concat(EMO_POS) : EMO_NEG.slice(0,3).concat(EMO_POS, EMO_NEG.slice(3));
      html += '<div class="card"><h3>Emosi yang muncul</h3><div class="chips">'+emos.map(x => '<button type="button" class="chip emo" data-emo="'+x+'" aria-pressed="'+e.emotions.includes(x)+'">'+x+'</button>').join('')+'</div></div>';
      html += '<div class="card"><h3>Apa yang memengaruhi?</h3><div class="chips">'+influenceTags(state.profile).map(x => '<button type="button" class="chip" data-tag="'+esc(x)+'" aria-pressed="'+e.tags.includes(x)+'">'+esc(x)+'</button>').join('')+'</div></div>';
      const steps = promptSteps(e);
      if (stepIdx >= steps.length) stepIdx = steps.length - 1;
      const cur = steps[stepIdx];
      const isRandom = cur === randomPrompt && !state.custom.includes(cur);
      const ans = (e.answers.find(a => a.prompt === cur) || {}).text || '';
      const dots = steps.map((s,i) => { const done = e.answers.some(a => a.prompt===s && a.text); return '<span class="'+(i===stepIdx?'on':done?'done':'')+'"></span>'; }).join('');
      html += '<div class="card"><div class="row between"><span class="tag">'+(isRandom ? 'Prompt acak' : 'Prompt pilihanmu')+(steps.length>1 ? ' · '+(stepIdx+1)+' dari '+steps.length : '')+'</span>'+(isRandom ? '<button type="button" class="btn ghost sm" data-act="shuffle">Acak lagi</button>' : '')+'</div>' +
        '<p class="prompt">'+esc(cur)+'</p>' +
        '<textarea id="ans" aria-label="Jawabanmu" placeholder="Satu kalimat juga cukup…">'+esc(ans)+'</textarea>' +
        '<div class="row between">'+(steps.length>1 ? '<div class="stepper" aria-hidden="true">'+dots+'</div>' : '<span></span>') +
        '<div class="row">'+(stepIdx>0 ? '<button type="button" class="btn ghost sm" data-act="step-prev">Sebelumnya</button>' : '') +
        (stepIdx < steps.length-1 ? '<button type="button" class="btn sm" data-act="step-next">Berikutnya</button>' : '<button type="button" class="btn sm" data-act="step-done">Selesai</button>')+'</div></div></div>';
    }
    view.innerHTML = html;
  }

  function entryFirstText(e){ const a = e.answers.find(x => x.text); return a ? a.text : ''; }

  function renderCalendar(){
    if (calMode === 'pick') return renderPick();
    if (calMode === 'summary') return renderSummary();
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y,m,1).getDay(), days = new Date(y,m+1,0).getDate();
    let cells = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d=>'<div class="dow">'+d+'</div>').join('');
    for (let i=0;i<first;i++) cells += '<div class="day pad"></div>';
    for (let d=1; d<=days; d++){
      const k = y+'-'+pad(m+1)+'-'+pad(d), e = state.entries[k];
      const cls = ['day']; if (k===todayIso) cls.push('today'); if (k===selDay) cls.push('sel');
      const lbl = d+' '+BULAN[m]+(e ? ', mood '+MOODS[e.mood-1].label : ', tidak ada catatan');
      cells += '<button type="button" class="'+cls.join(' ')+'" data-day="'+k+'" aria-label="'+lbl+'">'+(e ? face(e.mood)+'<span class="n">'+d+'</span>' : d)+'</button>';
    }
    const se = state.entries[selDay];
    const detail = se
      ? '<div class="entry"><span class="face">'+face(se.mood)+'</span><div class="body"><b>'+fmtLong(selDay)+'</b><span class="small muted">'+MOODS[se.mood-1].label+(se.emotions.length?' · '+se.emotions.join(', '):'')+'</span>' +
        (se.tags.length ? '<div class="chips">'+se.tags.map(t=>'<span class="chip" style="cursor:default">'+esc(t)+'</span>').join('')+'</div>' : '') +
        (se.answers.filter(a=>a.text).map(a => '<div class="qa"><i>'+esc(a.prompt)+'</i><span>'+esc(a.text)+'</span></div>').join('') || '<p class="small muted">Hanya mood, tanpa tulisan.</p>') + '</div></div>'
      : '<p class="muted">'+fmtLong(selDay)+': belum ada catatan. Tidak apa-apa.</p>';
    view.innerHTML =
      '<div class="card"><div class="calhead"><button type="button" class="iconbtn" data-act="prev" aria-label="Bulan sebelumnya">‹</button><h2>'+BULAN[m]+' '+y+'</h2><button type="button" class="iconbtn" data-act="next" aria-label="Bulan berikutnya">›</button></div><div class="cal">'+cells+'</div></div>' +
      '<button type="button" class="btn wide" data-act="start-sum">Buat rangkuman</button>' +
      '<div class="card">'+detail+'</div>';
  }

  function rangeEntries(){ return Object.values(state.entries).filter(e => e.date >= sum.from && e.date <= sum.to).sort((a,b)=>a.date<b.date?-1:1); }
  function selectedEntries(){ return rangeEntries().filter(e => sum.sel[e.date]); }

  function renderPick(){
    const es = rangeEntries();
    es.forEach(e => { if (!(e.date in sum.sel)) sum.sel[e.date] = true; });
    const n = es.filter(e => sum.sel[e.date]).length;
    const items = es.length ? es.map(e => { const t = entryFirstText(e); return '<label class="chk"><input type="checkbox" data-sel="'+e.date+'" '+(sum.sel[e.date]?'checked':'')+'><span class="entry"><span class="face">'+face(e.mood)+'</span><span class="body"><b>'+fmtLong(e.date)+'</b><span class="small muted">'+(e.emotions.length?e.emotions.join(', '):MOODS[e.mood-1].label)+'</span>'+(t?'<span class="small">'+esc(t.slice(0,80))+(t.length>80?'…':'')+'</span>':'')+'</span></span></label>'; }).join('')
      : '<p class="muted small">Tidak ada catatan di rentang ini.</p>';
    view.innerHTML = '<div class="row between"><button type="button" class="btn ghost sm" data-act="back-cal">‹ Kalender</button><span class="tag">Langkah 1 dari 2</span></div>' +
      '<div><h1>Pilih catatan untuk dirangkum</h1><p class="muted small">Hanya catatan yang dicentang yang masuk ke rangkuman.</p></div>' +
      '<div class="card"><div class="row"><div style="flex:1;min-width:130px"><label for="from" class="small muted">Dari</label><input type="date" id="from" value="'+sum.from+'" max="'+todayIso+'"></div><div style="flex:1;min-width:130px"><label for="to" class="small muted">Sampai</label><input type="date" id="to" value="'+sum.to+'" max="'+todayIso+'"></div></div></div>' +
      '<div class="card"><div class="row between"><h3>'+es.length+' catatan</h3>'+(es.length?'<button type="button" class="btn ghost sm" data-act="toggle-all">'+(n===es.length?'Kosongkan':'Pilih semua')+'</button>':'')+'</div><div>'+items+'</div></div>' +
      '<button type="button" class="btn wide" data-act="make-sum" '+(n?'':'disabled')+'>Buat rangkuman ('+n+' catatan)</button>';
  }

  function analyze(){
    const es = selectedEntries();
    const totalDays = Math.round((parse(sum.to) - parse(sum.from))/864e5) + 1;
    const avg = es.length ? es.reduce((s,e)=>s+e.mood,0)/es.length : 0;
    let trend = 'Belum cukup catatan untuk melihat arah.';
    if (es.length >= 4){
      const h = Math.floor(es.length/2);
      const a1 = es.slice(0,h).reduce((s,e)=>s+e.mood,0)/h, a2 = es.slice(h).reduce((s,e)=>s+e.mood,0)/(es.length-h);
      trend = a2 - a1 > 0.4 ? 'Mood cenderung membaik di paruh kedua.' : a1 - a2 > 0.4 ? 'Mood cenderung menurun di paruh kedua.' : 'Mood cenderung stabil sepanjang rentang ini.';
    }
    const minM = Math.min(...es.map(e=>e.mood)), maxM = Math.max(...es.map(e=>e.mood));
    const hardest = es.filter(e => e.mood===minM).map(e=>e.date);
    const best = es.filter(e => e.mood===maxM).map(e=>e.date);
    const count = arr => { const c = {}; arr.forEach(x => c[x]=(c[x]||0)+1); return Object.entries(c).sort((a,b)=>b[1]-a[1]); };
    const emos = count([].concat(...es.map(e=>e.emotions)));
    const tags = count([].concat(...es.map(e=>e.tags)));
    const dist = MOODS.map(m => es.filter(e=>e.mood===m.v).length);
    return {es, totalDays, avg, trend, hardest, best, emos, tags, dist};
  }

  function renderSummary(){
    const a = analyze();
    const avgMood = MOODS[Math.max(0, Math.round(a.avg)-1)];
    const maxE = a.emos.length ? a.emos[0][1] : 1;
    const days = []; for (let d = parse(sum.from); iso(d) <= sum.to; d = addDays(d,1)) days.push(iso(d));
    const W = 360, H = 120, step = W/days.length, bw = Math.max(4, Math.min(26, step-6));
    const bars = days.map((k,i) => { const e = a.es.find(x=>x.date===k); const x = i*step + (step-bw)/2; const h = e ? 14 + (e.mood-1)*20 : 6; const lbl = (days.length<=14 || i%Math.ceil(days.length/10)===0) ? '<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-2)+'" font-size="10" text-anchor="middle" fill="var(--muted)">'+parse(k).getDate()+'</text>' : ''; return '<rect x="'+x.toFixed(1)+'" y="'+(H-16-h)+'" width="'+bw.toFixed(1)+'" height="'+h+'" rx="'+Math.min(6,bw/2)+'" fill="'+(e?MOODS[e.mood-1].c:'var(--line)')+'"/>'+lbl; }).join('');
    const timeline = a.es.map(e => { const d = parse(e.date); const txts = e.answers.filter(x=>x.text); return '<div class="ev"><div class="d"><b>'+d.getDate()+'</b>'+BULAN[d.getMonth()].slice(0,3)+'</div><div class="entry"><span class="face" style="width:28px;height:28px">'+face(e.mood)+'</span><div class="body"><span class="small muted">'+MOODS[e.mood-1].label+(e.emotions.length?' · '+e.emotions.join(', '):'')+(e.tags.length?' · '+e.tags.map(esc).join(', '):'')+'</span>'+(txts.length ? txts.map(x=>'<span>'+esc(x.text)+'</span>').join('') : '<span class="small muted">Tanpa tulisan.</span>')+'</div></div></div>'; }).join('');
    const canShareText = !!navigator.share;
    view.innerHTML = '<div class="row between"><button type="button" class="btn ghost sm" data-act="back-pick">‹ Ubah pilihan</button><span class="tag">Langkah 2 dari 2</span></div>' +
      '<div><p class="muted small">'+fmtLong(sum.from)+' – '+fmtLong(sum.to)+'</p><h1>Rangkumanmu</h1></div>' +
      '<div class="card"><h3>Mood selama rentang ini</h3><div class="row" style="gap:14px"><span class="face" style="width:64px;height:64px;display:block">'+face(avgMood.v)+'</span><div><div class="big">'+a.avg.toFixed(1).replace('.',',')+'<span class="muted" style="font-size:1rem"> / 5</span></div><p class="small muted">Rata-rata: '+avgMood.label+'</p></div></div>' +
      '<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Mood per hari">'+bars+'</svg>' +
      '<p>'+a.trend+'</p>' +
      '<div class="stats"><div class="stat"><span class="small muted">Dicatat</span><b>'+a.es.length+'/'+a.totalDays+'</b><span class="small muted">hari</span></div><div class="stat"><span class="small muted">Hari terberat</span><b>'+a.hardest.slice(0,2).map(fmtShort).join(', ')+'</b></div><div class="stat"><span class="small muted">Hari terbaik</span><b>'+a.best.slice(0,2).map(fmtShort).join(', ')+'</b></div></div></div>' +
      '<div class="card"><h3>Emosi yang sering muncul</h3>'+(a.emos.length ? '<div class="bars">'+a.emos.slice(0,6).map(([k,v]) => '<div class="bar"><span>'+k+'</span><span class="t"><i style="width:'+Math.round(v/maxE*100)+'%"></i></span><span class="c">'+v+'×</span></div>').join('')+'</div>' : '<p class="small muted">Belum ada emosi yang dicatat.</p>')+'</div>' +
      '<div class="card"><h3>Yang paling memengaruhi</h3>'+(a.tags.length ? '<div class="chips">'+a.tags.slice(0,6).map(([k,v]) => '<span class="chip" style="cursor:default">'+esc(k)+' · '+v+'</span>').join('')+'</div>' : '<p class="small muted">Belum ada yang dicatat.</p>')+'</div>' +
      '<div class="card"><h3>Kejadian yang kamu lewati</h3><div class="tl">'+timeline+'</div></div>' +
      '<div class="card"><h3>Simpan atau kirim</h3><button type="button" class="btn wide" data-act="pdf">Unduh / bagikan PDF</button>' +
      (canShareText ? '<button type="button" class="btn ghost wide" data-act="share-text">Bagikan sebagai teks</button>' : '') +
      '<button type="button" class="btn ghost wide" data-act="copy">Salin sebagai teks</button><p class="small muted">Kirim file atau teksnya ke psikologmu lewat WA atau email.</p></div>';
  }

  function summaryText(){
    const a = analyze();
    const L = ['RANGKUMAN CATATAN', fmtLong(sum.from)+' - '+fmtLong(sum.to), '', 'MOOD', 'Rata-rata '+a.avg.toFixed(1)+' dari 5 ('+MOODS[Math.max(0,Math.round(a.avg)-1)].label+'). Dicatat '+a.es.length+' dari '+a.totalDays+' hari.', a.trend, 'Hari terberat: '+a.hardest.map(fmtShort).join(', ')+'. Hari terbaik: '+a.best.map(fmtShort).join(', ')+'.', ''];
    L.push('EMOSI YANG SERING MUNCUL', a.emos.length ? a.emos.slice(0,6).map(([k,v])=>k+' ('+v+'x)').join(', ') : '-', '');
    L.push('YANG PALING MEMENGARUHI', a.tags.length ? a.tags.slice(0,6).map(([k,v])=>k+' ('+v+'x)').join(', ') : '-', '');
    L.push('KEJADIAN');
    a.es.forEach(e => { L.push('', fmtLong(e.date)+' - '+MOODS[e.mood-1].label+(e.emotions.length?' ('+e.emotions.join(', ')+')':'')); e.answers.filter(x=>x.text).forEach(x => L.push('- '+x.text)); });
    return L.join('\n');
  }

  function buildPdf(){
    const a = analyze();
    const J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error('nolib');
    const doc = new J({unit:'mm', format:'a4'});
    const M = 18, PW = 210 - 2*M; let y = 22;
    const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const need = h => { if (y + h > 280){ doc.addPage(); y = 20; } };
    const head = t => { need(14); y += 4; doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(91,75,219); doc.text(t.toUpperCase(), M, y); y += 2; doc.setDrawColor(225,221,242); doc.line(M, y, M+PW, y); y += 6; doc.setTextColor(43,37,64); };
    const para = (t, size, style) => { doc.setFont('helvetica', style||'normal'); doc.setFontSize(size||10.5); const lines = doc.splitTextToSize(t, PW); lines.forEach(l => { need(6); doc.text(l, M, y); y += (size||10.5)*0.45; }); y += 1.5; };
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(43,37,64); doc.text('Rangkuman Catatan', M, y); y += 7;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(110,104,137); doc.text(fmtLong(sum.from)+' - '+fmtLong(sum.to)+'   ·   dibuat dari Daily Mood', M, y); y += 6; doc.setTextColor(43,37,64);
    head('Mood');
    para('Rata-rata '+a.avg.toFixed(1).replace('.',',')+' dari 5 ('+MOODS[Math.max(0,Math.round(a.avg)-1)].label+'). Dicatat '+a.es.length+' dari '+a.totalDays+' hari. '+a.trend);
    para('Hari terberat: '+a.hardest.map(fmtShort).join(', ')+'.   Hari terbaik: '+a.best.map(fmtShort).join(', ')+'.');
    const days = []; for (let d = parse(sum.from); iso(d) <= sum.to; d = addDays(d,1)) days.push(iso(d));
    need(46); const cH = 34, base = y + cH, step = PW/days.length, bw = Math.max(1.5, Math.min(9, step-2));
    doc.setDrawColor(225,221,242); [1,3,5].forEach(v => { const yy = base - (4 + (v-1)*7.5); doc.line(M, yy, M+PW, yy); doc.setFontSize(7); doc.setTextColor(110,104,137); doc.text(String(v), M-4, yy+1); });
    days.forEach((k,i) => { const e = a.es.find(x=>x.date===k); const x = M + i*step + (step-bw)/2; if (e){ const h = 4 + (e.mood-1)*7.5; doc.setFillColor(...hex(MOODS[e.mood-1].hex)); doc.roundedRect(x, base-h, bw, h, Math.min(1.5,bw/2), Math.min(1.5,bw/2), 'F'); } if (days.length<=14 || i%Math.ceil(days.length/10)===0){ doc.setFontSize(7); doc.setTextColor(110,104,137); doc.text(String(parse(k).getDate()), x+bw/2, base+4, {align:'center'}); } });
    y = base + 9; doc.setTextColor(43,37,64);
    head('Emosi yang sering muncul');
    if (a.emos.length){ const mx = a.emos[0][1]; a.emos.slice(0,6).forEach(([k,v]) => { need(7); doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(k, M, y); doc.setFillColor(236,233,252); doc.roundedRect(M+30, y-3.2, PW-45, 3.6, 1.8, 1.8, 'F'); doc.setFillColor(91,75,219); doc.roundedRect(M+30, y-3.2, Math.max(3,(PW-45)*v/mx), 3.6, 1.8, 1.8, 'F'); doc.text(v+'x', M+PW, y, {align:'right'}); y += 6.5; }); y += 1; }
    else para('Belum ada emosi yang dicatat.');
    head('Yang paling memengaruhi');
    para(a.tags.length ? a.tags.slice(0,6).map(([k,v])=>k+' ('+v+'x)').join(',  ') : 'Belum ada yang dicatat.');
    head('Kejadian yang dilewati');
    a.es.forEach(e => {
      need(12); doc.setFillColor(...hex(MOODS[e.mood-1].hex)); doc.circle(M+1.8, y-1.3, 1.8, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.text(fmtLong(e.date)+'  -  '+MOODS[e.mood-1].label, M+6, y); y += 5;
      const meta = [e.emotions.join(', '), e.tags.join(', ')].filter(Boolean).join('  |  ');
      if (meta){ doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(110,104,137); doc.splitTextToSize(meta, PW-6).forEach(l => { need(5); doc.text(l, M+6, y); y += 4.2; }); doc.setTextColor(43,37,64); }
      e.answers.filter(x=>x.text).forEach(x => { doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.splitTextToSize(x.text, PW-6).forEach(l => { need(5.5); doc.text(l, M+6, y); y += 4.8; }); });
      y += 3;
    });
    return doc.output('blob');
  }

  // Simpan PDF: di iPhone/Android pakai lembar "Bagikan" (bisa langsung ke WA/Files), di laptop unduh biasa
  async function saveFile(blob, filename, title){
    try {
      const file = new File([blob], filename, {type:blob.type});
      if (navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:title});
        return 'shared';
      }
    } catch(e){ if (e && e.name === 'AbortError') return 'cancelled'; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  }

  function render(){
    if (!state.profile){ renderOnboard(); return; }
    tabsEl.classList.remove('hidden');
    document.querySelectorAll('nav.tabs button').forEach(b => { if (b.dataset.tab===tab) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    // tab Berdua = Couple Journaling (berdua.js)
    ({today:renderToday, calendar:renderCalendar, berdua:() => window.Berdua.render(view)})[tab]();
  }

  function editableProfile(){ return state.profile || draftProfile; }
  function persistName(){ const nm = document.getElementById('nm'); if (nm) editableProfile().name = nm.value.trim(); }
  function saveAnswer(){
    const ta = document.getElementById('ans'); const e = state.entries[todayIso]; if (!ta || !e) return;
    const cur = promptSteps(e)[stepIdx]; const txt = ta.value.trim();
    e.answers = e.answers.filter(a => a.prompt !== cur);
    if (txt) e.answers.push({prompt:cur, text:txt});
    save();
  }

  tabsEl.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-tab]'); if (!b) return;
    if (!b.dataset.tab) return;
    if (tab==='today') saveAnswer();
    tab = b.dataset.tab; if (tab==='calendar') calMode = 'view'; render(); view.scrollTop = 0;
  });

  view.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.age){ persistName(); editableProfile().age = d.age; if (state.profile) save(); render(); return; }
    if (d.cond){ persistName(); const p = editableProfile(); p.conditions = p.conditions.includes(d.cond) ? p.conditions.filter(x=>x!==d.cond) : p.conditions.concat(d.cond); if (state.profile) save(); t.setAttribute('aria-pressed', p.conditions.includes(d.cond)); return; }
    if (d.rmtag !== undefined){ persistName(); const p = editableProfile(); p.extraTags.splice(Number(d.rmtag),1); if (state.profile) save(); render(); return; }
    if (d.mood){
      const v = Number(d.mood);
      const e = state.entries[todayIso] || {date:todayIso, emotions:[], tags:[], answers:[]};
      const first = !state.entries[todayIso];
      e.mood = v; state.entries[todayIso] = e;
      if (first){ randomPrompt = null; stepIdx = 0; }
      save(); render(); toast(first ? 'Mood tersimpan' : 'Mood diperbarui'); return;
    }
    if (d.emo || d.tag){
      const e = state.entries[todayIso]; const key = d.emo ? 'emotions' : 'tags'; const val = d.emo || d.tag;
      e[key] = e[key].includes(val) ? e[key].filter(x=>x!==val) : e[key].concat(val);
      save(); t.setAttribute('aria-pressed', e[key].includes(val)); return;
    }
    if (d.day){ selDay = d.day; render(); return; }
    switch (d.act){
      case 'ob-next': persistName(); onboardStep = 1; render(); view.scrollTop = 0; break;
      case 'ob-back': onboardStep = 0; render(); break;
      case 'ob-done': state.profile = draftProfile; save(); tab = 'today'; render(); toast('Siap mencatat'); break;
      case 'add-tag': { persistName(); const inp = document.getElementById('newTag'); const v = inp.value.trim(); if (!v){ inp.focus(); return; } const p = editableProfile(); if (!p.extraTags.includes(v)) p.extraTags.push(v); if (state.profile) save(); render(); break; }
      case 'shuffle': saveAnswer(); { const e = state.entries[todayIso]; const old = randomPrompt; randomPrompt = pickRandom(e.mood); e.answers = e.answers.filter(a => a.prompt !== old || a.text); save(); } render(); break;
      case 'step-prev': saveAnswer(); stepIdx--; render(); break;
      case 'step-next': saveAnswer(); stepIdx++; render(); break;
      case 'step-done': saveAnswer(); toast('Catatan hari ini tersimpan'); render(); break;
      case 'prev': calMonth.setMonth(calMonth.getMonth()-1); render(); break;
      case 'next': calMonth.setMonth(calMonth.getMonth()+1); render(); break;
      case 'start-sum': calMode = 'pick'; sum.sel = {}; render(); view.scrollTop = 0; break;
      case 'back-cal': calMode = 'view'; render(); break;
      case 'back-pick': calMode = 'pick'; render(); view.scrollTop = 0; break;
      case 'toggle-all': { const es = rangeEntries(); const all = es.every(e => sum.sel[e.date]); es.forEach(e => sum.sel[e.date] = !all); render(); break; }
      case 'make-sum': calMode = 'summary'; render(); view.scrollTop = 0; break;
      case 'copy': try { await navigator.clipboard.writeText(summaryText()); toast('Teks rangkuman disalin'); } catch(e){ toast('Browser menolak menyalin, coba lagi'); } break;
      case 'share-text': try { await navigator.share({title:'Rangkuman Daily Mood', text:summaryText()}); } catch(e){ if (!e || e.name !== 'AbortError') toast('Gagal membagikan, pakai Salin'); } break;
      case 'pdf': {
        let blob; try { blob = buildPdf(); } catch(e){ toast('PDF belum bisa dibuat, coba Salin sebagai teks'); return; }
        const r = await saveFile(blob, 'Rangkuman '+sum.from+' sd '+sum.to+'.pdf', 'Rangkuman Daily Mood');
        toast(r === 'cancelled' ? 'Dibatalkan' : r === 'shared' ? 'PDF siap dikirim' : 'PDF diunduh');
        break;
      }
    }
  });

  view.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'nm' && state.profile){ state.profile.name = t.value.trim(); save(); }
    if (t.dataset && t.dataset.sel){ sum.sel[t.dataset.sel] = t.checked; render(); }
    if (t.id === 'from' || t.id === 'to'){ sum[t.id] = t.value || sum[t.id]; if (sum.from > sum.to){ const x = sum.from; sum.from = sum.to; sum.to = x; } render(); }
  });
  view.addEventListener('input', ev => { if (ev.target.id === 'ans') saveAnswer(); });
  view.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'newTag'){ ev.preventDefault(); view.querySelector('[data-act="add-tag"]').click(); }
  });

  // Saat app dibuka lagi (mis. besok pagi), ganti ke tanggal hari ini
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = iso(new Date());
    if (now !== todayIso){ saveAnswer(); todayIso = now; selDay = now; randomPrompt = null; stepIdx = 0; render(); }
  });

  // service worker app utama (scope /) juga meng-cache Daily Mood
  if ('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', () => { navigator.serviceWorker.register('../sw.js').catch(()=>{}); });
  }

  // Mood dari Beranda: ?mood=berat|lelah|biasa|baik|senang (urutan 1–5 sama dengan MOODS di sini)
  (function moodDariBeranda(){
    const q = new URLSearchParams(location.search).get('mood');
    const v = ['berat','lelah','biasa','baik','senang'].indexOf(q) + 1;
    if (history.replaceState && q !== null) history.replaceState(null, '', location.pathname);
    if (!v) return;
    const e = state.entries[todayIso] || {date:todayIso, emotions:[], tags:[], answers:[]};
    const first = !state.entries[todayIso];
    e.mood = v; state.entries[todayIso] = e;
    if (first){ randomPrompt = null; stepIdx = 0; }
    save();
    setTimeout(() => toast('Mood dari Beranda: ' + MOODS[v-1].label), 300);
  })();


  render();
  document.body.insertAdjacentHTML('beforeend', Fitur.navHtml('mood'));   // menu bawah bersama (shared/fitur.js)
  tandaSinkron();
  if (REMOTE) {
    antreKirim();                 // data lama di HP ikut terkirim sekali (kalau bukan data contoh)
    kirim(true);
    window.addEventListener('online', () => kirim(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kirim(true); });
  }
})();
