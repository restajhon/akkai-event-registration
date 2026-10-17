# SOP operasional sesi dan scanner — AKKAI 2026

## Sesi dan station

1. Admin/Super Admin membuka sesi yang diperlukan melalui `/admin/sessions`. Beberapa sesi boleh berstatus `OPEN` bersamaan; membuka sesi tidak otomatis membuat station.
2. Di `/admin/display/setup`, buat station terpisah untuk setiap sesi yang akan dipindai, dan periksa kembali nama/kode sesi sebelum membuat station. Station terikat ke satu `session_id` dan tidak berpindah sesi hanya karena sesi lain dibuka.
3. Pasangkan setiap scanner melalui `/admin/scanner/pair` ke station yang sesuai. Pastikan kode sesi di halaman scanner dan Live Display cocok dengan station yang dituju; gunakan station baru saat berpindah sesi.
4. Scan QR pada scanner station tersebut. Check-in tercatat pada sesi milik station, bukan pada sesi `OPEN` lain. Live Display dibuka per station dan hanya menampilkan event untuk station/sesi itu.
5. Jika suatu sesi ditutup, scanner pada station sesi tersebut tidak menerima check-in; scanner pada station sesi lain yang tetap `OPEN` dapat terus digunakan. Tutup station yang selesai digunakan, lalu tutup sesi terkait setelah operasional selesai.

Jangan mengasumsikan semua scanner otomatis berpindah ke sesi yang baru dibuka. Periksa sesi dan station masing-masing sebelum memulai pemindaian.
