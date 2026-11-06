# Maximus Configurator — Paket 2

Configurator Paket 2: **Fixed Structure + Dynamic Content**.

## Struktur saat ini
- `index.html` — antarmuka configurator.
- `assets/css/global.css` — styling responsif.
- `assets/js/main.js` — schema konfigurasi, editor, live preview, dan draft browser.
- `backend/` — fondasi API PHP dan penyimpanan JSON/media untuk hosting PHP biasa.

## Arah arsitektur
- Frontend Configurator mengelola banyak project.
- Setiap project mempunyai ID dan direktori data sendiri.
- Konten disimpan sebagai JSON.
- File media disimpan terpisah dari JSON; JSON hanya menyimpan metadata dan nama file.
- Website klien nantinya membaca konfigurasi melalui mini-backend PHP mandiri.
- Tidak menggunakan Supabase sebagai database runtime website klien.

## Status penyimpanan dan media
- Project Manager terhubung ke API PHP untuk membuat, membuka, mengganti nama, dan menghapus project.
- Konfigurasi disimpan sebagai JSON melalui API; localStorage menjadi draft/fallback browser.
- Media Library terhubung ke API upload/list/delete dengan folder per project.
- Media dapat ditetapkan ke slot Logo, Hero, About, dan Keahlian. Referensi file disimpan dalam konfigurasi project; preview mengambil file melalui endpoint media.
- Project baru dibuat dari konfigurasi default yang bersih, bukan menyalin konten project aktif.
- Saat project dibuka, konfigurasi server menjadi sumber data utama; seluruh field identitas/kontak diperbarui.
- Perubahan konten dan penempatan media ditandai sebagai belum disimpan. Perpindahan project meminta konfirmasi sebelum membuang perubahan.
- Menghapus media juga melepas semua referensi slot media yang memakai file tersebut. Aksi media dikunci pada ID project saat permintaan dimulai untuk menghindari silang project.
- Fitur masih tahap prototipe dan belum diuji end-to-end pada server PHP/browser produksi.

**Catatan Vercel:** PHP bukan runtime resmi first-party yang dapat diasumsikan tersedia untuk deployment biasa. Runtime PHP yang pernah tersedia di ekosistem Vercel bersifat komunitas, dan filesystem function tidak cocok untuk penyimpanan JSON permanen. Vercel dapat dipakai untuk menguji tampilan atau endpoint stateless, tetapi penyimpanan project/media persisten harus memakai layanan storage eksternal atau hosting PHP dengan disk persisten.

## Autentikasi admin (wajib sebelum deployment)
Semua endpoint project dan media memerlukan sesi admin. Operasi POST/PUT/DELETE juga memerlukan token CSRF. Password tidak disimpan di repository atau browser; backend memverifikasi hash dari environment PHP.

1. Buat hash password kuat (disarankan password unik minimal 16 karakter) menggunakan fungsi password_hash() dari PHP CLI pada server.
2. Atur hasil hash sebagai environment variable PHP bernama MAXIMUS_ADMIN_PASSWORD_HASH pada hosting/PHP-FPM. Jangan menaruh password atau hash di file JavaScript, HTML, atau Git.
3. Pastikan HTTPS aktif. Cookie sesi menggunakan HttpOnly dan SameSite=Strict; atribut Secure aktif saat PHP mendeteksi HTTPS.
4. Buka Configurator dan login menggunakan password asli (bukan hash). Gunakan tombol Keluar untuk mengakhiri sesi.
5. Jika environment variable belum diatur, API login menolak akses dengan status konfigurasi 503 (fail-closed).

Autentikasi ini adalah gerbang admin satu akun untuk workspace internal, bukan sistem multi-user. Sebelum publikasi tetap perlu meninjau konfigurasi hosting, backup, rate limit tambahan di server/WAF, izin file, dan pengujian keamanan.

## Menjalankan backend secara lokal
Dari root repository, jalankan PHP built-in server:

```bash
php -S 127.0.0.1:8080 -t .
```

API awal:
- `GET /backend/api/auth.php` — status sesi admin dan token CSRF.
- `POST /backend/api/auth.php` — login admin.
- `DELETE /backend/api/auth.php` — logout admin.
- `GET /backend/api/projects.php` — daftar project.
- `POST /backend/api/projects.php` — buat project.
- `GET /backend/api/projects.php?id=<project-id>` — baca konfigurasi.
- `PUT /backend/api/projects.php?id=<project-id>` — simpan konfigurasi.
- `DELETE /backend/api/projects.php?id=<project-id>` — hapus project.
- `POST /backend/api/media.php?project_id=<project-id>` — upload media.
- `GET /backend/api/media.php?project_id=<project-id>` — daftar media.
- `DELETE /backend/api/media.php?project_id=<project-id>&file=<filename>` — hapus media.

Folder penyimpanan dibuat otomatis di `backend/storage/projects/`. Jangan letakkan folder storage di lokasi publik pada hosting produksi.

## Keamanan dan batasan sebelum produksi
Backend ini adalah fondasi pengembangan dan BELUM layak dibuka ke internet sampai autentikasi admin dikonfigurasi dan diuji. Sesi admin dan pemeriksaan CSRF dasar sudah ditambahkan; sebelum produksi tetap wajib menambahkan/meninjau otorisasi project, rate limiting pada server/WAF, batas request, validasi konfigurasi menyeluruh, backup, audit log, dan pengujian permission storage. File .htaccess melindungi folder storage pada Apache; deployment Nginx atau server lain harus memiliki aturan deny yang setara. Jangan mengandalkan .htaccess pada PHP built-in server. Jangan gunakan data pribadi pasien asli untuk pengujian; gunakan data demonstrasi/non-sensitif Dr. Faisal.

## Checklist pengujian end-to-end
1. Buat project A dan project B; pastikan project B dimulai dari konten default.
2. Ubah identitas, kontak, konten Hero/About/Keahlian/Artikel/FAQ/Footer pada A; simpan.
3. Upload gambar, pasang ke setiap slot media, simpan; tutup dan buka kembali A.
4. Pastikan seluruh field dan gambar kembali tepat.
5. Ubah A tanpa menyimpan, lalu pindah project; pastikan dialog konfirmasi tampil.
6. Pastikan B tidak mewarisi konten atau referensi media A.
7. Hapus gambar yang sedang dipakai; pastikan referensi slot dilepas dan preview kembali ke placeholder.
8. Uji seluruh operasi API pada hosting PHP dengan disk persisten; catat versi PHP dan ekstensi yang tersedia.
