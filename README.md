# Apih Automobile — Katalog Online & Sistem Pengurusan

Katalog kereta online untuk Apih Automobile, dibina oleh [BinaLab](https://binalab.my). Pelanggan boleh tengok gambar, harga dan status setiap kereta melalui satu link. Mereka juga boleh terus WhatsApp jurujual dari halaman kereta.

Sistem ini dibina atas platform yang sama dengan Abe Din Auto.

## Status semasa: MOD DEMO

Supabase untuk Apih belum disambung, jadi sistem berjalan dalam mod demo:

- Katalog awam (`/`) memaparkan 15 kereta contoh dengan gambar placeholder.
- Halaman detail kereta (`/?car=ADA-004`) berfungsi, termasuk harga promo dan ansuran bulanan.
- Log masuk staf (`/?admin=1`) belum aktif dan akan memaparkan mesej "Mod demo".

## Ciri UI telefon

Ciri-ciri ini ada dalam `js/apih-enhance.js` dan `css/apih-enhance.css`. Ia hanya lapisan paparan, logik data tidak diubah.

- Hero beranimasi dengan chip "unit sedia", waktu buka dan pembiayaan.
- Penapis dalam bottom sheet, dan jenama boleh diskrol mendatar.
- Kad kereta gaya app dengan animasi masuk.
- Dok terapung (ke atas / tapis / WhatsApp).
- Halaman kereta: gambar penuh lebar, bar harga + WhatsApp yang melekat di bawah, dan kalkulator ansuran (deposit + tempoh).

## Panel admin demo & Modul Akaun

**Masuk demo:** buka `?admin=1`, kemudian tekan **Masuk Demo sebagai Owner**. Data contoh (15 kereta, 2 jualan, 3 bayaran) dimuatkan untuk paparan sahaja. Semua tindakan simpan dalam modul lain akan memaparkan mesej mod demo.

**Akaun** (menu sidebar / nav bawah, Owner sahaja). Ia ialah cashbook berdasarkan konsep sistem 3 Abdul Motor:

- Akaun bank/tunai dengan baki pembukaan yang dikunci, dan baki semasa setiap akaun.
- Catatan manual: perbelanjaan (ikut kategori), pendapatan lain, modal owner, ambilan owner, pindahan akaun, dan pelarasan baki (sebab wajib).
- Bayaran pelanggan daripada modul Jualan dipaparkan automatik. Bayaran perlu dipadankan ke akaun; selagi belum dipadankan, ia tidak dikira dalam baki.
- Transaksi tidak boleh diubah atau dipadam. Pembatalan menambah entri songsang beserta sebab.
- Senarai "Perlu semakan" (belum disemak, belum dipadankan, perbelanjaan tanpa resit), lampiran resit (maksimum 5), pengecualian resit beserta sebab, dan jejak audit.
- KPI bulanan (wang masuk, wang keluar, aliran bersih, untung kasar jualan), carta mingguan, perbelanjaan ikut kategori, dan CSV bulanan.

Dalam mod demo, data akaun disimpan dalam `localStorage` pelayar sahaja. Bila Supabase disambung, modul ini memaparkan notis "belum diaktifkan". Untuk produksi, ia perlukan jadual Supabase (akaun, transaksi, audit, storan resit peribadi) dengan RLS owner sahaja. Rujuk `supabase/accounting.sql` dalam repo 3 Abdul Motor sebagai asas.

## Sambung ke Supabase Apih

1. Cipta projek baharu di [supabase.com](https://supabase.com) untuk Apih Automobile.
2. Salin skema database (jadual, RLS, fungsi RPC, bucket `vehicle-images`) daripada projek Supabase Abe Din. Contoh menggunakan Supabase CLI:
   ```bash
   supabase db dump --db-url "<connection string projek Abe Din>" --schema public -f schema.sql
   ```
   Kemudian jalankan `schema.sql` dalam SQL Editor projek Apih. Akhir sekali, jalankan `V38_SUPABASE_MIGRATION.sql` jika lajur `promo_price` dan `monthly_installment` belum wujud.
3. Cipta bucket storan awam `vehicle-images`.
4. Dalam `app.html`, isi dua nilai ini (cari `Tetapan Supabase Apih Automobile`):
   ```js
   const SUPABASE_URL='https://<projek-apih>.supabase.co';
   const SUPABASE_KEY='sb_publishable_...';
   ```
5. Cipta akaun staf di Supabase Auth dan daftar profil mereka dalam jadual `profiles`.

Hanya publishable key sahaja yang boleh diletak dalam kod. Jangan sekali-kali letak service role key.

## Deploy (GitHub Pages)

Sistem ini laman statik tanpa build step. Ia berfungsi di alamat GitHub Pages (`https://<user>.github.io/apihautombil/`) dan juga di domain sendiri.

1. Settings → Pages → Deploy from branch `main` / root.
2. (Pilihan) Untuk domain sendiri, tambah fail `CNAME` berisi nama domain dan set DNS ke GitHub Pages.

## Perlu ditukar sebelum go-live

- [ ] `apih-logo.png` dan `icon-*.png`: logo gaya signboard "APIH AUTOMOBIL" dengan tagline "Kepercayaan Anda Keutamaan Kami".
- [ ] `assets/demo/`: gambar kereta contoh, hanya untuk mod demo.
- [ ] `apih-board.webp`: latar papan zink biru dengan jalur merah-kuning ala signboard Apih.
- [ ] Nombor WhatsApp, TikTok dan Google Maps: diurus di Tetapan selepas Supabase disambung. Untuk demo, isi `DEMO_WHATSAPP` dalam `app.html`.
