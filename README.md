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

## Status penyimpanan
Saat ini UI yang sudah ada masih menyimpan draft di browser (localStorage). Fondasi PHP di folder `backend` disiapkan sebagai tahap berikutnya; integrasi frontend ke API belum diaktifkan.

**Catatan Vercel:** PHP bukan runtime resmi first-party yang dapat diasumsikan tersedia untuk deployment biasa. Runtime PHP yang pernah tersedia di ekosistem Vercel bersifat komunitas, dan filesystem function tidak cocok untuk penyimpanan JSON permanen. Vercel dapat dipakai untuk menguji tampilan atau endpoint stateless, tetapi penyimpanan project/media persisten harus memakai layanan storage eksternal atau hosting PHP dengan disk persisten.

## Menjalankan backend secara lokal
Dari root repository, jalankan PHP built-in server:

```bash
php -S 127.0.0.1:8080 -t .
```

API awal:
- `GET /backend/api/projects.php` — daftar project.
- `POST /backend/api/projects.php` — buat project.
- `GET /backend/api/projects.php?id=<project-id>` — baca konfigurasi.
- `PUT /backend/api/projects.php?id=<project-id>` — simpan konfigurasi.
- `DELETE /backend/api/projects.php?id=<project-id>` — hapus project.
- `POST /backend/api/media.php?project_id=<project-id>` — upload media.
- `GET /backend/api/media.php?project_id=<project-id>` — daftar media.
- `DELETE /backend/api/media.php?project_id=<project-id>&file=<filename>` — hapus media.

Folder penyimpanan dibuat otomatis di `backend/storage/projects/`. Jangan letakkan folder storage di lokasi publik pada hosting produksi.

## Keamanan
Backend ini adalah fondasi pengembangan, belum layak dibuka ke internet tanpa autentikasi admin, otorisasi per project, validasi deployment, pembatasan upload, dan backup. Jangan gunakan data pribadi pasien asli untuk pengujian; gunakan data demonstrasi/non-sensitif Dr. Faisal.
