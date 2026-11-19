# Badmin Stat Cloud — Multi PB, satu Super Admin

## Isi
- `admin.html`: UI lama Badmin Stat, dipertahankan dashboard, leaderboard mingguan, member, match, Head to Head.
- `login.html`: login Super Admin.
- `functions/api/[[path]].js`: Cloudflare Pages Functions untuk autentikasi dan proxy ke Apps Script.
- `functions/p/[[slug]].js`: route viewer `/p/<slug>`.
- `apps-script/Code.gs`: backend Google Apps Script, menyimpan JSON ke tab `State` di Google Sheets (dipecah per 30.000 karakter).
- `import-data.json`: data yang Anda lampirkan, siap dimigrasi (termasuk logo dan member).

## Deploy
1. Buat Google Sheets kosong, salin spreadsheet ID dari URL.
2. Buka Extensions → Apps Script, paste `apps-script/Code.gs`.
3. Di Apps Script, Project Settings → Script Properties: `APP_SECRET` (buat string acak panjang) dan `SPREADSHEET_ID`.
4. Deploy → New deployment → Web App, Execute as **Me**, Who has access **Anyone**. Salin URL `/exec`.
5. Buat repo GitHub, upload isi folder proyek ini ke root repo (jangan upload file rahasia `.env`).
6. Cloudflare → Workers & Pages → Create → Pages → Connect GitHub. Framework preset **None**, build command **kosong**, output directory **/**. Alternatif deploy memakai `npx wrangler pages deploy . --project-name badmin-stat` dari folder ini.
7. Di Cloudflare Pages → Settings → Variables and Secrets, buat empat variabel terenkripsi:
   - `APPS_SCRIPT_URL`: URL Apps Script `/exec`.
   - `APPS_SCRIPT_SECRET`: sama dengan `APP_SECRET`.
   - `ADMIN_PASSWORD`: password admin kuat.
   - `SESSION_SECRET`: string acak lain minimal 32 karakter.
8. Deploy ulang setelah memasang secrets. Buka `/login.html` lalu `/admin`. Viewer: `/p/pbsm`.
9. Untuk migrasi awal, login, lalu gunakan browser developer console **sekali** dengan perintah berikut (paste isi JSON dari `import-data.json` ke variabel `importData`):
   ```js
   // const importData = { ...isi import-data.json... };
   db=normalizeDB(importData); save();
   ```
   Tunggu tulisan `✓ Tersimpan di Google Sheets` sebelum menutup halaman. Jangan impor ulang setelah ada transaksi baru.

## Catatan penting
- Tidak perlu redeploy saat tambah PB, member, atau pertandingan; Viewer refresh setiap 30 detik.
- Slug Viewer publik, siapa pun yang memiliki URL bisa melihat data.
- Semua perubahan admin disimpan sebagai satu snapshot dengan pengecekan revisi. Hanya satu admin, jangan buka beberapa tab admin bersamaan.
- Foto dan logo disimpan sebagai base64 di Google Sheets. Ini cocok untuk skala kecil, tetapi untuk banyak foto sebaiknya dipindah ke Cloudflare R2 atau Google Drive.
- Backup Google Sheets secara berkala. Pastikan anggota setuju nama dan foto mereka dipublikasikan.
- Cloudflare Pages Functions adalah proxy yang menjaga kunci Apps Script tidak terekspos ke browser.
