# Business Rules

## H-3D1 Participant Data

- `participant_category` adalah text bebas yang wajib, di-trim, dan panjangnya 1-100 karakter.
- `member_number` tetap tersedia, nullable, dan opsional untuk semua kategori.
- `kka_name` wajib untuk pendaftaran baru, di-trim, dan panjangnya 1-150 karakter.
- Ukuran poloshirt pendaftaran baru hanya `S`, `M`, `L`, `XL`, `XXL`, atau `XXXL`.
- Model poloshirt pendaftaran baru hanya `Lengan Panjang` atau `Lengan Pendek`.
- `institution` adalah data historis nullable dan tidak digunakan untuk pendaftaran baru.
- Registration ID dan QR token tidak berubah karena penambahan data ini.

## H-3D1 Operational Data

- Travel disimpan terpisah dari participant dan satu participant hanya memiliki satu current travel record.
- Travel memerlukan pasangan Registration ID dan email terdaftar yang cocok.
- Participant `CANCELLED` tidak dapat membuat atau memperbarui travel data.
- Semua peserta menggunakan Hotel Gumaya Semarang; tidak ada pilihan hotel peserta.
- Room assignment dan pickup assignment dikelola ADMIN, bukan peserta.
- Tidak ada fleet, vehicle inventory, driver, atau room inventory pada fase ini.
- Data baru tidak memiliki policy direct untuk anon atau authenticated client.
- Status kelengkapan diturunkan dari row dan nilai data, bukan boolean duplikat.
