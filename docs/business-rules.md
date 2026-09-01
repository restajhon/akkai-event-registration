# Business Rules

## H-3D2 Registration Form

- Form publik mengumpulkan nama lengkap, email, WhatsApp, nama KKA, kategori peserta, nomor anggota opsional, ukuran poloshirt, model poloshirt, dan persetujuan data.
- `institution` tetap tersedia hanya sebagai data historis nullable dan tidak menjadi input atau payload registrasi baru.
- `participant_category` adalah free text, bukan select, enum, atau whitelist.
- Pendaftaran baru menggunakan `create_participant_with_registration_reservation_v2` dan mempertahankan alur reservasi email, QR, serta Registration ID yang sudah ada.
- Informasi event publik menampilkan Hotel Gumaya Semarang; peserta tidak mengedit atau mengirimkan informasi ini.
- Homepage menampilkan rundown umum Day 1 sampai Day 3. Halaman registrasi tidak menampilkan rundown lengkap dan rundown tidak memuat detail waktu yang belum ditetapkan.

## H-3D2 Event Sessions

- Sesi operasional terdiri dari ARRIVAL (Registrasi Kedatangan, 19 Oktober 2026), SEMINAR (Seminar AKKAI 2026, 20 Oktober 2026), dan DAY3 (Registrasi Day 3, 21 Oktober 2026).
- Participant QR yang sama digunakan untuk ARRIVAL, SEMINAR, dan DAY3. Tidak ada QR kedua atau token baru untuk DAY3.
- Attendance tetap unik berdasarkan `participant_id + session_id`, sehingga peserta dapat memiliki attendance terpisah pada ketiga sesi.
- DAY3 tidak mensyaratkan attendance ARRIVAL atau SEMINAR.
- City Tour Semarang adalah agenda publik Day 3; tidak ada field, session, atau data transportasi City Tour.

## Public Rundown

Homepage menampilkan rundown umum berikut tanpa detail waktu:

```text
Day 1
- Kedatangan
- AKKAI NIGHT

Day 2
- Registrasi
- Seminar Sesi 1
- Isoma
- Seminar Sesi 2
- Isoma

Day 3
- Registrasi
- City Tour Semarang
```

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
