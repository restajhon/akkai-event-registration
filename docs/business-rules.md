# Business Rules

## Registration Hotfix Form

- Form publik hotfix mengumpulkan nama lengkap, email, WhatsApp, nama KKA, ukuran poloshirt, model poloshirt, empat pilihan registrasi baru, dan persetujuan data.
- Field publik `Kategori peserta` dan `Nomor Anggota AKKAI` dihapus dari registrasi baru. Kolom historis tetap dipertahankan; `participant_category` dan `member_number` dapat bernilai NULL untuk row baru.
- Pilihan wajib registrasi baru adalah `Paket yang diambil` (`Twin Share`, `Single`), `Mengikuti` (`Seluruh acara`, `Rapat Anggota`, `Seminar Profesi Konsultan Aktuaria`), `Konsultan Aktuaria` (`Peserta Baru`, `Penerima Grandfathering`), dan `Hadir Kongres PAI` (`Ya`, `Tidak`). `Mengikuti` adalah satu pilihan, bukan multi-select.
- `institution` tetap tersedia hanya sebagai data historis nullable dan tidak menjadi input atau payload registrasi baru.
- Pendaftaran baru menggunakan `create_participant_with_registration_reservation_v3` dan mempertahankan alur reservasi email, QR, serta Registration ID yang sudah ada.
- RPC H-3D2 `create_participant_with_registration_reservation_v2` tidak diubah dan tetap menerima kontrak lama selama rollout.
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

- `participant_category` adalah kolom historis text yang dipertahankan dan nullable untuk row baru; nilai lama tidak dihapus.
- `member_number` tetap tersedia, nullable, dan opsional untuk semua kategori.
- `kka_name` wajib untuk pendaftaran baru, di-trim, dan panjangnya 1-150 karakter.
- Ukuran poloshirt pendaftaran baru adalah `S`, `M`, `L`, `XL`, `XXL`, `XXXL`, atau `XXXXL`.
- Model poloshirt pendaftaran baru hanya `Lengan Panjang` atau `Lengan Pendek`.
- Kolom baru `package_type`, `participation_scope`, `actuarial_consultant_status`, dan `attends_pai_congress` nullable untuk menjaga peserta lama tetap valid; RPC V3 dan Server Action mewajibkan nilainya pada pendaftaran baru.
- `institution` adalah data historis nullable dan tidak digunakan untuk pendaftaran baru.
- Registration ID dan QR token tidak berubah karena penambahan data ini.

## H-3D1 Operational Data

- Travel disimpan terpisah dari participant dan satu participant hanya memiliki satu current travel record.
- Travel memerlukan pasangan Registration ID dan email terdaftar yang cocok.
- Participant `CANCELLED` tidak dapat membuat atau memperbarui travel data.
- Semua peserta menggunakan Hotel Gumaya Semarang; tidak ada pilihan hotel peserta.
- Room assignment dan pickup assignment dikelola role yang memiliki permission
  `rooms.manage` atau `pickup.manage`, bukan peserta.
- Tidak ada fleet, vehicle inventory, driver, atau room inventory pada fase ini.
- Data baru tidak memiliki policy direct untuk anon atau authenticated client.
- Status kelengkapan diturunkan dari row dan nilai data, bukan boolean duplikat.

## H-3D3 Travel Form

- `/travel` adalah halaman publik terpisah dari `/register` untuk peserta yang sudah terdaftar.
- Verifikasi peserta menggunakan pasangan Registration ID dan email terdaftar; keduanya wajib cocok pada participant yang sama dan berstatus `REGISTERED`.
- Registration ID dinormalisasi uppercase dan email dinormalisasi trim/lowercase di server. QR token bukan metode autentikasi travel.
- Kesalahan identity tidak membedakan Registration ID tidak dikenal, email salah, pasangan campuran, atau participant `CANCELLED`; browser menerima pesan generic yang sama.
- Form memiliki satu tanggal dan satu waktu untuk setiap leg. Moda transportasi adalah free text trim 1-50 karakter, bukan enum atau dropdown.
- Nomor penerbangan/kereta bersifat opsional dan dibatasi panjangnya. Asal keberangkatan, tujuan keberangkatan, dan tujuan kepulangan adalah free text wajib.
- Tanggal kepulangan tidak boleh lebih awal dari tanggal keberangkatan. `extend_stay` wajib berupa pilihan Ya atau Tidak.
- Satu participant memiliki satu current travel row. Submission berikutnya meng-update row yang sama melalui `upsert_participant_travel`.
- Hotel Gumaya Semarang adalah konteks akomodasi statis untuk semua peserta dan bukan field yang dapat diubah peserta.
- Submission travel tidak mengirim email registrasi, resend, atau email travel.
- Verification dan submission dilindungi durable rate limit Supabase/Postgres berbasis hash identity dan IP. Limit rolling 15 menit berakhir otomatis dan tidak mengunci participant secara permanen.

## H-3D4C Room And Two-Leg Pickup Assignment

- Room assignment dan pickup assignment hanya dapat dikelola oleh profile aktif
  yang memiliki `rooms.manage` atau `pickup.manage`.
- Halaman admin tersedia pada `/admin/rooms` dan `/admin/pickup`; participant `CANCELLED` tetap dapat dilihat tetapi tidak dapat diubah.
- Setiap participant memiliki paling banyak satu current room assignment, satu current ARRIVAL assignment, dan satu current DEPARTURE assignment.
- Room assignment menyimpan nomor kamar, tipe kamar, tanggal check-in, tanggal check-out, dan catatan. Check-out tidak boleh lebih awal dari check-in.
- Mengosongkan room assignment menyimpan nilai assignment sebagai `NULL` melalui upsert, tanpa menghapus participant atau histori operasional lain.
- Pickup assignment memiliki `transfer_type` `ARRIVAL` atau `DEPARTURE`, serta status `SCHEDULED`, `COMPLETED`, atau `CANCELLED`. Status `SCHEDULED` dan `COMPLETED` wajib memiliki waktu dan titik jemput. DEPARTURE juga wajib memiliki titik antar.
- Waktu pickup yang diisi admin dianggap sebagai waktu lokal Asia/Jakarta dan dikonversi ke `timestamptz` di server.
- Membatalkan satu leg pickup mengosongkan detail waktu, titik jemput, titik antar, kendaraan, PIC/driver, dan catatan pada leg tersebut, lalu menyimpan status `CANCELLED`. Leg lainnya tidak berubah.
- Room number tidak dibuat unique karena satu kamar dapat ditempati beberapa participant.
- List assignment hanya untuk monitoring; mutation dilakukan pada halaman detail participant.
- Travel context pada pickup detail bersifat read-only dan tetap dimiliki oleh `participant_travel`.
- Semua mutation memakai RPC service-role yang memvalidasi transfer type, actor
  aktif dengan permission assignment terkait, participant REGISTERED, dan
  uniqueness `(participant_id, transfer_type)`; tidak ada direct client write
  policy untuk tabel assignment.

## H-3D5 Operational Spreadsheet Export Requirement

- Export final bernama `AKKAI Operational Spreadsheet (.xlsx)` dan hanya dapat dilakukan
  oleh role yang memiliki `attendance.export`; pada matrix aktual role tersebut adalah
  `SUPER_ADMIN`, `ADMIN`, dan `OPERATIONAL`.
- Workbook memiliki sheet `Rooms`, `Pickup Kedatangan`, `Pickup Kepulangan`, dan `Kehadiran`.
- `Rooms` memuat participant operasional dan data room assignment.
- `Pickup Kedatangan` memuat participant, konteks transport ARRIVAL, dan assignment ARRIVAL.
- `Pickup Kepulangan` memuat participant, konteks transport RETURN, dan assignment DEPARTURE.
- `Kehadiran` memiliki satu row per participant dan kolom untuk checkpoint ARRIVAL / Day 1, SEMINAR / Day 2, dan DAY3 / Day 3, termasuk status serta timestamp check-in bila tersedia.
- Export tidak boleh memuat QR token, password, secret, atau UUID internal yang tidak diperlukan.
