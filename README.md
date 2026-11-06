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
- Menghapus media melalui API membuat salinan pemulihan (maksimal 30 file per project), lalu melepas referensi slot dalam JSON sebelum file aktif dihapus. Media dapat dipulihkan melalui API; setelah pemulihan, pilih kembali file pada slot yang diinginkan. Aksi media dikunci pada ID project saat permintaan dimulai untuk menghindari silang project.
- Setiap penyimpanan konfigurasi yang menggantikan file lama membuat rolling backup maksimal 10 versi di direktori `backups` milik project. API menyediakan daftar backup dan restore; restore juga menyimpan versi aktif sebagai backup baru.
- Fitur masih tahap prototipe dan belum diuji end-to-end pada server PHP/browser produksi.

**Catatan Vercel:** PHP bukan runtime resmi first-party yang dapat diasumsikan tersedia untuk deployment biasa. Runtime PHP yang pernah tersedia di ekosistem Vercel bersifat komunitas, dan filesystem function tidak cocok untuk penyimpanan JSON permanen. Vercel dapat dipakai untuk menguji tampilan atau endpoint stateless, tetapi penyimpanan project/media persisten harus memakai layanan storage eksternal atau hosting PHP dengan disk persisten.

## Autentikasi admin (wajib sebelum deployment)
Semua endpoint project dan media memerlukan sesi admin. Operasi POST/PUT/DELETE juga memerlukan token CSRF. Password tidak disimpan di repository atau browser; backend memverifikasi hash dari environment PHP.

1. Buat hash password kuat (disarankan password unik minimal 16 karakter) menggunakan fungsi password_hash() dari PHP CLI pada server.
2. Atur hasil hash sebagai environment variable PHP bernama MAXIMUS_ADMIN_PASSWORD_HASH pada hosting/PHP-FPM. Jangan menaruh password atau hash di file JavaScript, HTML, atau Git.
3. Pastikan HTTPS aktif. Cookie sesi menggunakan HttpOnly dan SameSite=Strict. Atribut Secure aktif saat PHP mendeteksi HTTPS. Jika TLS berhenti di reverse proxy dan PHP tidak melihat HTTPS, atur `MAXIMUS_FORCE_SECURE_COOKIE=1` hanya pada konfigurasi server tepercaya; backend tidak mempercayai header `X-Forwarded-Proto` dari request.
4. Login dibatasi secara global per alamat IP: maksimal 10 kegagalan dalam jendela 15 menit, lalu jeda 15 menit. Pastikan `backend/storage` persisten dan hanya dapat ditulis oleh PHP.
5. Buka Configurator dan login menggunakan password asli (bukan hash). Gunakan tombol Keluar untuk mengakhiri sesi.
5. Jika environment variable belum diatur, API login menolak akses dengan status konfigurasi 503 (fail-closed).

Autentikasi ini adalah gerbang admin satu akun untuk workspace internal, bukan sistem multi-user. Sebelum publikasi tetap perlu meninjau konfigurasi hosting, backup, rate limit tambahan di server/WAF, izin file, dan pengujian keamanan.

## Menjalankan backend untuk uji browser

Persyaratan minimum: **PHP 8.1+**, ekstensi `fileinfo`, sesi PHP aktif, dan folder `backend/storage` dapat ditulis oleh proses PHP. Gunakan hosting/server dengan disk persisten untuk uji penyimpanan. PHP built-in server cocok untuk pengujian lokal, bukan deployment publik.

Buat hash password admin di terminal (ganti placeholder dengan password uji yang kuat; jangan commit hash/password ke Git):

```bash
php -r "echo password_hash('GANTI_DENGAN_PASSWORD_UJI_YANG_KUAT', PASSWORD_DEFAULT), PHP_EOL;"
```

Linux/macOS, jalankan dari root repository setelah mengisi hash hasil perintah di atas:

```bash
export MAXIMUS_ADMIN_PASSWORD_HASH='TEMPEL_HASH_HASIL_GENERATE'
php -S 127.0.0.1:8080 -t .
```

Windows PowerShell:

```powershell
$env:MAXIMUS_ADMIN_PASSWORD_HASH = 'TEMPEL_HASH_HASIL_GENERATE'
php -S 127.0.0.1:8080 -t .
```

Lalu buka `http://127.0.0.1:8080` pada browser yang sama. Jangan expose PHP built-in server ke internet. Jika memakai Codespaces/port forwarding, pastikan environment variable dipasang pada terminal/server process yang menjalankan PHP dan gunakan URL browser yang diteruskan oleh Codespaces.

Backend membatasi JSON project hingga 1 MB, memeriksa kompleksitas/ukuran field dan referensi media per project, lalu menulis konfigurasi melalui file sementara + rename agar file konfigurasi tidak mudah korup saat proses simpan terputus. Upload gambar diperiksa berdasarkan MIME aktual dan dimensi (maksimal 40 megapiksel).

API awal:
- `GET /backend/api/auth.php` — status sesi admin dan token CSRF.
- `POST /backend/api/auth.php` — login admin.
- `DELETE /backend/api/auth.php` — logout admin.
- `GET /backend/api/projects.php` — daftar project.
- `POST /backend/api/projects.php` — buat project.
- `GET /backend/api/projects.php?id=<project-id>` — baca konfigurasi.
- `PUT /backend/api/projects.php?id=<project-id>` — simpan konfigurasi.
- `DELETE /backend/api/projects.php?id=<project-id>` — hapus project (permanen; ekspor/backup project sebelum menghapus).
- `GET /backend/api/projects.php?id=<project-id>&action=backups` — daftar backup konfigurasi.
- `POST /backend/api/projects.php?id=<project-id>&action=restore` dengan JSON `{ "file": "nama-backup.json" }` — pulihkan konfigurasi dari backup (memerlukan CSRF).
- `POST /backend/api/media.php?project_id=<project-id>` — upload media.
- `GET /backend/api/media.php?project_id=<project-id>` — daftar media.
- `DELETE /backend/api/media.php?project_id=<project-id>&file=<filename>` — arsipkan lalu hapus media aktif.
- `GET /backend/api/media.php?project_id=<project-id>&action=backups` — daftar backup media.
- `POST /backend/api/media.php?project_id=<project-id>&action=restore&file=<filename>` — pulihkan media dari backup (memerlukan CSRF).

Folder penyimpanan dibuat otomatis di `backend/storage/projects/`. Jangan letakkan folder storage di lokasi publik pada hosting produksi.

## Keamanan dan batasan sebelum produksi
Backend ini adalah fondasi pengembangan dan BELUM layak dibuka ke internet sampai autentikasi admin dikonfigurasi dan diuji. Sesi admin, pemeriksaan CSRF, serta rate limiting persisten per alamat IP (10 kegagalan per 15 menit, lalu lock 15 menit) sudah diterapkan. Validasi ukuran/kompleksitas JSON, validasi referensi media, penulisan atomik, pemeriksaan konten/dimensi gambar, rolling backup konfigurasi (maksimal 10 versi), dan API restore juga sudah diterapkan. Sebelum produksi tetap wajib meninjau rate limiting tambahan pada server/WAF, backup off-site terjadwal, pemulihan file media, audit log, permission storage, serta pengujian keamanan dan alur end-to-end. Rolling backup konfigurasi JSON maksimal 10 versi dan backup media maksimal 30 file per project. Keduanya tetap bukan pengganti backup off-site terjadwal. File .htaccess melindungi folder storage pada Apache; deployment Nginx atau server lain harus memiliki aturan deny yang setara. Jangan mengandalkan .htaccess pada PHP built-in server. Jangan gunakan data pribadi pasien asli untuk pengujian; gunakan data demonstrasi/non-sensitif Dr. Faisal.

## Checklist pengujian end-to-end
1. Buat project A dan project B; pastikan project B dimulai dari konten default.
2. Ubah identitas, kontak, konten Hero/About/Keahlian/Artikel/FAQ/Footer pada A; simpan.
3. Upload gambar, pasang ke setiap slot media, simpan; tutup dan buka kembali A.
4. Pastikan seluruh field dan gambar kembali tepat.
5. Ubah A tanpa menyimpan, lalu pindah project; pastikan dialog konfirmasi tampil.
6. Pastikan B tidak mewarisi konten atau referensi media A.
7. Hapus gambar yang sedang dipakai; pastikan referensi slot dilepas dan preview kembali ke placeholder.
8. Uji seluruh operasi API pada hosting PHP dengan disk persisten; catat versi PHP dan ekstensi yang tersedia.
