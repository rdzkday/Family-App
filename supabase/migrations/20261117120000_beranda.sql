-- Beranda: catatan & agenda evaluasi bulanan disimpan di tabel todo.
-- Hanya menambah kolom (data lama aman). Boleh dijalankan berulang.
-- Kolom sengaja boleh null: Edge Function versi lama (belum tahu kolom ini) tetap bisa menyimpan.
-- kantong_muat (to_jsonb) & kantong_simpan (baca information_schema) otomatis ikut kolom baru.
alter table todo add column if not exists tipe text default 'todo';   -- todo | catatan | evaluasi (null/kosong = todo)
alter table todo add column if not exists isi text default '';
