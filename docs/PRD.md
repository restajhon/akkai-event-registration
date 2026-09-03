# Product Requirement Document

## Sistem Registrasi dan Kehadiran Digital AKKAI 2026

**Versi:** 1.0
**Status:** MVP Definition
**Pemilik Produk:** Semangat Rajawali Indonesia
**Event:** Rapat Tahunan AKKAI 2026
**Lokasi:** Hotel Gumaya Semarang
**Tanggal acara:** 19–21 Oktober 2026
**Target production:** Maksimal akhir September 2026

---

# 1. Ringkasan Produk

Sistem Registrasi dan Kehadiran Digital AKKAI 2026 adalah aplikasi web untuk menangani proses registrasi peserta sebelum acara dan pencatatan kehadiran pada tiga sesi acara.

Setiap peserta akan:

1. Mengisi form registrasi melalui website.
2. Mendapatkan Registration ID dan QR unik.
3. Menerima QR melalui halaman tiket digital dan email.
4. Menggunakan QR yang sama untuk check-in pada tiga sesi:

   * Registrasi Kedatangan.
   * Seminar AKKAI 2026.
   * Registrasi Day 3.

Pada hari acara, QR peserta akan dipindai menggunakan kamera handphone panitia. Hasil pemindaian akan divalidasi oleh server, disimpan ke database, lalu ditampilkan secara real-time pada laptop yang terhubung dengan handphone scanner tersebut.

Sistem ini dibuat khusus untuk satu event AKKAI 2026 dan belum ditujukan sebagai platform event management multi-event.

---

# 2. Tujuan Produk

MVP harus menyelesaikan kebutuhan berikut:

1. Mengumpulkan data peserta secara online.
2. Mencegah pendaftaran ganda.
3. Membuat QR unik bagi setiap peserta.
4. Mengirimkan tiket digital melalui email.
5. Mencatat kehadiran peserta pada tiga sesi yang berbeda.
6. Memungkinkan panitia menggunakan handphone sebagai scanner.
7. Menampilkan hasil scan pada laptop secara real-time.
8. Menyediakan check-in manual sebagai fallback.
9. Menyediakan dashboard dan laporan kehadiran.
10. Mempermudah Semangat Rajawali Indonesia dan AKKAI melakukan rekap peserta.

---

# 3. Sasaran Pengguna

## 3.1 Peserta

Peserta adalah anggota atau tamu AKKAI yang mengikuti acara.

Peserta dapat:

* Membuka halaman informasi acara.
* Mengisi form registrasi.
* Melihat konfirmasi registrasi.
* Melihat tiket digital.
* Menerima QR melalui email.
* Menggunakan QR yang sama pada tiga sesi.

Peserta tidak perlu membuat akun atau login.

## 3.2 Operator Registrasi

Operator adalah panitia yang bertugas di meja registrasi.

Operator dapat:

* Login ke sistem.
* Memasangkan handphone scanner dengan laptop display.
* Memindai QR peserta.
* Melihat hasil scan.
* Mencari peserta.
* Melakukan check-in manual.
* Melihat status kehadiran peserta.

Operator tidak dapat:

* Menghapus peserta.
* Mengubah pengaturan sistem.
* Mengubah sesi acara.
* Mengakses seluruh konfigurasi administratif.
* Mengakses data sensitif yang tidak dibutuhkan.

## 3.3 Admin

Admin adalah PIC dari Semangat Rajawali Indonesia atau panitia utama yang bertanggung jawab atas sistem.

Admin dapat:

* Melakukan seluruh aktivitas operator.
* Melihat dashboard.
* Melihat dan mengedit peserta.
* Membatalkan pendaftaran.
* Mengirim ulang tiket.
* Membuka dan menutup sesi.
* Mengelola station scanner.
* Melihat laporan.
* Mengekspor data.
* Melihat log check-in.

---

# 4. Asumsi MVP

MVP dibangun dengan asumsi berikut:

* Jumlah peserta berkisar 100–500 orang.
* Sistem hanya digunakan untuk satu event.
* Terdapat tiga sesi kehadiran.
* Terdapat maksimal tiga meja atau perangkat scanner yang aktif bersamaan.
* Setiap peserta menerima satu QR.
* QR yang sama digunakan untuk seluruh sesi.
* Peserta tidak melakukan pembayaran melalui sistem.
* Peserta tidak memiliki akun.
* Sistem membutuhkan koneksi internet.
* Panitia menyediakan Wi-Fi atau hotspot cadangan.
* Data utama tersimpan di Supabase.
* Aplikasi diakses melalui browser.
* Scanner menggunakan kamera handphone.
* Laptop berfungsi sebagai live display dan perangkat help desk.

---

# 5. Scope MVP

## 5.1 Fitur yang masuk MVP

* Landing page acara.
* Form registrasi peserta.
* Validasi data.
* Pencegahan registrasi ganda.
* Registration ID otomatis.
* QR unik.
* Tiket digital.
* Email konfirmasi.
* Login admin dan operator.
* Dashboard admin.
* Daftar peserta.
* Detail dan edit peserta.
* Pembatalan peserta.
* Pengiriman ulang email.
* Tiga sesi kehadiran.
* Pembukaan dan penutupan sesi.
* Pairing handphone scanner dan laptop display.
* Scanner QR berbasis browser.
* Tampilan hasil scan di handphone.
* Live display di laptop.
* Pencegahan check-in ganda per sesi.
* Check-in manual.
* Pencarian peserta.
* Attendance log.
* Export CSV atau Excel.
* Laporan per sesi.
* Laporan keseluruhan.

## 5.2 Fitur yang tidak masuk MVP

* Mobile application Android atau iOS.
* Payment gateway.
* WhatsApp API.
* Login peserta.
* Reset password custom.
* Multi-event management.
* Dynamic form builder.
* Face recognition.
* NFC.
* Self-service kiosk.
* Badge printing otomatis.
* Sertifikat otomatis.
* Offline synchronization penuh.
* Integrasi hotel.
* Integrasi transportasi.
* Integrasi master anggota secara real-time.
* Dashboard analitik kompleks.
* CMS untuk mengubah konten website.
* QR berbeda untuk setiap sesi.
* Social login.
* Notifikasi push.
* Approval pendaftaran bertingkat.

---

# 6. Terminologi Produk

| Istilah         | Definisi                                      |
| --------------- | --------------------------------------------- |
| Participant     | Peserta yang telah mengisi form registrasi    |
| Registration ID | Nomor registrasi yang mudah dibaca manusia    |
| QR Token        | Token acak yang disimpan dalam QR             |
| Session         | Agenda yang membutuhkan pencatatan kehadiran  |
| Attendance      | Catatan kehadiran peserta pada satu sesi      |
| Station         | Pasangan laptop display dan handphone scanner |
| Scanner         | Halaman pada handphone untuk membaca QR       |
| Live Display    | Halaman laptop yang menampilkan hasil scan    |
| Operator        | Panitia yang melakukan scan atau check-in     |
| Admin           | Pengguna yang mengelola sistem dan laporan    |
| Manual Check-in | Check-in yang dilakukan tanpa scan QR         |

---

# 7. Sesi Acara

MVP memiliki tiga sesi tetap.

## 7.1 Sesi 1 — Registrasi Kedatangan

**Kode:** `ARRIVAL`
**Nama:** Registrasi Kedatangan
**Hari:** Hari pertama acara
**Tanggal awal:** 19 Oktober 2026

Tujuan:

* Mencatat peserta yang telah tiba di Semarang.
* Memvalidasi identitas peserta.
* Menjadi proses registrasi fisik utama.

## 7.2 Sesi 2 — Seminar AKKAI 2026

**Kode:** `SEMINAR`
**Nama:** Seminar AKKAI 2026
**Hari:** Hari kedua acara
**Tanggal awal:** 20 Oktober 2026

Tujuan:

* Mencatat peserta yang benar-benar mengikuti seminar.
* Menghasilkan laporan kehadiran seminar.
* Memisahkan data kedatangan dan seminar.

## 7.3 Sesi 3 — Registrasi Day 3

**Kode:** `DAY3`
**Nama:** Registrasi Day 3
**Hari:** Hari ketiga acara
**Tanggal awal:** 21 Oktober 2026

Tujuan:

* Mencatat peserta pada checkpoint registrasi dan kehadiran Day 3.
* Menghasilkan laporan kehadiran Day 3 secara terpisah.
* Menggunakan QR peserta yang sama seperti sesi sebelumnya.

## 7.4 Aturan sesi

* Sesi disimpan di database sejak awal.
* Admin dapat membuka atau menutup sesi.
* Operator tidak dapat mengubah sesi.
* Station hanya boleh terhubung ke satu sesi aktif.
* Satu QR dapat digunakan pada ketiga sesi.
* Satu peserta hanya memiliki satu attendance per sesi.
* Peserta seminar tidak wajib memiliki attendance kedatangan.
* Jika peserta seminar belum check-in kedatangan, seminar tetap berhasil dicatat.
* Sistem menampilkan peringatan kepada operator apabila attendance kedatangan tidak ditemukan.
* Peserta DAY3 tidak wajib memiliki attendance seminar atau kedatangan.
* Peserta dengan status `CANCELLED` tidak dapat check-in pada sesi mana pun.

---

# 8. Status Sistem

## 8.1 Registration Status

| Status       | Keterangan                     |
| ------------ | ------------------------------ |
| `REGISTERED` | Peserta berhasil terdaftar     |
| `CANCELLED`  | Pendaftaran peserta dibatalkan |

## 8.2 Email Status

| Status    | Keterangan             |
| --------- | ---------------------- |
| `PENDING` | Email belum diproses   |
| `SENT`    | Provider menerima request pengiriman |
| `FAILED`  | Email gagal dikirim    |

`SENT` berarti provider email menerima request pengiriman. Status ini bukan
jaminan email masuk inbox atau dibaca oleh penerima.

## 8.3 Session Status

| Status   | Keterangan                     |
| -------- | ------------------------------ |
| `CLOSED` | Check-in tidak dapat dilakukan |
| `OPEN`   | Check-in dapat dilakukan       |

## 8.4 Station Status

| Status            | Keterangan                          |
| ----------------- | ----------------------------------- |
| `WAITING_PAIRING` | Laptop menunggu handphone terhubung |
| `PAIRED`          | Handphone berhasil dipasangkan      |
| `ACTIVE`          | Station siap melakukan scan         |
| `DISCONNECTED`    | Scanner terputus                    |
| `CLOSED`          | Station telah ditutup               |

## 8.5 Scan Result

| Status                  | Keterangan                                |
| ----------------------- | ----------------------------------------- |
| `SUCCESS`               | Check-in berhasil                         |
| `SUCCESS_WITH_WARNING`  | Berhasil dengan peringatan                |
| `ALREADY_CHECKED_IN`    | Peserta sudah hadir pada sesi yang sama   |
| `INVALID_QR`            | Token QR tidak ditemukan atau tidak valid |
| `CANCELLED_PARTICIPANT` | Peserta dibatalkan                        |
| `SESSION_CLOSED`        | Sesi belum dibuka atau sudah ditutup      |
| `STATION_INACTIVE`      | Station tidak aktif                       |
| `ERROR`                 | Terjadi kendala sistem                    |

---

# 9. User Flow Utama

## 9.1 Flow registrasi peserta

```text
Peserta membuka landing page
        ↓
Peserta memilih Daftar Sekarang
        ↓
Peserta mengisi form registrasi
        ↓
Sistem memvalidasi input
        ↓
Sistem memeriksa email dan nomor anggota
        ↓
Data ganda?
   ├── Ya → Tampilkan pesan sudah terdaftar
   └── Tidak
        ↓
Simpan peserta
        ↓
Buat Registration ID
        ↓
Buat token QR
        ↓
Buat tiket digital
        ↓
Tampilkan halaman sukses
        ↓
Kirim email konfirmasi
```

## 9.2 Flow pairing perangkat

```text
Admin/operator login pada laptop
        ↓
Membuka halaman Display Setup
        ↓
Memilih sesi
        ↓
Sistem membuat station
        ↓
Laptop menampilkan QR dan kode pairing
        ↓
Operator login melalui handphone
        ↓
Operator memindai QR pairing
        ↓
Handphone dan laptop terhubung
        ↓
Station berstatus ACTIVE
```

## 9.3 Flow check-in

```text
Peserta menunjukkan QR
        ↓
Operator memindai QR dengan handphone
        ↓
Handphone mengirim token dan station ID
        ↓
Server memvalidasi station dan sesi
        ↓
Server memvalidasi peserta
        ↓
Server memeriksa attendance
        ↓
Attendance sudah ada?
   ├── Ya → ALREADY_CHECKED_IN
   └── Tidak
        ↓
Simpan attendance
        ↓
Buat scan event
        ↓
Kirim hasil ke handphone
        ↓
Kirim event real-time ke laptop
        ↓
Laptop menampilkan data peserta
```

## 9.4 Flow check-in manual

```text
Peserta tidak membawa QR
        ↓
Operator mencari peserta
        ↓
Operator membuka detail peserta
        ↓
Operator memilih sesi
        ↓
Operator menekan Check-in Manual
        ↓
Sistem meminta konfirmasi
        ↓
Attendance sudah ada?
   ├── Ya → Tampilkan check-in sebelumnya
   └── Tidak → Simpan attendance manual
```

---

# 10. Struktur Halaman

```text
/
├── /register
├── /registration-success/[registrationId]
├── /ticket/[token]
│
└── /admin
    ├── /login
    ├── /dashboard
    ├── /participants
    ├── /participants/[id]
    ├── /display/setup
    ├── /display/[stationId]
    ├── /scanner/pair
    ├── /scanner/[stationId]
    └── /reports
```

---

# 11. Detail Halaman Publik

## 11.1 Landing Page

**Route:** `/`

### Tujuan

Memberikan informasi singkat tentang acara dan mengarahkan peserta ke form registrasi.

### Konten

* Logo atau identitas AKKAI.
* Logo Semangat Rajawali Indonesia apabila diperlukan.
* Nama acara.
* Lokasi acara.
* Tanggal acara.
* Deskripsi singkat.
* Periode registrasi.
* Informasi kontak.
* Tombol utama `Daftar Sekarang`.
* Informasi bahwa QR akan dikirim melalui email.
* Privacy notice singkat.
* Rundown umum tiga hari.

Rundown publik homepage:

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

### Primary CTA

`Daftar Sekarang`

### Secondary CTA

Tidak diperlukan pada MVP.

### State

#### Registrasi dibuka

Tombol `Daftar Sekarang` aktif.

#### Registrasi ditutup

Tampilkan:

```text
Registrasi telah ditutup.

Untuk informasi lebih lanjut, silakan menghubungi panitia.
```

Tombol registrasi tidak aktif.

### Acceptance criteria

* Halaman dapat dibuka tanpa login.
* Halaman tampil baik di layar mobile dan desktop.
* Tombol Daftar Sekarang mengarah ke `/register`.
* Status registrasi dibuka atau ditutup ditentukan oleh konfigurasi sistem.
* Tidak ada data peserta yang tampil.
* Informasi utama dapat dibaca tanpa melakukan zoom pada handphone.

---

## 11.2 Registration Form

**Route:** `/register`

### Tujuan

Mengumpulkan data peserta dan membuat pendaftaran baru.

### Field form

| Field                 | Key                    | Tipe     | Wajib | Validasi                         |
| --------------------- | ---------------------- | -------- | ----: | -------------------------------- |
| Nama lengkap          | `full_name`            | Text     |    Ya | Minimal 3 karakter, maksimal 100 |
| Email                 | `email`                | Email    |    Ya | Format email valid               |
| Nomor WhatsApp        | `phone_number`         | Tel/Text |    Ya | Tidak boleh kosong               |
| Nama KKA              | `kka_name`             | Text     |    Ya | 1-150 karakter                   |
| Ukuran Poloshirt      | `polo_size`            | Select   |    Ya | S, M, L, XL, XXL, XXXL, XXXXL    |
| Model Poloshirt       | `polo_model`           | Select   |    Ya | Lengan Panjang/Pendek            |
| Paket yang diambil    | `package_type`         | Select   |    Ya | Twin Share/Single                |
| Mengikuti             | `participation_scope`  | Select   |    Ya | Seluruh acara/Rapat Anggota/Seminar Profesi Konsultan Aktuaria |
| Konsultan Aktuaria    | `actuarial_consultant_status` | Select | Ya | Peserta Baru/Penerima Grandfathering |
| Hadir Kongres PAI     | `attends_pai_congress` | Select   |    Ya | Ya/Tidak                         |
| Persetujuan data      | `privacy_consent`      | Checkbox |    Ya | Harus dicentang                  |

Informasi event pada halaman registrasi menampilkan `Hotel Gumaya Semarang` sebagai
informasi tetap, bukan field peserta. Institusi/cabang tidak ditampilkan atau
dikirim dari form registrasi baru. Rundown umum tiga hari ditampilkan pada halaman
utama; detail waktu belum ditetapkan.

### Registration hotfix compatibility

`participant_category` dan `member_number` tidak lagi diminta pada form publik
untuk registrant baru. Kolom historis tetap dipertahankan; `participant_category`
menjadi nullable tanpa menghapus nilai lama dan `member_number` tetap nullable.
Pendaftaran baru menggunakan
`create_participant_with_registration_reservation_v3`, sedangkan RPC lama dan
V2 tetap tersedia untuk aplikasi yang belum di-deploy.

### Normalisasi data

Sebelum data disimpan:

* Nama di-trim.
* Multiple spaces diubah menjadi satu spasi.
* Email diubah menjadi lowercase.
* Nama KKA di-trim.
* Nomor WhatsApp hanya menyimpan angka dan tanda plus apabila diperlukan.
* Institusi historis tidak digunakan untuk pendaftaran baru.

### Validasi duplikasi

Pendaftaran dianggap duplikat apabila:

* Email sudah digunakan oleh peserta dengan status `REGISTERED`; atau
* Nomor anggota sudah digunakan oleh peserta dengan status `REGISTERED` melalui
  kontrak registration lama yang masih dipertahankan.

Perbandingan email tidak membedakan huruf besar dan kecil.

Perbandingan nomor anggota tidak membedakan huruf besar dan kecil.

### Pesan validasi

#### Field kosong

```text
Mohon lengkapi data yang wajib diisi.
```

#### Email tidak valid

```text
Format email belum sesuai.
```

#### Nomor WhatsApp tidak valid

```text
Mohon masukkan nomor WhatsApp yang aktif.
```

#### Email sudah terdaftar

```text
Email ini sudah terdaftar.

Silakan cek email konfirmasi sebelumnya atau hubungi panitia.
```

#### Nomor anggota sudah terdaftar

```text
Nomor anggota ini sudah terdaftar.

Silakan cek kembali data Anda atau hubungi panitia.
```

#### Registrasi ditutup

```text
Periode registrasi telah ditutup.
```

### Submission behavior

Saat tombol diklik:

1. Disable tombol submit.
2. Tampilkan loading state.
3. Validasi dilakukan pada client.
4. Validasi ulang dilakukan pada server.
5. Data tidak boleh disimpan dua kali akibat double click.
6. Jika berhasil, arahkan ke halaman sukses.
7. Jika gagal, tombol kembali aktif.
8. Data yang sudah diisi tidak hilang apabila terjadi error umum.

### Tombol

Primary CTA:

`Kirim Pendaftaran`

### Acceptance criteria

* Peserta dapat mengisi form dari handphone.
* Semua field wajib divalidasi.
* Validasi server tetap dilakukan walaupun validasi client dilewati.
* Double click tidak membuat dua peserta.
* Email ganda ditolak; validasi nomor anggota tetap berlaku pada RPC historis.
* Data peserta tersimpan ke database melalui registration RPC V3.
* Registration ID dan QR token otomatis dibuat.
* Peserta diarahkan ke halaman sukses.
* Informasi sensitif tidak muncul pada URL.
* Error sistem ditampilkan dengan bahasa yang mudah dipahami.
* Tidak ada API key rahasia pada client.

---

## 11.3 Registration Success

**Route:** `/registration-success/[registrationId]`

### Tujuan

Memberikan konfirmasi bahwa registrasi telah berhasil.

### Informasi yang ditampilkan

* Status pendaftaran berhasil.
* Nama peserta.
* Registration ID.
* QR code.
* Informasi email tujuan.
* Instruksi menyimpan QR.
* Tombol membuka tiket digital.

### Informasi yang tidak ditampilkan

* Token mentah.
* Database ID.
* Nomor WhatsApp.
* Data administratif.

### Copy utama

```text
Pendaftaran Berhasil

Terima kasih, [Nama Peserta].

Data Anda telah terdaftar untuk Rapat Tahunan AKKAI 2026.
Simpan QR berikut dan tunjukkan kepada panitia saat check-in.
```

### Email masking

Contoh:

```text
Provider email telah menerima request pengiriman tiket ke re***@gmail.com.
```

### Tombol

* `Buka Tiket Digital`
* `Simpan QR`

Apabila fitur download image belum stabil, tombol Simpan QR dapat diarahkan ke instruksi screenshot.

### State email

#### Email sent

```text
Provider email telah menerima request pengiriman tiket ke alamat email Anda.
```

#### Email pending

```text
Email konfirmasi sedang diproses.
```

#### Email failed

```text
Pendaftaran Anda tetap berhasil, tetapi email belum dapat dikirim.

QR tetap dapat digunakan dari halaman ini.
```

### Acceptance criteria

* Hanya pendaftaran valid yang dapat membuka halaman.
* QR dapat dibaca scanner.
* QR tetap ditampilkan meskipun pengiriman email gagal.
* Email ditampilkan dalam bentuk masked.
* Tombol tiket digital berfungsi.
* Refresh halaman tidak membuat pendaftaran baru.
* Halaman mobile-friendly.
* Token QR tidak ditampilkan sebagai teks mentah.

---

## 11.4 Digital Ticket

**Route:** `/ticket/[token]`

### Tujuan

Menjadi tiket digital yang dapat dibuka kembali peserta melalui email.

### Informasi yang ditampilkan

* Nama acara.
* Nama peserta.
* Registration ID.
* QR code.
* Tanggal dan lokasi acara.
* Instruksi penggunaan.
* Status pendaftaran.

### Jika status peserta registered

Tampilkan tiket normal.

### Jika status peserta cancelled

QR tidak ditampilkan sebagai tiket aktif.

Tampilkan:

```text
Tiket Tidak Aktif

Pendaftaran ini telah dibatalkan.
Silakan menghubungi panitia untuk informasi lebih lanjut.
```

### Jika token tidak ditemukan

Tampilkan halaman 404 khusus:

```text
Tiket Tidak Ditemukan

Pastikan tautan yang dibuka sudah benar.
```

### QR payload

Format yang direkomendasikan:

```text
https://domain-registrasi-akkai.com/q/[secure-token]
```

QR tidak boleh menyimpan:

* Nama.
* Email.
* Nomor telepon.
* Nomor anggota.
* Institution.
* Attendance status.

### Acceptance criteria

* Tiket dapat dibuka tanpa login.
* Token tidak dapat ditebak dengan nomor berurutan.
* Tiket cancelled tidak dapat digunakan.
* QR dapat dipindai dari layar handphone.
* QR memiliki kontras dan ukuran yang cukup.
* Halaman dapat dibuka pada Android dan iPhone.
* Data pribadi yang ditampilkan dibatasi pada nama dan Registration ID.

---

# 12. Authentication dan Authorization

## 12.1 Login Admin/Operator

**Route:** `/admin/login`

### Field

| Field    | Wajib | Validasi           |
| -------- | ----: | ------------------ |
| Email    |    Ya | Format email valid |
| Password |    Ya | Tidak boleh kosong |

### Behavior

* Login menggunakan Supabase Auth.
* Hanya akun yang telah dibuat admin yang dapat masuk.
* Peserta tidak dapat membuat akun.
* User diarahkan sesuai halaman terakhir atau dashboard.
* User yang sudah login tidak perlu login kembali selama session valid.

### Error message

```text
Email atau password tidak sesuai.
```

Jangan menginformasikan apakah email terdaftar atau tidak.

### Role

* `ADMIN`
* `OPERATOR`

### Akses ADMIN

* Semua halaman admin.
* Membuka/menutup sesi.
* Edit dan cancel peserta.
* Resend email.
* Export laporan.
* Membuat dan menutup station.

### Akses OPERATOR

* Dashboard terbatas.
* Daftar dan pencarian peserta.
* Scanner.
* Display.
* Check-in manual.
* Tidak dapat cancel peserta.
* Tidak dapat export seluruh data.
* Tidak dapat membuka atau menutup sesi.

### Acceptance criteria

* Halaman admin tidak dapat dibuka tanpa login.
* Role diperiksa pada server, bukan hanya UI.
* Operator tidak dapat mengakses action admin melalui API.
* Pesan error login tidak membocorkan keberadaan akun.
* Service role key Supabase hanya digunakan pada server.
* Logout menghapus session pengguna.

---

# 13. Detail Halaman Admin

## 13.1 Dashboard

**Route:** `/admin/dashboard`

### Tujuan

Menampilkan kondisi registrasi dan kehadiran secara ringkas.

### Summary card

* Total peserta terdaftar.
* Total peserta dibatalkan.
* Email diterima oleh layanan pengiriman.
* Email gagal dikirim.
* Hadir Registrasi Kedatangan.
* Belum hadir Registrasi Kedatangan.
* Hadir Seminar.
* Belum hadir Seminar.

### Session control

Hanya ADMIN yang dapat melihat tombol kontrol.

Untuk setiap sesi tampilkan:

* Nama sesi.
* Tanggal.
* Status `OPEN` atau `CLOSED`.
* Jumlah attendance.
* Tombol `Buka Sesi` atau `Tutup Sesi`.

### Aturan membuka sesi

* Admin harus melakukan konfirmasi.
* Sesi yang sudah dibuka dapat ditutup kembali.
* Station tidak dapat melakukan check-in pada sesi closed.
* Membuka sesi tidak otomatis membuat station.

### Recent attendance

Tampilkan maksimal 10 check-in terbaru:

* Nama peserta.
* Sesi.
* Waktu.
* Metode.
* Operator.

### Active station

Tampilkan:

* Nama station.
* Sesi.
* Status.
* Operator.
* Last activity.

### Acceptance criteria

* Data statistik berasal dari database.
* Statistik dibedakan per sesi.
* Data cancelled tidak dihitung sebagai peserta aktif.
* Hanya admin yang dapat membuka atau menutup sesi.
* Perubahan status sesi langsung memengaruhi scanner.
* Dashboard memperbarui data tanpa perlu refresh penuh apabila memungkinkan.
* Recent attendance diurutkan dari terbaru.

---

## 13.2 Participant List

**Route:** `/admin/participants`

### Tujuan

Memungkinkan admin dan operator mencari dan melihat peserta.

### Kolom tabel

* Registration ID.
* Nama.
* Nomor anggota.
* Institusi.
* Email.
* Status registrasi.
* Status kedatangan.
* Status seminar.
* Waktu registrasi.
* Action.

### Search

Search dapat menggunakan:

* Nama.
* Registration ID.
* Nomor anggota.
* Email.
* Nomor WhatsApp.

### Filter

* Semua peserta.
* Registered.
* Cancelled.
* Hadir semua sesi.
* Hadir kedatangan saja.
* Hadir seminar saja.
* Belum hadir seluruh sesi.
* Email failed.

### Sorting

Default:

```text
created_at DESC
```

Pilihan tambahan:

* Nama A–Z.
* Registration ID.
* Waktu registrasi terbaru.
* Waktu registrasi terlama.

### Pagination

Gunakan server-side pagination.

Default:

```text
25 peserta per halaman
```

Pilihan:

* 25.
* 50.
* 100.

### Action

* Lihat detail.
* Check-in manual.
* Resend email, khusus admin.
* Edit data, khusus admin.
* Cancel, khusus admin.

### Acceptance criteria

* Search tidak case-sensitive.
* Filter dapat dikombinasikan.
* Pagination tidak memuat seluruh data sekaligus.
* Operator tidak melihat action yang tidak diizinkan.
* Cancelled peserta tetap dapat dicari.
* Attendance ditampilkan terpisah per sesi.
* Empty state tersedia ketika hasil tidak ditemukan.

---

## 13.3 Participant Detail

**Route:** `/admin/participants/[id]`

### Informasi peserta

* Registration ID.
* Nama lengkap.
* Nomor anggota.
* Email.
* Nomor WhatsApp.
* Institusi.
* Kategori peserta.
* Registration status.
* Email status.
* Waktu registrasi.
* Waktu update terakhir.
* QR preview.
* Attendance per sesi.
* Attendance log.
* Email log.

### Action admin

* Edit peserta.
* Kirim ulang tiket.
* Cancel registration.
* Check-in manual.
* Membatalkan check-in hanya jika fitur tersebut disetujui sebelum development freeze.

Untuk MVP awal, penghapusan attendance tidak disediakan melalui UI.

### Action operator

* Melihat peserta.
* Check-in manual.
* Tidak dapat edit.
* Tidak dapat cancel.
* Tidak dapat resend email.

### Edit field

Admin dapat mengedit:

* Nama lengkap.
* Nomor anggota.
* Email.
* Nomor WhatsApp.
* Institusi.
* Kategori peserta.

Admin tidak dapat mengedit:

* Database ID.
* Registration ID.
* QR token.
* Created at.
* Attendance langsung dari form edit.

### Aturan edit email

Jika email diubah:

* Sistem memeriksa duplikasi.
* Email status berubah menjadi `PENDING`.
* Admin dapat mengirim ulang tiket.
* Perubahan email tidak mengubah QR.

### Aturan edit nomor anggota

* Harus tetap unik.
* Perbandingan tidak case-sensitive.
* Tidak mengubah Registration ID.

### Cancel registration

Admin harus melihat dialog:

```text
Batalkan Pendaftaran?

Peserta tidak akan dapat melakukan check-in setelah pendaftaran dibatalkan.
Data dan histori peserta tetap disimpan.
```

Tombol:

* `Kembali`
* `Batalkan Pendaftaran`

### Acceptance criteria

* Data peserta dapat dibuka berdasarkan ID internal yang aman.
* Operator tidak dapat mengedit data.
* Email dan nomor anggota tetap unik setelah edit.
* Cancelled participant tidak dapat check-in.
* Histori attendance tidak terhapus ketika peserta dibatalkan.
* QR token tidak dapat diubah dari UI.
* Semua perubahan mencatat `updated_at`.

---

## 13.4 Resend Email

Resend email dilakukan melalui halaman participant detail atau participant list.

### Flow

```text
Admin menekan Kirim Ulang Tiket
        ↓
Sistem meminta konfirmasi
        ↓
Sistem membuat email job
        ↓
Email dikirim
        ↓
Email status diperbarui
        ↓
Email log disimpan
```

### Aturan

* Hanya admin.
* Tidak membuat QR baru.
* Tidak mengubah Registration ID.
* Maksimal pengiriman ulang per peserta dapat dibatasi untuk mencegah spam.
* Rekomendasi batas MVP: 5 kali per peserta dalam 24 jam.
* Jika email gagal, status menjadi `FAILED`.
* Pendaftaran tetap aktif.

### Acceptance criteria

* Resend menggunakan token yang sama.
* Email log menyimpan waktu dan hasil pengiriman.
* Tombol memiliki loading state.
* Double click tidak mengirim dua email.
* Error provider email ditangani tanpa membatalkan peserta.

---

# 14. Pairing Handphone dan Laptop

## 14.1 Display Setup

**Route:** `/admin/display/setup`

### Tujuan

Membuat station dan memasangkan laptop dengan handphone scanner.

### Field

| Field        | Wajib | Keterangan                |
| ------------ | ----: | ------------------------- |
| Nama station |    Ya | Contoh: Meja Registrasi 1 |
| Sesi aktif   |    Ya | ARRIVAL, SEMINAR, atau DAY3 |

### Validasi

* Nama station minimal 3 karakter.
* Sesi harus berstatus `OPEN`.
* User harus login.
* Operator dapat membuat station.
* Station lama dapat ditutup sebelum membuat station baru.

### Setelah submit

Sistem membuat:

* `station_id`.
* Pairing token.
* Pairing code enam digit.
* QR pairing.
* Expiration time.
* Status `WAITING_PAIRING`.

### Pairing code

* Enam digit.
* Berlaku 15 menit.
* Tidak ditampilkan setelah pairing berhasil.
* Tidak boleh digunakan ulang setelah station paired.
* Server menyimpan versi aman, bukan nilai yang mudah disalahgunakan.

### Display pairing screen

Tampilkan:

* Nama station.
* Nama sesi.
* QR pairing.
* Kode enam digit.
* Countdown expiry.
* Tombol batalkan station.

### QR pairing payload

```text
https://domain.com/admin/scanner/pair?station=[stationId]&pair=[temporaryToken]
```

### Acceptance criteria

* Station hanya dibuat untuk sesi open.
* QR pairing dapat dipindai melalui kamera handphone.
* Kode kedaluwarsa setelah 15 menit.
* Pairing token hanya dapat digunakan sekali.
* Station berubah menjadi paired ketika handphone berhasil terhubung.
* Laptop otomatis berpindah ke live display setelah pairing.

---

## 14.2 Pair Scanner

**Route:** `/admin/scanner/pair`

### Tujuan

Menghubungkan handphone operator ke station.

### Flow QR pairing

1. Operator membuka QR pairing menggunakan handphone.
2. Jika belum login, operator diarahkan login.
3. Setelah login, sistem memvalidasi token.
4. Sistem menampilkan detail station.
5. Operator menekan `Hubungkan Scanner`.
6. Station berubah menjadi `PAIRED`.
7. Handphone diarahkan ke halaman scanner.

### Flow kode manual

Operator juga dapat:

* Memilih `Masukkan Kode`.
* Memasukkan enam digit pairing code.
* Memvalidasi station.
* Menekan `Hubungkan Scanner`.

### Informasi konfirmasi

```text
Hubungkan ke Station?

Station: Meja Registrasi 1
Sesi: Seminar AKKAI 2026
```

### Acceptance criteria

* Token expired ditolak.
* Token yang sudah digunakan ditolak.
* Session closed ditolak.
* Operator harus login.
* Detail station ditampilkan sebelum pairing.
* Satu station hanya memiliki satu scanner aktif pada MVP.
* Pairing scanner baru memutus scanner sebelumnya setelah konfirmasi admin/operator.

---

# 15. Scanner Handphone

## 15.1 Scanner Page

**Route:** `/admin/scanner/[stationId]`

### Tujuan

Menggunakan kamera handphone untuk membaca QR peserta.

### Informasi header

* Nama station.
* Nama sesi.
* Status koneksi.
* Nama operator.
* Tombol keluar station.

### Camera behavior

* Meminta izin kamera.
* Menggunakan kamera belakang sebagai default.
* Menampilkan area scan.
* Menampilkan instruksi.
* Scanner berhenti sementara setelah QR terbaca.
* Scanner aktif kembali setelah hasil selesai diproses.
* Scanner tidak memproses token yang sama berulang kali dalam waktu sangat pendek.

### Library

Gunakan library scanner browser yang stabil seperti ZXing Browser atau alternatif yang telah diuji.

Jangan hanya bergantung pada browser BarcodeDetector.

### Scan processing

Handphone mengirim:

* QR token.
* Station ID.
* Operator ID.
* Timestamp client untuk informasi tambahan.
* Device information minimum apabila diperlukan.

Server menentukan waktu resmi menggunakan server timestamp.

### Validasi server

Urutan validasi:

1. User login.
2. User memiliki role admin/operator.
3. Station ditemukan.
4. Station aktif.
5. Scanner sesuai dengan station.
6. Session ditemukan.
7. Session open.
8. QR token valid.
9. Participant ditemukan.
10. Participant registered.
11. Attendance belum ada untuk session tersebut.
12. Simpan attendance.
13. Simpan scan event.
14. Kembalikan hasil.

### Tampilan sukses

```text
CHECK-IN BERHASIL

[Nama Peserta]

Sesi:
[Nama Sesi]

Waktu:
[Waktu Check-in]
```

### Seminar tanpa kedatangan

```text
CHECK-IN SEMINAR BERHASIL

[Nama Peserta]

Perhatian:
Peserta belum tercatat pada sesi Registrasi Kedatangan.
```

Result:

```text
SUCCESS_WITH_WARNING
```

### Sudah check-in

```text
SUDAH CHECK-IN

[Nama Peserta]

Check-in sebelumnya:
[Tanggal dan Waktu]
```

### QR tidak valid

```text
QR TIDAK VALID

Data peserta tidak ditemukan.
Silakan arahkan peserta ke Help Desk.
```

### Peserta cancelled

```text
CHECK-IN DITOLAK

Pendaftaran peserta telah dibatalkan.
Silakan arahkan peserta ke Help Desk.
```

### Koneksi gagal

```text
CHECK-IN BELUM TERSIMPAN

Periksa koneksi internet dan coba kembali.
```

### Auto reset

* Success: kembali scanner setelah 2–3 detik.
* Warning: kembali scanner setelah 4–5 detik.
* Already check-in: kembali setelah 4–5 detik.
* Error: operator menekan `Coba Lagi`.

### Feedback tambahan

* Bunyi singkat saat berhasil.
* Bunyi berbeda saat gagal.
* Getaran ringan jika didukung.
* Semua feedback harus memiliki padanan visual.

### Acceptance criteria

* Scanner dapat menggunakan kamera belakang Android.
* Scanner dapat digunakan melalui Safari iPhone.
* Scanner membaca QR dari layar handphone lain.
* Scanner membaca QR cetak.
* Scanner tidak langsung menyatakan berhasil sebelum server mengonfirmasi.
* QR yang sama dapat digunakan pada tiga sesi berbeda.
* QR yang sama ditolak untuk scan kedua pada sesi yang sama.
* Hasil scan muncul di handphone.
* Hasil scan dikirim ke laptop.
* Scanner memiliki indikator online/offline.
* Kamera dihentikan ketika user keluar dari halaman.

---

# 16. Laptop Live Display

## 16.1 Display Page

**Route:** `/admin/display/[stationId]`

### Tujuan

Menampilkan hasil scan dari handphone secara real-time.

### Standby state

Tampilkan:

* Nama acara.
* Nama session aktif.
* Nama station.
* Status scanner.
* Instruksi:

```text
Silakan tunjukkan QR kepada petugas.
```

### Successful scan state

Tampilkan dengan ukuran besar:

* Status `CHECK-IN BERHASIL`.
* Nama peserta.
* Registration ID.
* Nomor anggota jika diperlukan.
* Institusi.
* Nama sesi.
* Waktu check-in.

### Informasi yang tidak ditampilkan

* Email.
* Nomor WhatsApp.
* QR token.
* Database ID.
* Data pribadi tambahan.

### Warning state

Untuk peserta seminar tanpa attendance kedatangan:

```text
CHECK-IN SEMINAR BERHASIL

[Nama Peserta]

Belum tercatat pada sesi Registrasi Kedatangan.
```

### Already checked-in state

Tampilkan:

* Nama peserta.
* Sesi.
* Waktu check-in sebelumnya.

### Invalid state

Tampilkan:

```text
QR TIDAK VALID

Silakan arahkan peserta ke Help Desk.
```

### Display duration

* Success: 5–8 detik.
* Warning: 8–10 detik.
* Already checked-in: 8 detik.
* Invalid: 8 detik.

Setelah itu kembali ke standby.

### Real-time mechanism

* Laptop subscribe ke event berdasarkan `station_id`.
* Event dari station lain tidak boleh muncul.
* Server menyimpan setiap scan event.
* Jika koneksi real-time terputus, halaman mencoba reconnect otomatis.
* Setelah reconnect, laptop mengambil scan event terakhir yang belum ditampilkan.
* Sebagai fallback, laptop dapat melakukan polling ringan.

### Connection state

Online:

```text
Scanner terhubung
```

Disconnected:

```text
Scanner terputus

Menunggu koneksi kembali…
```

### Acceptance criteria

* Hanya scan dari station yang sama yang muncul.
* Display berubah tanpa refresh manual.
* Data pribadi dibatasi.
* Display kembali ke standby otomatis.
* Connection status terlihat.
* Display dapat recovery setelah koneksi terputus.
* Refresh laptop tidak menghapus station.
* Station closed mengarahkan ke halaman setup atau status selesai.

---

# 17. Manual Check-in

Manual check-in tersedia dari:

* Participant list.
* Participant detail.
* Help desk search.

### Field

| Field   | Wajib | Keterangan            |
| ------- | ----: | --------------------- |
| Session |    Ya | ARRIVAL, SEMINAR, atau DAY3  |
| Notes   | Tidak | Maksimal 250 karakter |

### Flow

1. Operator memilih peserta.
2. Operator menekan `Check-in Manual`.
3. Operator memilih sesi.
4. Sistem menampilkan status attendance.
5. Operator mengisi catatan jika diperlukan.
6. Operator mengonfirmasi.
7. Server melakukan validasi.
8. Attendance disimpan dengan method `MANUAL`.

### Aturan

* Session harus open.
* Participant harus registered.
* Attendance untuk kombinasi participant dan session belum ada.
* Operator harus login.
* Waktu menggunakan server timestamp.
* Notes disimpan pada attendance.
* Scan event atau audit log tetap dibuat.
* Manual check-in seminar tanpa arrival diperbolehkan dengan peringatan.

### Acceptance criteria

* Operator dapat check-in tanpa QR.
* Duplicate manual check-in ditolak.
* Manual check-in tercatat sebagai `MANUAL`.
* Operator ID tersimpan.
* Notes tersimpan.
* Hasil langsung terlihat pada dashboard.
* Check-in manual tidak membuat QR baru.

---

# 18. Reporting

## 18.1 Reports Page

**Route:** `/admin/reports`

### Akses

ADMIN saja.

### Jenis laporan

#### Laporan keseluruhan

Kolom:

* Registration ID.
* Nama.
* Nomor anggota.
* Email.
* Nomor WhatsApp.
* Institusi.
* Kategori peserta.
* Registration status.
* Email status.
* Waktu registrasi.
* Status kedatangan.
* Waktu kedatangan.
* Metode kedatangan.
* Status seminar.
* Waktu seminar.
* Metode seminar.

#### Laporan Registrasi Kedatangan

Kolom:

* Registration ID.
* Nama.
* Nomor anggota.
* Institusi.
* Status kehadiran.
* Waktu check-in.
* Metode.
* Operator.
* Notes.

#### Laporan Seminar

Kolom:

* Registration ID.
* Nama.
* Nomor anggota.
* Institusi.
* Status kehadiran.
* Waktu check-in.
* Metode.
* Operator.
* Notes.
* Status kehadiran kedatangan.

### Filter laporan

* Registration status.
* Session.
* Attendance status.
* Participant category.
* Institution.
* Tanggal registrasi.
* Metode check-in.

### Format export

Minimum:

* CSV.

Opsional jika implementasinya stabil:

* XLSX.

### Nama file

```text
akkai-2026-all-participants-YYYYMMDD-HHmm.csv
akkai-2026-arrival-attendance-YYYYMMDD-HHmm.csv
akkai-2026-seminar-attendance-YYYYMMDD-HHmm.csv
```

### Acceptance criteria

* Export hanya dapat dilakukan admin.
* File menggunakan UTF-8.
* Filter diterapkan pada file export.
* Waktu ditampilkan dalam WIB.
* Cancelled participant tetap muncul pada laporan keseluruhan.
* Laporan per sesi membedakan hadir dan belum hadir.
* Export tidak membocorkan QR token.
* Export tidak menyertakan password atau data authentication.

---

# 19. Aturan Bisnis Global

## BR-001 — Satu peserta, satu Registration ID

Setiap participant memiliki satu Registration ID permanen.

Format:

```text
AKKAI26-000001
```

Nomor harus unik dan tidak digunakan ulang.

## BR-002 — Satu peserta, satu QR

Setiap participant memiliki satu QR token permanen.

QR yang sama digunakan pada seluruh sesi.

## BR-003 — QR tidak berisi data pribadi

QR hanya berisi URL atau token acak.

## BR-004 — Email harus unik

Email tidak dapat digunakan oleh lebih dari satu participant registered.

## BR-005 — Nomor anggota harus unik

Nomor anggota tidak dapat digunakan oleh lebih dari satu participant registered.

## BR-006 — Cancelled participant tidak dapat check-in

Jika status participant `CANCELLED`, seluruh check-in ditolak.

## BR-007 — Attendance bersifat per sesi

Attendance ditentukan oleh kombinasi:

```text
participant_id + session_id
```

Kombinasi tersebut harus unik.

## BR-008 — Scan ganda ditolak

Scan kedua pada sesi yang sama tidak membuat attendance baru.

## BR-009 — QR dapat digunakan pada sesi berbeda

Attendance kedatangan tidak menghalangi attendance seminar.

## BR-010 — Seminar tidak wajib memiliki kedatangan

Peserta tetap dapat check-in seminar walaupun belum hadir pada sesi kedatangan.

Sistem menampilkan warning.

## BR-011 — Session harus open

Check-in hanya dapat dilakukan ketika status session `OPEN`.

## BR-012 — Waktu resmi dari server

Semua waktu registrasi dan attendance menggunakan server timestamp.

## BR-013 — Email gagal tidak membatalkan registrasi

Participant tetap berstatus registered meskipun email failed.

## BR-014 — Edit data tidak mengubah QR

Perubahan nama, email, atau institusi tidak membuat token baru.

## BR-015 — Pembatalan tidak menghapus data

Cancel hanya mengubah status.

Data dan attendance log tetap disimpan.

## BR-016 — Laptop bukan sumber keberhasilan check-in

Check-in dinyatakan berhasil hanya setelah server menyimpan attendance.

## BR-017 — Station hanya terhubung dengan satu sesi

Pergantian sesi membutuhkan station baru atau proses perubahan yang dikonfirmasi.

## BR-018 — Satu scanner aktif per station

Pada MVP, satu station hanya memiliki satu scanner aktif.

## BR-019 — Pairing bersifat sementara

Token pairing kedaluwarsa dalam 15 menit dan hanya dapat digunakan satu kali.

## BR-020 — Data sensitif tidak ditampilkan pada display

Laptop display hanya menampilkan data minimum yang diperlukan.

---

# 20. Data Model

## 20.1 Table `participants`

| Column                 | Type      | Keterangan               |
| ---------------------- | --------- | ------------------------ |
| `id`                   | UUID      | Primary key              |
| `registration_id`      | Text      | Unique human-readable ID |
| `full_name`            | Text      | Nama peserta             |
| `member_number`        | Text      | Nullable, optional, unique normalized |
| `email`                | Text      | Unique, lowercase        |
| `phone_number`         | Text      | Nomor WhatsApp           |
| `institution`          | Text      | Nullable, data historis  |
| `participant_category` | Text      | Nullable historical value |
| `kka_name`             | Text      | Nullable untuk data lama |
| `polo_size`            | Text      | Nullable untuk data lama; S/M/L/XL/XXL/XXXL/XXXXL |
| `polo_model`           | Text      | Nullable untuk data lama |
| `package_type`         | Text      | Nullable untuk peserta lama; Twin Share/Single |
| `participation_scope`  | Text      | Nullable untuk peserta lama; tiga pilihan hotfix |
| `actuarial_consultant_status` | Text | Nullable untuk peserta lama; dua pilihan hotfix |
| `attends_pai_congress` | Boolean   | Nullable untuk peserta lama; Ya/Tidak |
| `registration_status`  | Enum      | REGISTERED/CANCELLED     |
| `email_status`         | Enum      | PENDING/SENT/FAILED      |
| `qr_token`             | Text      | Unique secure token      |
| `last_email_sent_at`   | Timestamp | Nullable                 |
| `privacy_consent_at`   | Timestamp | Waktu persetujuan        |
| `created_at`           | Timestamp | Server time              |
| `updated_at`           | Timestamp | Server time              |

H-3D1 membuat `institution` nullable untuk mempertahankan data historis dan
menambahkan `kka_name`, `polo_size`, serta `polo_model` secara nullable. Migration
hotfix menambahkan empat field registrasi secara nullable dan menggunakan RPC V3
untuk mewajibkan jawabannya pada pendaftaran baru; row lama tidak di-backfill.

## 20.2 Table `sessions`

| Column       | Type      | Keterangan      |
| ------------ | --------- | --------------- |
| `id`         | UUID      | Primary key     |
| `code`       | Text      | ARRIVAL/SEMINAR/DAY3 |
| `name`       | Text      | Nama sesi       |
| `event_date` | Date      | Tanggal sesi    |
| `status`     | Enum      | OPEN/CLOSED     |
| `opened_at`  | Timestamp | Nullable        |
| `closed_at`  | Timestamp | Nullable        |
| `created_at` | Timestamp | Server time     |
| `updated_at` | Timestamp | Server time     |

## 20.3 Table `attendance`

| Column            | Type      | Keterangan            |
| ----------------- | --------- | --------------------- |
| `id`              | UUID      | Primary key           |
| `participant_id`  | UUID      | FK participant        |
| `session_id`      | UUID      | FK session            |
| `check_in_time`   | Timestamp | Server time           |
| `check_in_method` | Enum      | QR/MANUAL             |
| `operator_id`     | UUID      | FK profile            |
| `station_id`      | UUID      | Nullable untuk manual |
| `notes`           | Text      | Nullable              |
| `created_at`      | Timestamp | Server time           |

Constraint wajib:

```text
UNIQUE(participant_id, session_id)
```

## 20.4 Table `profiles`

| Column       | Type      | Keterangan            |
| ------------ | --------- | --------------------- |
| `id`         | UUID      | Sama dengan auth user |
| `full_name`  | Text      | Nama pengguna         |
| `email`      | Text      | Email pengguna        |
| `role`       | Enum      | ADMIN/OPERATOR        |
| `is_active`  | Boolean   | Status akun           |
| `created_at` | Timestamp | Server time           |
| `updated_at` | Timestamp | Server time           |

## 20.5 Table `scanner_stations`

| Column               | Type      | Keterangan         |
| -------------------- | --------- | ------------------ |
| `id`                 | UUID      | Primary key        |
| `station_name`       | Text      | Nama meja          |
| `session_id`         | UUID      | Sesi station       |
| `status`             | Enum      | Status station     |
| `pairing_code_hash`  | Text      | Kode pairing aman  |
| `pairing_token_hash` | Text      | Token pairing aman |
| `pairing_expires_at` | Timestamp | Masa berlaku       |
| `paired_operator_id` | UUID      | Nullable           |
| `paired_at`          | Timestamp | Nullable           |
| `last_activity_at`   | Timestamp | Nullable           |
| `created_by`         | UUID      | Creator            |
| `created_at`         | Timestamp | Server time        |
| `closed_at`          | Timestamp | Nullable           |

## 20.6 Table `scan_events`

| Column           | Type      | Keterangan            |
| ---------------- | --------- | --------------------- |
| `id`             | UUID      | Primary key           |
| `station_id`     | UUID      | Station asal          |
| `participant_id` | UUID      | Nullable jika invalid |
| `session_id`     | UUID      | Session               |
| `attendance_id`  | UUID      | Nullable              |
| `result_status`  | Enum      | Hasil scan            |
| `result_message` | Text      | Pesan sistem          |
| `operator_id`    | UUID      | Scanner operator      |
| `scanned_at`     | Timestamp | Server time           |
| `displayed_at`   | Timestamp | Nullable              |
| `metadata`       | JSON      | Data teknis minimum   |

## 20.7 Table `email_logs`

| Column                | Type      | Keterangan                |
| --------------------- | --------- | ------------------------- |
| `id`                  | UUID      | Primary key               |
| `participant_id`      | UUID      | Participant               |
| `email_type`          | Text      | REGISTRATION/RESEND       |
| `recipient_email`     | Text      | Email tujuan              |
| `provider_message_id` | Text      | Nullable                  |
| `status`              | Enum      | PENDING/SENT/FAILED       |
| `error_message`       | Text      | Nullable                  |
| `sent_by`             | UUID      | Nullable untuk automation |
| `created_at`          | Timestamp | Server time               |
| `sent_at`             | Timestamp | Nullable                  |

## 20.8 Table `participant_travel`

Satu row current travel per participant. Tabel ini menyimpan satu tanggal dan
satu waktu per leg keberangkatan/pulang, moda transportasi text, nomor
transportasi opsional, titik asal/tujuan, dan `extend_stay`.

## 20.9 Table `participant_room_assignments`

Satu row assignment kamar saat ini per participant. Hotel tetap
`Hotel Gumaya Semarang` dan tidak disimpan sebagai pilihan hotel peserta.
`room_number` nullable untuk membedakan assignment yang belum lengkap.

## 20.10 Table `participant_pickup_assignments`

Satu row assignment penjemputan saat ini per participant dengan status
`SCHEDULED`, `COMPLETED`, atau `CANCELLED`. Tidak adanya row berarti belum ada
assignment. Mutation dikelola oleh ADMIN.

---

# 21. Security Requirements

* Seluruh website menggunakan HTTPS.
* Admin area membutuhkan authentication.
* Authorization diperiksa di server.
* Supabase Row Level Security harus diaktifkan.
* Participant tidak dapat membaca data participant lain.
* Public ticket hanya dapat membaca data minimum berdasarkan token.
* Service role key tidak boleh dikirim ke browser.
* API key email hanya disimpan dalam environment variable server.
* `.env.local` harus masuk `.gitignore`.
* QR token dibuat menggunakan generator acak yang aman.
* Token tidak menggunakan nomor berurutan.
* Pairing token hanya berlaku sekali.
* Password tidak disimpan di database aplikasi.
* Rate limiting diterapkan pada registrasi dan scan endpoint jika memungkinkan.
* Form dilindungi dari submission otomatis dasar.
* Input disanitasi.
* Error production tidak menampilkan stack trace.
* Data export hanya tersedia untuk admin.
* Audit minimum tersedia melalui attendance, scan event, dan email log.

---

# 22. Privacy Requirements

Data yang dikumpulkan hanya digunakan untuk operasional AKKAI 2026.

Privacy notice minimum:

```text
Dengan mengirimkan formulir ini, Anda menyetujui penggunaan data untuk keperluan registrasi, komunikasi, dan administrasi Rapat Tahunan AKKAI 2026.
```

Data yang tidak boleh ditampilkan pada laptop display:

* Email.
* Nomor WhatsApp.
* QR token.
* Data autentikasi.
* Data pribadi tambahan.

Data yang boleh ditampilkan:

* Nama.
* Registration ID.
* Nomor anggota jika disetujui.
* Institusi.
* Status check-in.
* Nama sesi.
* Waktu check-in.

---

# 23. Non-Functional Requirements

## Performance

* Form submit target maksimal 3 detik pada koneksi normal.
* Hasil scan target maksimal 2 detik setelah QR terbaca.
* Live display target berubah maksimal 2 detik setelah server menyimpan attendance.
* Participant list menggunakan pagination.
* Query dashboard menggunakan index yang sesuai.

## Reliability

* Attendance tidak boleh tercatat dua kali.
* Sistem harus aman terhadap double click.
* Scanner tidak menampilkan success sebelum data tersimpan.
* Scan event disimpan walaupun laptop display terputus.
* Display mengambil hasil terakhir setelah reconnect.
* Error email tidak mengubah status registrasi.

## Compatibility

Minimum pengujian:

* Android Chrome.
* iPhone Safari.
* Desktop Chrome.
* MacOS Chrome.
* QR dari layar.
* QR tercetak.

## Responsiveness

* Public form: mobile-first.
* Scanner: khusus mobile tetapi tetap dapat dibuka tablet.
* Dashboard: desktop dan tablet.
* Display: desktop landscape.

## Accessibility

* Status tidak hanya dibedakan melalui warna.
* Button memiliki label jelas.
* Form memiliki label.
* Error terkait langsung dengan field.
* Kontras teks memadai.
* Ukuran tombol scanner mudah disentuh.

## Timezone

Semua waktu operasional ditampilkan dalam:

```text
Asia/Jakarta / WIB
```

Database tetap dapat menyimpan UTC.

---

# 24. Email Specification

## Subject

```text
Tiket Registrasi Rapat Tahunan AKKAI 2026
```

## Body utama

```text
Halo [Nama Peserta],

Pendaftaran Anda untuk Rapat Tahunan AKKAI 2026 telah berhasil.

Registration ID:
[Registration ID]

Silakan simpan QR pada email ini dan tunjukkan kepada panitia saat proses check-in.

QR yang sama akan digunakan untuk:
1. Registrasi Kedatangan
2. Seminar AKKAI 2026

Tanggal:
19–21 Oktober 2026

Lokasi:
Semarang

Buka tiket digital:
[Ticket URL]

Salam,
Panitia Rapat Tahunan AKKAI 2026
Semangat Rajawali Indonesia
```

## Email requirements

* Mobile-friendly.
* QR tampil jelas.
* Memiliki text fallback berupa link tiket.
* Tidak menyertakan token sebagai teks terbuka selain di URL.
* Email tidak mengandung klaim keberhasilan kehadiran.
* Jika image QR gagal dimuat, link ticket tetap tersedia.

---

# 25. Empty, Loading, dan Error States

Setiap halaman wajib memiliki:

## Loading state

* Skeleton atau spinner.
* Button disabled saat request aktif.
* Tidak membuat user mengirim request berulang.

## Empty state participant

```text
Belum ada peserta yang sesuai dengan pencarian.
```

## Empty state attendance

```text
Belum ada peserta yang melakukan check-in pada sesi ini.
```

## General error

```text
Terjadi kendala saat memproses permintaan.

Silakan coba kembali.
```

## Unauthorized

```text
Anda tidak memiliki akses ke halaman ini.
```

## Session closed

```text
Sesi check-in belum dibuka atau telah ditutup.
```

## Station disconnected

```text
Scanner terputus.

Sistem akan mencoba menghubungkan kembali secara otomatis.
```

---

# 26. Acceptance Criteria Global

MVP dinyatakan layak digunakan apabila seluruh kondisi berikut terpenuhi:

## Registrasi

1. Peserta dapat membuka halaman dari handphone.
2. Peserta dapat mengisi seluruh field.
3. Field wajib tervalidasi.
4. Email ganda ditolak.
5. Nomor anggota ganda ditolak.
6. Double click tidak membuat data ganda.
7. Registration ID dibuat otomatis.
8. QR token dibuat otomatis.
9. Data tersimpan di database.
10. Halaman sukses ditampilkan.

## Tiket dan email

11. QR tampil pada halaman sukses.
12. Tiket digital dapat dibuka.
13. Email konfirmasi dapat dikirim.
14. Email failed tidak membatalkan registrasi.
15. Admin dapat melakukan resend.
16. Resend tidak membuat QR baru.
17. Cancelled ticket tidak dapat digunakan.

## Authentication

18. Admin area membutuhkan login.
19. Role admin dan operator dibedakan.
20. Operator tidak dapat menjalankan action admin.
21. User dapat logout.

## Sesi

22. Tiga sesi tersedia di database: ARRIVAL, SEMINAR, dan DAY3.
23. Admin dapat membuka dan menutup sesi.
24. Closed session tidak menerima check-in.
25. QR yang sama dapat digunakan pada ketiga sesi.
26. QR tidak dapat digunakan dua kali pada sesi yang sama.
27. Seminar tanpa arrival tetap berhasil dengan warning.

## Scanner dan display

28. Laptop dapat membuat station.
29. Pairing code dan QR pairing dibuat.
30. Handphone dapat terhubung ke station.
31. Pairing token hanya dapat digunakan sekali.
32. Kamera handphone dapat membaca QR.
33. Server memvalidasi QR.
34. Attendance tersimpan.
35. Hasil terlihat di handphone.
36. Hasil terlihat di laptop.
37. Laptop hanya menerima event dari station yang sama.
38. Display kembali standby otomatis.
39. Invalid QR ditolak.
40. Cancelled participant ditolak.
41. Scanner memiliki indikator koneksi.
42. Display dapat reconnect.

## Manual check-in

43. Operator dapat mencari peserta.
44. Operator dapat memilih sesi.
45. Manual check-in tersimpan.
46. Duplicate manual check-in ditolak.
47. Method tercatat sebagai MANUAL.
48. Operator dan waktu tercatat.

## Dashboard dan laporan

49. Dashboard menampilkan total peserta.
50. Dashboard menampilkan attendance per sesi.
51. Participant dapat dicari.
52. Participant dapat difilter.
53. Admin dapat mengedit peserta.
54. Admin dapat membatalkan peserta.
55. Admin dapat export laporan keseluruhan.
56. Admin dapat export laporan per sesi.
57. QR token tidak muncul dalam export.

## Testing

58. Sistem diuji dengan minimal 50 data dummy.
59. Sistem diuji dengan dua scanner secara berurutan.
60. Sistem diuji dengan QR dari layar handphone.
61. Sistem diuji dengan QR cetak.
62. Sistem diuji pada Android.
63. Sistem diuji pada iPhone.
64. Sistem diuji pada koneksi lambat.
65. Sistem diuji ketika laptop disconnect.
66. Sistem diuji ketika email gagal.
67. Sistem diuji ketika QR dipindai dua kali.
68. Sistem diuji ketika participant cancelled.

---

# 27. Definition of Done

Satu fitur dianggap selesai apabila:

* Requirement telah diimplementasikan.
* TypeScript tidak memiliki error.
* Lint berjalan tanpa error kritis.
* Production build berhasil.
* Tidak ada secret di repository.
* Happy path telah diuji.
* Error path utama telah diuji.
* Responsive state telah diuji.
* Acceptance criteria fitur terpenuhi.
* Perubahan telah di-commit.
* Dokumentasi diperbarui.
* Tidak merusak fitur lain.

MVP dianggap selesai apabila:

* Seluruh acceptance criteria prioritas wajib terpenuhi.
* UAT internal Semangat Rajawali Indonesia selesai.
* UAT PIC AKKAI selesai.
* Data dummy telah dibersihkan.
* Production environment terpisah dari development.
* Akun operator telah dibuat.
* Backup database tersedia.
* SOP hari-H tersedia.
* Perangkat hari-H telah disimulasikan.

---

# 28. Technical Stack Recommendation

## Application

* Next.js dengan App Router.
* TypeScript.
* Tailwind CSS.
* shadcn/ui atau komponen serupa.
* Server Actions atau Route Handlers sesuai kebutuhan.

## Database dan Auth

* Supabase PostgreSQL.
* Supabase Auth.
* Supabase Row Level Security.
* Supabase Realtime.

## Email

* Resend atau provider transactional email lain.

## QR

* QR generator library pada server atau client.
* ZXing Browser atau library scanner yang telah diuji.

## Hosting

* Vercel.

## Source control

* GitHub.

## Mockup/UI

* v0.

## Coding agent

* OpenCode.

---

# 29. Environment Variables

Contoh nama variable:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Aturan:

* Variable dengan service key hanya tersedia di server.
* Secret tidak boleh di-hardcode.
* `.env.example` boleh disimpan tanpa nilai.
* `.env.local` tidak boleh masuk Git.

---

# 30. Struktur Dokumentasi Repository

```text
/docs
  PRD.md
  database-schema.md
  business-rules.md
  test-cases.md
  deployment-guide.md
  day-h-sop.md
  changelog.md
```

PRD ini menjadi source of truth utama.

Apabila terjadi perbedaan antara prompt AI dan PRD, PRD harus diutamakan kecuali Product Owner memperbarui dokumen secara tertulis.

---

# 31. Urutan Implementasi

## Phase 1 — Foundation

* Setup repository.
* Setup Next.js.
* Setup Supabase.
* Setup authentication.
* Setup database schema.
* Setup development deployment.
* Seed tiga sessions melalui initial seed dan migration DAY3 additive.

## Phase 2 — Public registration

* Landing page.
* Registration form.
* Validation.
* Duplicate prevention.
* Participant creation.
* Registration ID.
* QR token.
* Success page.

## Phase 3 — Ticket and email

* Digital ticket.
* QR rendering.
* Transactional email.
* Email status.
* Email log.
* Resend email.

## Phase 4 — Admin

* Login.
* Role authorization.
* Dashboard.
* Participant list.
* Search.
* Filter.
* Participant detail.
* Edit.
* Cancel.

## Phase 5 — Attendance

* Session control.
* Station creation.
* Pairing.
* Mobile scanner.
* Scan endpoint.
* Attendance storage.
* Manual check-in.
* Duplicate prevention.

## Phase 6 — Realtime display

* Laptop display.
* Station-specific channel.
* Scan result states.
* Connection handling.
* Reconnect fallback.

## Phase 7 — Reports and testing

* Reports.
* CSV export.
* Device testing.
* Load simulation.
* Security review.
* UAT.
* Production deployment.

---

# 32. Instruksi untuk v0

Saat memberikan PRD kepada v0:

* Fokuskan v0 pada UI dan frontend.
* Jangan meminta v0 membuat seluruh aplikasi sekaligus.
* Buat halaman secara bertahap.
* Semua UI harus mengikuti route dan state dalam PRD.
* Jangan menambahkan fitur di luar scope.
* Gunakan data dummy.
* Jangan memasukkan credential asli.
* Pastikan layout mobile-first untuk participant dan scanner.
* Pastikan laptop display menggunakan layout landscape.
* Hasil v0 harus dapat diteruskan ke repository Next.js.

Urutan halaman v0:

1. Landing page.
2. Registration form.
3. Registration success.
4. Digital ticket.
5. Admin login.
6. Dashboard.
7. Participant list.
8. Participant detail.
9. Display setup.
10. Mobile scanner.
11. Laptop live display.
12. Reports.

---

# 33. Instruksi untuk OpenCode

Sebelum mengubah kode, OpenCode harus membaca:

```text
docs/PRD.md
docs/database-schema.md
docs/business-rules.md
```

Setiap task harus:

* Memiliki scope kecil.
* Tidak mengubah fitur di luar task.
* Menyebutkan file yang diubah.
* Menjalankan typecheck.
* Menjalankan lint.
* Menjalankan production build.
* Menjelaskan migration database.
* Menambahkan test bila relevan.
* Tidak menghapus fitur stabil tanpa instruksi.

Format prompt OpenCode yang direkomendasikan:

```text
Baca docs/PRD.md terlebih dahulu.

Implementasikan hanya fitur berikut:
[DESKRIPSI FITUR]

Acceptance criteria:
[DAFTAR KRITERIA]

Jangan mengubah:
[AREA YANG TIDAK BOLEH DIUBAH]

Setelah selesai:
1. Jalankan typecheck.
2. Jalankan lint.
3. Jalankan production build.
4. Laporkan file yang diubah.
5. Jelaskan cara menguji fitur.
```

---

# 34. Risiko Utama

| Risiko                      | Dampak                     | Mitigasi                                   |
| --------------------------- | -------------------------- | ------------------------------------------ |
| Scope bertambah             | Timeline mundur            | Freeze MVP setelah PRD disetujui           |
| Koneksi venue buruk         | Scanner lambat             | Wi-Fi dan hotspot cadangan                 |
| Email masuk spam            | Peserta tidak melihat QR   | QR tersedia di success page                |
| Kamera HP sulit membaca     | Antrean                    | Test perangkat dan cahaya                  |
| Operator memilih sesi salah | Data attendance salah      | Session terlihat besar pada scanner        |
| Scan ganda                  | Data tidak akurat          | Unique constraint attendance               |
| Realtime laptop terputus    | Display tidak berubah      | HP tetap menampilkan hasil dan reconnect   |
| Data ganda                  | Peserta memiliki dua tiket | Unique email dan member number             |
| AI mengubah arsitektur      | Kode tidak konsisten       | PRD sebagai source of truth                |
| Secret bocor                | Risiko keamanan            | Environment variable dan review repository |

---

# 35. Product Decision Final

Keputusan MVP yang harus dipertahankan:

```text
Satu event
+ Dua sesi
+ Satu QR per peserta
+ Satu attendance per peserta per sesi
+ Handphone sebagai scanner
+ Laptop sebagai live display
+ Supabase sebagai source of truth
+ Server sebagai validator check-in
+ Manual check-in sebagai fallback
+ Email gagal tidak membatalkan registrasi
+ Seminar tanpa arrival tetap diperbolehkan dengan warning
```

Dokumen ini menjadi dasar desain, development, testing, dan UAT Sistem Registrasi dan Kehadiran Digital AKKAI 2026.
