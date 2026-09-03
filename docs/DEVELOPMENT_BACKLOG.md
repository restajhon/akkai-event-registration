# Development Backlog & Sprint Plan

## Sistem Registrasi dan Kehadiran Digital AKKAI 2026

**Versi:** 1.0
**Acuan utama:** `docs/PRD.md`
**Product Owner:** Resta / Semangat Rajawali Indonesia
**Target MVP production:** Maksimal akhir September 2026
**Metode pengerjaan:** AI-assisted development
**Tools utama:** ChatGPT, Gemini, v0, OpenCode, GitHub, Supabase, Vercel

---

# 1. Tujuan Dokumen

Dokumen ini memecah PRD menjadi pekerjaan teknis kecil yang dapat dikerjakan secara bertahap.

Setiap task memiliki:

* Task ID.
* Prioritas.
* Estimasi waktu.
* Dependency.
* Scope.
* Acceptance criteria.
* Output.
* Rekomendasi tool.

Urutan task harus diikuti agar fitur tidak dibangun di atas fondasi yang belum stabil.

---

# 2. Kapasitas Pengerjaan

Perkiraan waktu tersedia:

```text
Weekdays:
Senin–Jumat, pukul 20.00–24.00

Weekend:
Sekitar 8 jam
```

Kapasitas maksimum sekitar 28 jam per minggu.

Kapasitas efektif yang digunakan untuk perencanaan:

```text
18–23 jam per minggu
```

Satu sesi malam sebaiknya dibagi menjadi:

```text
20.00–20.20  Review target
20.20–22.00  Development
22.00–22.15  Istirahat
22.15–23.30  Testing dan debugging
23.30–24.00  Commit dan dokumentasi
```

---

# 3. Aturan Prioritas

## P0 — Wajib

Tanpa fitur ini, sistem tidak dapat digunakan pada acara.

Contoh:

* Registrasi.
* QR.
* Scanner.
* Attendance.
* Login.
* Duplicate prevention.

## P1 — Penting

Sistem masih dapat bekerja tanpa fitur ini, tetapi operasional akan lebih sulit.

Contoh:

* Resend email.
* Live display.
* Export laporan.
* Filter peserta.

## P2 — Tambahan

Dikerjakan hanya setelah seluruh P0 dan P1 stabil.

Contoh:

* Animasi.
* Statistik visual.
* Feedback suara yang lebih menarik.
* Export XLSX.

---

# 4. Milestone Utama

| Milestone               | Target                                       |
| ----------------------- | -------------------------------------------- |
| M1 — Foundation Ready   | Project, database, auth, deployment tersedia |
| M2 — Registration Ready | Peserta dapat mendaftar dan menerima QR      |
| M3 — Admin Ready        | Admin dapat mengelola peserta                |
| M4 — Attendance Ready   | Scanner dan check-in bekerja                 |
| M5 — Realtime Ready     | Hasil scan tampil pada laptop                |
| M6 — Reporting Ready    | Laporan dapat diekspor                       |
| M7 — Production Ready   | UAT, simulasi, dan deployment selesai        |

---

# 5. Sprint 0 — Persiapan dan Penguncian Scope

**Durasi:** 3–5 jam
**Milestone:** Project siap dimulai

## DOC-001 — Membuat struktur dokumentasi

**Prioritas:** P0
**Estimasi:** 30 menit
**Tool:** Manual / OpenCode

Buat struktur:

```text
/docs
  PRD.md
  DEVELOPMENT_BACKLOG.md
  database-schema.md
  business-rules.md
  test-cases.md
  deployment-guide.md
  day-h-sop.md
  changelog.md
```

### Acceptance criteria

* Folder `docs` tersedia.
* PRD tersimpan di repository.
* Backlog tersimpan di repository.
* Dokumen kosong lainnya memiliki judul dan tujuan.
* OpenCode dapat membaca seluruh file.

---

## DOC-002 — Membuat keputusan teknis

**Prioritas:** P0
**Estimasi:** 60 menit
**Tool:** ChatGPT + Gemini review

Dokumentasikan keputusan:

```text
Framework          : Next.js App Router
Language           : TypeScript
UI                 : Tailwind + shadcn/ui
Database           : Supabase PostgreSQL
Authentication     : Supabase Auth
Realtime           : Supabase Realtime
Email              : Resend
Hosting            : Vercel
Repository         : GitHub
QR Scanner         : ZXing Browser
Timezone display   : Asia/Jakarta
```

### Acceptance criteria

* Tidak ada dua alternatif teknologi untuk fitur yang sama.
* Setiap AI menggunakan stack yang sama.
* Keputusan disimpan di `docs/technical-decisions.md`.

---

## DOC-003 — Freeze MVP

**Prioritas:** P0
**Estimasi:** 30 menit
**Tool:** Manual

Buat daftar:

```text
IN MVP
OUT OF MVP
PENDING CONFIRMATION
```

### Acceptance criteria

* Tidak ada fitur baru masuk tanpa pencatatan.
* Perubahan PRD dicatat di `changelog.md`.
* Semua AI diarahkan mengikuti PRD.

---

# 6. Sprint 1 — Foundation

**Durasi:** 15–20 jam
**Milestone:** M1 — Foundation Ready

---

## FND-001 — Membuat repository GitHub

**Prioritas:** P0
**Estimasi:** 1 jam
**Dependency:** DOC-001
**Tool:** Manual + OpenCode

### Scope

* Buat repository private.
* Tambahkan README.
* Tambahkan `.gitignore`.
* Buat branch `develop`.
* Pastikan branch `main` hanya untuk versi stabil.

### Branch

```text
main
develop
```

### Acceptance criteria

* Repository berhasil dibuat.
* Project dapat di-clone.
* `.env.local` tidak dapat masuk Git.
* Commit pertama tersedia.
* Branch `develop` tersedia.

---

## FND-002 — Inisialisasi Next.js

**Prioritas:** P0
**Estimasi:** 2 jam
**Dependency:** FND-001
**Tool:** OpenCode

### Scope

* Next.js App Router.
* TypeScript.
* Tailwind CSS.
* ESLint.
* Folder `src`.
* Alias import `@/*`.

### Acceptance criteria

* `npm run dev` berhasil.
* `npm run lint` berhasil.
* Production build berhasil.
* Halaman awal dapat dibuka.
* Tidak ada TypeScript error.

### Prompt OpenCode

```text
Baca docs/PRD.md dan docs/DEVELOPMENT_BACKLOG.md.

Inisialisasi aplikasi Next.js dengan:
- App Router
- TypeScript
- Tailwind CSS
- ESLint
- src directory
- import alias @/*

Jangan membuat fitur registrasi atau database terlebih dahulu.

Setelah selesai:
1. Jalankan lint.
2. Jalankan production build.
3. Laporkan file yang dibuat.
4. Jelaskan cara menjalankan project.
```

---

## FND-003 — Membuat struktur folder

**Prioritas:** P0
**Estimasi:** 2 jam
**Dependency:** FND-002
**Tool:** OpenCode

Struktur awal:

```text
src/
├── app/
│   ├── (public)/
│   ├── admin/
│   └── api/
├── components/
│   ├── ui/
│   ├── public/
│   └── admin/
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── email/
│   ├── qr/
│   └── validation/
├── types/
├── hooks/
└── constants/
```

### Acceptance criteria

* Folder mengikuti kebutuhan PRD.
* Tidak ada business logic di komponen presentasi.
* Supabase client server dan browser dipisahkan.
* Constants untuk session dan status tersedia.

---

## FND-004 — Setup Supabase project

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** FND-002
**Tool:** Manual + OpenCode

### Scope

* Buat project Supabase development.
* Salin URL dan anon key.
* Tambahkan environment variables.
* Buat client browser.
* Buat client server.

### Environment

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Acceptance criteria

* Aplikasi dapat terhubung ke Supabase.
* Service role key tidak digunakan pada browser.
* `.env.example` tersedia tanpa nilai rahasia.
* `.env.local` tidak masuk Git.
* Tersedia health check sederhana.

---

## FND-005 — Database migration pertama

**Prioritas:** P0
**Estimasi:** 4–5 jam
**Dependency:** FND-004
**Tool:** OpenCode + Supabase SQL Editor

### Table

* `participants`
* `sessions`
* `attendance`
* `profiles`
* `scanner_stations`
* `scan_events`
* `email_logs`

### Constraint wajib

```text
UNIQUE participants.registration_id
UNIQUE participants.qr_token
UNIQUE normalized email
UNIQUE normalized member_number
UNIQUE attendance(participant_id, session_id)
```

### Acceptance criteria

* Seluruh table berhasil dibuat.
* Foreign key tersedia.
* Enum atau check constraint tersedia.
* Timestamp menggunakan server.
* Migration disimpan di repository.
* Database dapat di-reset menggunakan migration.

---

## FND-006 — Seed dua sesi AKKAI

**Prioritas:** P0
**Estimasi:** 1 jam
**Dependency:** FND-005
**Tool:** OpenCode

Seed:

```text
ARRIVAL
Registrasi Kedatangan
19 Oktober 2026
CLOSED

SEMINAR
Seminar AKKAI 2026
20 Oktober 2026
CLOSED
```

### Acceptance criteria

* Hanya terdapat satu session dengan kode `ARRIVAL`.
* Hanya terdapat satu session dengan kode `SEMINAR`.
* Session default berstatus `CLOSED`.
* Seed dapat dijalankan ulang tanpa membuat duplikat.

---

## FND-007 — Setup authentication

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** FND-004, FND-005
**Tool:** OpenCode

### Scope

* Supabase Auth.
* Login email dan password.
* Logout.
* Protected route.
* Role ADMIN dan OPERATOR.
* Profile otomatis atau manual.

### Acceptance criteria

* User tanpa login tidak dapat membuka `/admin`.
* User inactive ditolak.
* Role tersedia di server.
* Operator tidak dapat menjalankan action admin.
* Logout berfungsi.

---

## FND-008 — Setup Vercel development deployment

**Prioritas:** P0
**Estimasi:** 1–2 jam
**Dependency:** FND-002
**Tool:** Manual

### Acceptance criteria

* Branch `develop` dapat di-deploy.
* Environment variable development tersedia.
* Aplikasi dapat diakses melalui HTTPS.
* Production environment belum memakai data asli.
* Setiap push menghasilkan deployment preview.

---

## Milestone M1 dianggap selesai ketika

* Project dapat dijalankan.
* Database terhubung.
* Seluruh migration tersedia.
* Dua sesi sudah tersedia.
* Login bekerja.
* Protected route bekerja.
* Development deployment dapat dibuka.

---

# 7. Sprint 2 — UI Public dan Registrasi

**Durasi:** 18–24 jam
**Milestone:** M2 — Registration Ready

---

## UI-001 — Membuat design system awal

**Prioritas:** P0
**Estimasi:** 2 jam
**Tool:** v0

### Scope

Tentukan:

* Typography.
* Spacing.
* Button.
* Form input.
* Alert.
* Badge status.
* Card.
* Layout mobile dan desktop.

### Acceptance criteria

* Tampilan konsisten.
* Mobile-first.
* Kontras memadai.
* Tidak menggunakan terlalu banyak variasi warna.
* Komponen dapat digunakan ulang.

---

## UI-002 — Landing page

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** UI-001
**Tool:** v0 → OpenCode

### Prompt v0

```text
Create a responsive landing page for Rapat Tahunan AKKAI 2026.

Requirements:
- Bahasa Indonesia
- Mobile-first
- Event name, dates 27–29 October 2026, location Semarang
- Short event information
- Registration period
- Main CTA: "Daftar Sekarang"
- Information that the participant QR will be sent by email
- Privacy notice
- Professional event registration visual style
- No payment section
- No participant login
- No unsupported metrics or testimonials
- Use reusable Next.js and Tailwind components
```

### Acceptance criteria

* CTA menuju `/register`.
* Mobile dan desktop rapi.
* Registrasi closed state tersedia.
* Tidak ada data dummy yang tampak seperti data asli.

---

## UI-003 — Registration form UI

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** UI-001
**Tool:** v0 → OpenCode

### Field

* Nama lengkap.
* Nomor anggota.
* Email.
* WhatsApp.
* Institusi.
* Kategori peserta.
* Privacy consent.

### Acceptance criteria

* Semua field mempunyai label.
* Required field terlihat.
* Error dapat ditampilkan per field.
* Loading state tersedia.
* Button tidak mudah tertekan dua kali.
* Mobile keyboard sesuai dengan input.

---

## REG-001 — Registration validation schema

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** UI-003
**Tool:** OpenCode

### Scope

Gunakan schema validation seperti Zod.

### Acceptance criteria

* Validasi client dan server menggunakan aturan yang konsisten.
* Email dinormalisasi lowercase.
* Member number dinormalisasi uppercase.
* WhatsApp dinormalisasi.
* Error menggunakan Bahasa Indonesia.

---

## REG-002 — Generate Registration ID

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** FND-005
**Tool:** OpenCode

Format:

```text
AKKAI26-000001
```

### Acceptance criteria

* ID unik.
* Aman terhadap registrasi bersamaan.
* Tidak menghitung ID dari sisi browser.
* Tidak menghasilkan duplikat.
* Tidak berubah setelah participant dibuat.

---

## REG-003 — Generate secure QR token

**Prioritas:** P0
**Estimasi:** 1–2 jam
**Dependency:** FND-005
**Tool:** OpenCode

### Acceptance criteria

* Token dibuat menggunakan secure random generator.
* Token tidak berurutan.
* Token unik.
* Token tidak mengandung data pribadi.
* Token tidak dikirim ke log aplikasi secara sembarangan.

---

## REG-004 — Registration server action/API

**Prioritas:** P0
**Estimasi:** 4–6 jam
**Dependency:** REG-001, REG-002, REG-003
**Tool:** OpenCode

### Flow

1. Validasi payload.
2. Normalisasi.
3. Periksa periode registrasi.
4. Periksa email.
5. Periksa nomor anggota.
6. Buat participant.
7. Buat registration ID.
8. Buat QR token.
9. Set email status `PENDING`.
10. Kembalikan hasil aman.

### Acceptance criteria

* Duplicate email ditolak.
* Duplicate member number ditolak.
* Double click tidak membuat dua data.
* Error database ditangani.
* Response tidak mengandung informasi rahasia.
* Registration berhasil disimpan.

---

## UI-004 — Registration success page

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** REG-004
**Tool:** v0 → OpenCode

### Acceptance criteria

* Nama dan Registration ID tampil.
* QR tampil.
* Email di-mask.
* Email failed state tersedia.
* Refresh tidak membuat participant baru.
* Tombol digital ticket tersedia.

---

## TKT-001 — Digital ticket

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** REG-003
**Tool:** v0 → OpenCode

### Acceptance criteria

* Ticket dibuka melalui token.
* Token invalid menghasilkan halaman tidak ditemukan.
* Cancelled participant melihat tiket tidak aktif.
* QR mempunyai ukuran yang mudah dipindai.
* QR tidak berisi data pribadi.

---

## Milestone M2 dianggap selesai ketika

* Peserta dapat mengisi form.
* Data tersimpan.
* Duplicate prevention bekerja.
* Registration ID dibuat.
* QR dibuat.
* Success page tampil.
* Digital ticket dapat dibuka.

---

# 8. Sprint 3 — Email dan Admin Participant Management

**Durasi:** 18–24 jam
**Milestone:** M3 — Admin Ready

---

## EML-001 — Setup Resend

**Prioritas:** P0
**Estimasi:** 2 jam
**Dependency:** FND-002
**Tool:** Manual + OpenCode

### Acceptance criteria

* API key berada di environment server.
* Domain atau sender development tersedia.
* Test email berhasil dikirim.
* API key tidak muncul di browser.

---

## EML-002 — Registration email template

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** EML-001, TKT-001
**Tool:** OpenCode

### Acceptance criteria

* Email berbahasa Indonesia.
* Nama dan Registration ID tampil.
* Link tiket tersedia.
* QR dapat ditampilkan atau diakses melalui tiket.
* Email mobile-friendly.
* Email log dibuat.

---

## EML-003 — Trigger registration email

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** REG-004, EML-002
**Tool:** OpenCode

### Acceptance criteria

* Email diproses setelah participant dibuat.
* Email failed tidak rollback participant.
* Email status diperbarui.
* Error provider disimpan dengan aman.
* User tetap diarahkan ke success page.

---

## ADM-001 — Admin login UI

**Prioritas:** P0
**Estimasi:** 2 jam
**Dependency:** FND-007
**Tool:** v0 → OpenCode

### Acceptance criteria

* Form login jelas.
* Error tidak membocorkan apakah email terdaftar.
* Loading state tersedia.
* Redirect setelah login bekerja.

---

## ADM-002 — Admin layout

**Prioritas:** P0
**Estimasi:** 3 jam
**Dependency:** ADM-001
**Tool:** v0 → OpenCode

Menu:

* Dashboard.
* Peserta.
* Display.
* Laporan.
* Logout.

### Acceptance criteria

* Role-aware navigation.
* Responsive tablet dan desktop.
* Operator tidak melihat menu admin-only.
* Active menu terlihat.

---

## ADM-003 — Participant list

**Prioritas:** P0
**Estimasi:** 4–6 jam
**Dependency:** ADM-002
**Tool:** v0 → OpenCode

### Acceptance criteria

* Tabel participant tampil.
* Search bekerja.
* Filter dasar bekerja.
* Pagination server-side.
* Attendance dua sesi ditampilkan.
* Cancelled participant dapat dicari.

---

## ADM-004 — Participant detail

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** ADM-003
**Tool:** v0 → OpenCode

### Acceptance criteria

* Detail registrasi tampil.
* Attendance per sesi tampil.
* Email status tampil.
* QR preview tampil.
* Role operator dan admin dibedakan.

---

## ADM-005 — Edit participant

**Prioritas:** P1
**Estimasi:** 3–4 jam
**Dependency:** ADM-004
**Tool:** OpenCode

### Acceptance criteria

* Admin dapat mengubah field yang diizinkan.
* Email baru diperiksa duplikasinya.
* Member number baru diperiksa duplikasinya.
* QR tidak berubah.
* Registration ID tidak berubah.
* Operator tidak dapat menjalankan API edit.

---

## ADM-006 — Cancel participant

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** ADM-004
**Tool:** OpenCode

### Acceptance criteria

* Hanya admin.
* Memerlukan confirmation dialog.
* Data tidak dihapus.
* QR participant tidak dapat check-in.
* Attendance lama tetap tersimpan.

---

## EML-004 — Resend ticket

**Prioritas:** P1
**Estimasi:** 2–3 jam
**Dependency:** EML-002, ADM-004
**Tool:** OpenCode

### Acceptance criteria

* Hanya admin.
* QR tidak berubah.
* Registration ID tidak berubah.
* Email log dibuat.
* Double click tidak mengirim ganda.
* Rate limit tersedia.

---

## Milestone M3 dianggap selesai ketika

* Admin dan operator dapat login.
* Participant dapat dicari.
* Detail participant dapat dibuka.
* Admin dapat edit dan cancel.
* Email registration bekerja.
* Admin dapat resend tiket.

---

# 9. Sprint 4 — Attendance dan Mobile Scanner

**Durasi:** 22–30 jam
**Milestone:** M4 — Attendance Ready

---

## SES-001 — Session control

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** FND-006, ADM-002
**Tool:** OpenCode

### Acceptance criteria

* Admin dapat membuka sesi.
* Admin dapat menutup sesi.
* Operator tidak dapat mengubah sesi.
* Scanner menolak session closed.
* Perubahan status tercatat.

---

## STA-001 — Create scanner station

**Prioritas:** P0
**Estimasi:** 4–5 jam
**Dependency:** SES-001
**Tool:** OpenCode

### Acceptance criteria

* Station hanya dibuat untuk session open.
* Nama station wajib.
* Pairing code enam digit dibuat.
* Pairing token dibuat.
* Expiry 15 menit.
* Status awal `WAITING_PAIRING`.

---

## UI-005 — Display setup UI

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Dependency:** STA-001
**Tool:** v0 → OpenCode

### Acceptance criteria

* Admin/operator memilih sesi.
* Nama station dapat dimasukkan.
* QR pairing tampil.
* Kode manual tampil.
* Countdown expiry tampil.

---

## STA-002 — Pair mobile scanner

**Prioritas:** P0
**Estimasi:** 4–5 jam
**Dependency:** STA-001
**Tool:** OpenCode

### Acceptance criteria

* Operator harus login.
* Pairing token divalidasi.
* Pairing code dapat digunakan.
* Expired token ditolak.
* Used token ditolak.
* Station berubah menjadi paired.
* Satu scanner aktif per station.

---

## SCN-001 — Camera access

**Prioritas:** P0
**Estimasi:** 3–5 jam
**Dependency:** STA-002
**Tool:** OpenCode

### Acceptance criteria

* Browser meminta izin kamera.
* Kamera belakang dipilih.
* Penolakan permission ditangani.
* Kamera berhenti ketika halaman ditutup.
* Android Chrome diuji.
* iPhone Safari diuji.

---

## SCN-002 — QR reader

**Prioritas:** P0
**Estimasi:** 4–6 jam
**Dependency:** SCN-001
**Tool:** OpenCode

### Acceptance criteria

* QR layar handphone terbaca.
* QR cetak terbaca.
* Scanner pause setelah token terbaca.
* Token yang sama tidak diproses berulang dalam beberapa milidetik.
* Invalid payload ditolak.

---

## ATT-001 — Check-in API

**Prioritas:** P0
**Estimasi:** 5–7 jam
**Dependency:** SCN-002, SES-001
**Tool:** OpenCode

### Validasi

* Auth user.
* Role.
* Station.
* Scanner pairing.
* Session.
* Participant.
* Registration status.
* Duplicate attendance.
* Arrival warning untuk seminar.

### Acceptance criteria

* Attendance hanya dibuat oleh server.
* Unique constraint menangani race condition.
* Success baru dikembalikan setelah database berhasil.
* Duplicate scan menampilkan check-in sebelumnya.
* Seminar tanpa arrival menghasilkan warning.
* Cancelled participant ditolak.

---

## SCN-003 — Mobile scan result UI

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** ATT-001
**Tool:** v0 → OpenCode

State:

* Success.
* Success with warning.
* Already checked-in.
* Invalid QR.
* Cancelled.
* Session closed.
* Network error.

### Acceptance criteria

* State mudah dibedakan.
* Tidak hanya mengandalkan warna.
* Nama participant terlihat.
* Auto reset bekerja.
* Scanner tidak restart sebelum result selesai.

---

## ATT-002 — Manual check-in

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Dependency:** ATT-001, ADM-004
**Tool:** OpenCode

### Acceptance criteria

* Operator memilih sesi.
* Session closed ditolak.
* Duplicate ditolak.
* Method `MANUAL`.
* Operator dan notes tersimpan.
* Dashboard langsung berubah.

---

## Milestone M4 dianggap selesai ketika

* Session dapat dibuka.
* Station dapat dibuat.
* HP dapat pairing.
* Kamera dapat membaca QR.
* Attendance tersimpan.
* Duplicate scan ditolak.
* Check-in manual bekerja.

---

# 10. Sprint 5 — Laptop Live Display

**Durasi:** 14–20 jam
**Milestone:** M5 — Realtime Ready

---

## DSP-001 — Live display UI

**Prioritas:** P1
**Estimasi:** 3–4 jam
**Dependency:** UI-005
**Tool:** v0 → OpenCode

State:

* Standby.
* Success.
* Warning.
* Already checked-in.
* Invalid.
* Cancelled.
* Disconnected.

### Acceptance criteria

* Landscape desktop.
* Nama participant besar.
* Tidak menampilkan email atau WhatsApp.
* Auto reset ke standby.

---

## RT-001 — Supabase Realtime channel

**Prioritas:** P1
**Estimasi:** 4–6 jam
**Dependency:** ATT-001
**Tool:** OpenCode

### Acceptance criteria

* Channel dipisahkan berdasarkan station ID.
* Event station lain tidak muncul.
* Scanner result tampil tanpa refresh.
* Subscription dibersihkan saat halaman ditutup.
* Authorization tetap diperhatikan.

---

## RT-002 — Scan event persistence

**Prioritas:** P1
**Estimasi:** 3–4 jam
**Dependency:** ATT-001
**Tool:** OpenCode

### Acceptance criteria

* Setiap scan menghasilkan scan event.
* Invalid scan tetap tercatat tanpa participant ID.
* Result status tersimpan.
* Laptop dapat mengambil event terakhir.
* QR token mentah tidak disimpan di metadata.

---

## RT-003 — Reconnect handling

**Prioritas:** P1
**Estimasi:** 3–4 jam
**Dependency:** RT-001, RT-002
**Tool:** OpenCode

### Acceptance criteria

* Connection status tampil.
* Auto reconnect tersedia.
* Setelah reconnect, event terakhir dapat dipulihkan.
* Laptop tidak menampilkan success lama berkali-kali.

---

## RT-004 — Station close and disconnect

**Prioritas:** P1
**Estimasi:** 2–3 jam
**Dependency:** STA-002
**Tool:** OpenCode

### Acceptance criteria

* Operator dapat keluar dari station.
* Admin dapat menutup station.
* Scanner tidak dapat mengirim scan setelah station closed.
* Display kembali ke setup atau halaman selesai.

---

## Milestone M5 dianggap selesai ketika

* Hasil scan HP muncul di laptop.
* Event station terisolasi.
* Display menangani reconnect.
* Laptop bukan sumber penentu keberhasilan attendance.

---

# 11. Sprint 6 — Dashboard dan Reporting

**Durasi:** 14–20 jam
**Milestone:** M6 — Reporting Ready

---

## DSH-001 — Dashboard statistics

**Prioritas:** P1
**Estimasi:** 4–5 jam
**Dependency:** ATT-001
**Tool:** v0 → OpenCode

Statistik:

* Registered.
* Cancelled.
* Arrival attendance.
* Seminar attendance.
* Email failed.
* Active station.

### Acceptance criteria

* Cancelled tidak dihitung sebagai peserta aktif.
* Attendance dipisahkan per sesi.
* Query efisien.
* Empty state tersedia.

---

## DSH-002 — Recent attendance

**Prioritas:** P1
**Estimasi:** 2–3 jam
**Dependency:** ATT-001
**Tool:** OpenCode

### Acceptance criteria

* Maksimal 10 data.
* Urut terbaru.
* Session dan method terlihat.
* Auto update jika memungkinkan.

---

## RPT-001 — Overall CSV export

**Prioritas:** P1
**Estimasi:** 3–4 jam
**Dependency:** ADM-003, ATT-001
**Tool:** OpenCode

### Acceptance criteria

* Hanya admin.
* UTF-8.
* Waktu WIB.
* Attendance dua sesi tersedia.
* QR token tidak diekspor.

---

## RPT-002 — Session report

**Prioritas:** P1
**Estimasi:** 3–4 jam
**Dependency:** RPT-001
**Tool:** OpenCode

### Acceptance criteria

* Arrival report tersedia.
* Seminar report tersedia.
* Hadir dan belum hadir dibedakan.
* Operator dan method tersedia.

---

## RPT-003 — Report filters

**Prioritas:** P1
**Estimasi:** 2–3 jam
**Dependency:** RPT-001
**Tool:** OpenCode

### Acceptance criteria

* Filter status registrasi.
* Filter kategori.
* Filter institusi.
* Filter attendance.
* File export mengikuti filter.

---

## Milestone M6 dianggap selesai ketika

* Dashboard dapat digunakan.
* Statistik benar.
* Laporan keseluruhan dapat diekspor.
* Laporan per sesi dapat diekspor.

---

# 12. Sprint 7 — Testing dan Production Readiness

**Durasi:** 22–30 jam
**Milestone:** M7 — Production Ready

---

## TST-001 — Unit dan integration test utama

**Prioritas:** P0
**Estimasi:** 5–7 jam
**Tool:** OpenCode

Test minimum:

* Registration validation.
* Duplicate email.
* Duplicate member number.
* Registration ID.
* QR token.
* Duplicate attendance.
* Cancelled participant.
* Closed session.
* Seminar warning.

---

## TST-002 — Dummy participant generation

**Prioritas:** P0
**Estimasi:** 2 jam
**Tool:** OpenCode

### Acceptance criteria

* Minimal 50 participant dummy.
* Variasi kategori dan institusi.
* Tidak menggunakan data pribadi asli.
* Seed dapat dibersihkan.

---

## TST-003 — Device testing

**Prioritas:** P0
**Estimasi:** 4–6 jam
**Tool:** Manual

Perangkat:

* Android Chrome.
* iPhone Safari.
* Laptop Chrome.
* MacBook Chrome.
* QR di layar.
* QR cetak.

---

## TST-004 — Multi-device simulation

**Prioritas:** P0
**Estimasi:** 3–4 jam
**Tool:** Tim internal

Simulasi:

* Dua station.
* Dua handphone.
* Dua laptop atau satu laptop bergantian.
* Scan peserta berbeda.
* Scan participant yang sama bersamaan.
* Laptop disconnect.
* HP disconnect.

---

## TST-005 — Email failure simulation

**Prioritas:** P0
**Estimasi:** 2 jam
**Tool:** OpenCode

### Acceptance criteria

* Participant tetap tersimpan.
* Email status failed.
* QR tersedia di success page.
* Resend dapat dilakukan.

---

## SEC-001 — Security review

**Prioritas:** P0
**Estimasi:** 4–5 jam
**Tool:** Gemini review + ChatGPT + OpenCode

Periksa:

* Environment variables.
* RLS.
* Server authorization.
* Public ticket data.
* Service role usage.
* Export authorization.
* Sensitive logs.
* Rate limiting.
* Error response.

---

## DEP-001 — Production Supabase

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Tool:** Manual

### Acceptance criteria

* Terpisah dari development.
* Migration diterapkan.
* Dua session tersedia.
* RLS aktif.
* Backup tersedia.

---

## DEP-002 — Production deployment

**Prioritas:** P0
**Estimasi:** 2–3 jam
**Tool:** Manual + OpenCode

### Acceptance criteria

* Domain HTTPS.
* Environment production tersedia.
* Build berhasil.
* Health check berhasil.
* Data dummy tidak tersedia.
* Admin production dapat login.

---

## UAT-001 — Internal UAT Semangat Rajawali Indonesia

**Prioritas:** P0
**Estimasi:** 3–4 jam

### Skenario

* Registrasi.
* Email.
* Scan arrival.
* Scan seminar.
* Duplicate scan.
* Invalid QR.
* Cancelled participant.
* Manual check-in.
* Export.

---

## UAT-002 — UAT PIC AKKAI

**Prioritas:** P0
**Estimasi:** 2–3 jam

### Output

* Daftar feedback.
* Bug list.
* Perubahan copy.
* Approval alur.
* Approval field registrasi.
* Approval laporan.

---

# 13. Rencana Mingguan

## Minggu 1

Fokus:

* Documentation.
* Repository.
* Next.js.
* Supabase.
* Database.
* Authentication.
* Vercel development.

Output:

```text
M1 — Foundation Ready
```

## Minggu 2

Fokus:

* Design system.
* Landing page.
* Registration form.
* Validation.
* Participant creation.
* QR token.
* Success page.

Output:

```text
Registrasi peserta berfungsi
```

## Minggu 3

Fokus:

* Digital ticket.
* Email.
* Admin layout.
* Participant list.
* Participant detail.

Output:

```text
M2 dan M3 sebagian besar selesai
```

## Minggu 4

Fokus:

* Session control.
* Station.
* Pairing.
* Camera.
* QR reader.

Output:

```text
HP dapat membaca QR
```

## Minggu 5

Fokus:

* Check-in API.
* Duplicate prevention.
* Manual check-in.
* Scanner result.

Output:

```text
M4 — Attendance Ready
```

## Minggu 6

Fokus:

* Laptop live display.
* Realtime.
* Reconnect.
* Dashboard.

Output:

```text
M5 — Realtime Ready
```

## Minggu 7

Fokus:

* Reports.
* Export.
* Unit test.
* Device test.
* Security review.

Output:

```text
M6 — Reporting Ready
```

## Minggu 8

Fokus:

* Production deployment.
* Internal UAT.
* AKKAI UAT.
* Bug fixing.
* SOP hari-H.

Output:

```text
M7 — Production Ready
```

---

# 14. Workflow Setiap Task

Gunakan urutan berikut:

```text
1. Pilih satu task
2. Baca requirement
3. Buat branch
4. Minta OpenCode mengimplementasikan
5. Jalankan aplikasi
6. Test manual
7. Review Gemini jika diperlukan
8. Perbaiki melalui OpenCode
9. Jalankan lint, typecheck, dan build
10. Commit
11. Update changelog
12. Merge ke develop
```

Contoh branch:

```text
feature/fnd-nextjs-setup
feature/registration-form
feature/qr-ticket
feature/mobile-scanner
feature/live-display
fix/duplicate-attendance
```

---

# 15. Template Prompt OpenCode

```text
Baca dokumen berikut sebelum melakukan perubahan:

- docs/PRD.md
- docs/DEVELOPMENT_BACKLOG.md
- docs/database-schema.md
- docs/business-rules.md

Task ID:
[TASK ID]

Implementasikan hanya:
[SCOPE TASK]

Acceptance criteria:
[ACCEPTANCE CRITERIA]

Jangan mengubah:
[AREA YANG TIDAK BERKAITAN]

Aturan:
- Gunakan Next.js App Router dan TypeScript.
- Ikuti struktur project yang sudah tersedia.
- Jangan hardcode secret.
- Jangan menambahkan dependency tanpa alasan.
- Jangan mengubah arsitektur tanpa persetujuan.
- Pastikan authorization dilakukan di server.

Setelah implementasi:
1. Jalankan lint.
2. Jalankan typecheck.
3. Jalankan production build.
4. Jelaskan file yang diubah.
5. Jelaskan migration database jika ada.
6. Berikan langkah pengujian manual.
7. Laporkan risiko atau hal yang belum selesai.
```

---

# 16. Template Review Gemini

```text
Review implementasi berikut berdasarkan docs/PRD.md.

Fokus review:
- Security
- Race condition
- Duplicate data
- Error handling
- Authorization
- Edge case
- Mobile browser compatibility

Jangan menulis ulang seluruh aplikasi.
Berikan temuan dalam format:

1. Severity
2. File atau area
3. Masalah
4. Dampak
5. Rekomendasi perbaikan
```

---

# 17. Task Pertama yang Harus Dikerjakan

Mulai dari urutan berikut:

```text
DOC-001
DOC-002
DOC-003
FND-001
FND-002
FND-003
```

Jangan langsung membuat form di v0 sebelum:

* Repository tersedia.
* Next.js berhasil dijalankan.
* Struktur project tersedia.
* PRD sudah masuk repository.

---

# 18. Target Sesi Pengerjaan Pertama

Target sesi pertama:

```text
1. Buat folder project lokal.
2. Buat repository GitHub private.
3. Masukkan PRD dan backlog.
4. Inisialisasi Next.js.
5. Jalankan project di local.
6. Push commit pertama ke GitHub.
```

Hasil akhir yang harus terlihat:

```text
- Website default dapat dibuka di localhost
- Repository GitHub sudah terisi
- Folder docs tersedia
- npm run lint berhasil
- npm run build berhasil
```

Commit pertama:

```text
chore: initialize AKKAI registration project
```

Setelah target tersebut berhasil, lanjutkan ke Supabase dan database pada sesi berikutnya.
