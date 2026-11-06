# Maximus Configurator — Paket 2 (Prototype)

Frontend prototype untuk Paket 2: **Fixed Structure + Dynamic Content**.

## Struktur
- `index.html` — antarmuka configurator.
- `assets/css/global.css` — styling responsif.
- `assets/js/main.js` — data demo, editor, live preview, dan penyimpanan draft.

## Menjalankan
Buka `index.html` melalui browser modern. Disarankan memakai local server.

## Fitur prototype
- Editor konten Hero, About, Keahlian, Artikel, FAQ & CTA, dan Footer.
- Identitas brand, logo preview, kontak, serta tautan sosial.
- Daftar section bersifat tetap (sesuai Paket 2).
- Live preview desktop/mobile.
- Simpan draft ke localStorage.

## Batasan
Belum terhubung ke backend PHP atau penyimpanan JSON server. Tombol simpan menyimpan data di browser/perangkat lokal. Upload logo hanya untuk preview sesi berjalan. Belum ada autentikasi maupun mekanisme publikasi.

## Arah arsitektur produksi
Setiap website klien direncanakan memiliki mini-backend PHP mandiri, data konten JSON, dan media lokal. Tidak menggunakan Supabase sebagai database runtime klien.
