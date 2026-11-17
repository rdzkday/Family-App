/* Daily Mood — data bersama app Daily Mood (daily-mood/app.js) dan Beranda (Pengaturan > Daily Mood).
   Kunci localStorage tetap memakai nama lama "ruang-catat-*" supaya catatan yang sudah ada tidak hilang. */
(function () {
  var AGES = ['18–24','25–34','35–44','45+'];
  var BASE_TAGS = ['Tidur','Kesehatan','Uang','Teman','Diri sendiri'];
  var CONDITIONS = [
    {group:'Pekerjaan', items:[
      {id:'kantor',label:'Kerja kantoran',tags:['Kerjaan','Atasan','Rekan kerja','Perjalanan']},
      {id:'remote',label:'Kerja remote',tags:['Kerjaan','Rapat online']},
      {id:'freelance',label:'Freelance',tags:['Klien','Pemasukan']},
      {id:'usaha',label:'Punya usaha',tags:['Bisnis','Pelanggan','Tim']},
      {id:'carikerja',label:'Sedang cari kerja',tags:['Lamaran kerja','Wawancara']},
      {id:'kuliah',label:'Kuliah / sekolah',tags:['Kuliah','Tugas'],ages:['18–24']}
    ]},
    {group:'Hubungan & rumah', items:[
      {id:'pacaran',label:'Pacaran',tags:['Pasangan']},
      {id:'menikah',label:'Menikah',tags:['Pasangan','Keluarga besar']},
      {id:'anak',label:'Punya anak',tags:['Anak']},
      {id:'ortu',label:'Merawat orang tua',tags:['Orang tua']},
      {id:'sendiri',label:'Tinggal sendiri',tags:['Sendirian']},
      {id:'ldr',label:'Hubungan jarak jauh',tags:['Pasangan','Jarak']},
      {id:'rumah',label:'Bangun / pindah rumah',tags:['Rumah']}
    ]},
    {group:'Diri sendiri', items:[
      {id:'konseling',label:'Sedang konseling',tags:['Sesi konseling']},
      {id:'sakit',label:'Ada masalah kesehatan',tags:['Kesehatan']}
    ]}
  ];
  window.DM_DATA = {
    KEY: 'ruang-catat-v2',            // state lokal: { profile, entries, custom, randomToo, demo, lastBackup }
    SYNC_KEY: 'ruang-catat-sync',     // { snap, outbox, at }: snapshot terakhir dari Supabase + antrean kirim
    AGES: AGES, BASE_TAGS: BASE_TAGS, CONDITIONS: CONDITIONS,
    // isi baris '<user>|_pengaturan' di tabel jurnal. Harus sama persis antara app & Beranda (dibandingkan sebagai teks).
    pengaturanIsi: function (st) {
      return JSON.stringify({ profile: st.profile, custom: st.custom || [], randomToo: st.randomToo !== false, lastBackup: st.lastBackup || '' });
    }
  };
})();
