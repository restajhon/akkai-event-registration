# Technical Decisions

## Stack

- Framework: Next.js App Router
- Language: TypeScript
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Realtime: Supabase Realtime
- Email: Resend
- Hosting: Vercel
- QR scanner: ZXing Browser atau library browser stabil yang telah diuji
- Display timezone: Asia/Jakarta / WIB

## Initial Database Migration

Migration `20260801092444_create_initial_schema.sql` membuat enum, tujuh tabel operasional, `pgcrypto`, sequence Registration ID, secure QR token, updated-at trigger, foreign key, index, seed session, dan RLS.

### Registration ID

Database menggunakan sequence concurrency-safe dengan format:

```text
AKKAI26-000001
```

Nilai maksimum adalah `AKKAI26-999999`. Sequence boleh memiliki gaps ketika transaksi gagal. Setelah batas tercapai, insert gagal dengan pesan yang jelas. Format ini khusus untuk satu event AKKAI 2026; platform multi-event memerlukan keputusan dan migration baru.

### QR Token

QR token dibuat menggunakan minimal 32 random bytes dari `pgcrypto`, disimpan plaintext dalam kolom `participants.qr_token`, dan diberi unique constraint.

Token:

- tidak mengandung data pribadi
- tidak disimpan di `scan_events.metadata`
- tidak dimasukkan ke export
- tidak dicatat pada application log
- hanya dibaca oleh server menggunakan privileged Supabase client

### Akses Database

Public registration dan check-in tidak mengakses Supabase secara langsung dari browser. Next.js server route atau server action menggunakan:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` hanya boleh digunakan di server. Browser tidak boleh menerima secret key.

Server wajib memvalidasi input, authentication, role, session, participant status, dan duplicate attendance.

Initial migration tidak membuat `SECURITY DEFINER RPC`.

### Uniqueness

- Email unique global secara case-insensitive menggunakan unique index `lower(email)`.
- Member number unique global secara case-insensitive menggunakan unique index `upper(member_number)`.
- Peserta `CANCELLED` tidak dibuatkan record baru. Workflow admin berikutnya dapat mengaktifkan kembali record lama secara terkontrol.
- Attendance unique berdasarkan `(participant_id, session_id)`.

### Deletion And Audit History

Foreign key operasional menggunakan `ON DELETE RESTRICT`. Tidak ada cascade delete untuk mempertahankan histori attendance, scan event, station, dan email log.

Auth user yang memiliki profile operasional tidak dihapus. Akun dinonaktifkan melalui `profiles.is_active = false`.

### RLS

RLS diaktifkan pada seluruh tabel sejak initial migration.

- Authenticated user hanya dapat membaca profile aktif miliknya sendiri.
- Authenticated user dapat membaca metadata session.
- Tidak ada anon policy untuk data participant atau data operasional.
- Tidak ada direct client write policy untuk data operasional.
- Privileged server client menjadi jalur akses aplikasi dan RLS tetap menjadi defense-in-depth.

## Email Correction And Delivery Generations

`participants.email_generation` adalah generation alamat email saat ini. Setiap
koreksi email menaikkan nilainya, mengatur `email_status` menjadi `PENDING`, dan
mengosongkan `last_email_sent_at`. Status tersebut hanya boleh diperbarui oleh
finalisasi attempt yang generation-nya masih sama dengan participant.

`email_logs.email_generation` dan `recipient_email` adalah snapshot immutable dari
attempt historis. Perubahan alamat tidak menulis ulang email log lama. Audit
koreksi disimpan di `participant_email_changes` dan tidak diekspos melalui policy
anon atau authenticated.

Koreksi diblokir oleh current-generation `PENDING` yang lebih muda dari 15 menit.
PENDING yang lebih lama hanya dapat dilewati dengan konfirmasi stale yang diterima
oleh RPC, bukan UI saja. Lock order untuk transaksi terkait adalah participant
terlebih dahulu, lalu email log. Provider email selalu dipanggil di luar transaksi.

Participant search menggunakan POST Server Action dengan state ephemeral; query
tidak disimpan di URL, browser storage, atau cookie.

## H-3 Email Delivery

Identitas transactional email final adalah:

```text
AKKAI 2026 <registration@mail.esi-akkai-event.my.id>
```

Reply-To sengaja belum diset. Reply-To hanya akan ditambahkan setelah alamat
mailbox AKKAI atau Semangat Rajawali Indonesia yang benar-benar dimonitor telah
dikonfirmasi. Alamat yang tidak dimonitor tidak boleh digunakan.

DMARC untuk launch tetap menggunakan policy minimum:

```text
v=DMARC1; p=none;
```

Belum ada `rua` karena belum ada tujuan pelaporan yang sah. Quarantine dan
reject adalah langkah hardening setelah event, bukan perubahan sebelum launch.

Status `SENT` berarti provider email menerima request pengiriman. Status ini
bukan bukti email masuk inbox, dibaca, atau diterima manusia.

Environment contract aplikasi saat ini hanya terdiri dari:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Konfigurasi Production, deployment Production, dan aktivasi domain Production
termasuk H-4 dan sengaja belum disiapkan pada H-3.

## H-3D1 Operational Data Model

Migration H-3D1 bersifat additive dan tidak mengubah kontrak scan, manual
check-in, Live Display, realtime, email, atau QR. `institution` menjadi nullable
untuk menjaga histori lama, tetapi kolomnya tidak dihapus.

Data pendaftaran baru menggunakan `kka_name`, `polo_size`, `polo_model`, dan
empat pilihan registration hotfix.
Field-field tersebut nullable di database agar row lama tetap valid; validasi wajib untuk
pendaftaran baru dilakukan oleh `create_participant_with_registration_reservation_v3`.
`participant_category` tetap text historis dan nullable untuk row baru.
`member_number` tetap nullable dan opsional untuk semua kategori.

Travel disimpan terpisah pada `participant_travel` dan di-submit melalui upsert
atomic berbasis pasangan `registration_id` dan email terdaftar. Kamar dan
penjemputan disimpan terpisah sebagai current operational assignments. Hotel
event tetap `Hotel Gumaya Semarang`; tidak ada hotel selector peserta.

Semua tabel baru memakai RLS tanpa policy direct untuk `anon` atau
`authenticated`. Mutation menggunakan RPC `SECURITY DEFINER` dengan
`search_path` eksplisit dan execution hanya untuk `service_role`. Mutation
kamar dan penjemputan memvalidasi actor aktif dengan role `ADMIN` di dalam RPC.

RPC registration lama dan V2 tetap dipertahankan untuk rollout kompatibel; form
publik hotfix menggunakan `create_participant_with_registration_reservation_v3`.
Tidak ada backfill nilai KKA, poloshirt, travel, kamar, atau penjemputan dan
tidak ada destructive migration.

## H-3D2 Homepage And DAY3 Session

Rundown umum dipresentasikan pada homepage setelah Informasi Acara dan sebelum
alur registrasi. Halaman `/register` hanya mempertahankan informasi event yang
ringkas dan form; rundown tidak diduplikasi. Lokasi publik utama adalah
`Hotel Gumaya Semarang`.

Session `DAY3` ditambahkan melalui migration additive
`20260901090000_add_day3_session.sql` dengan `ON CONFLICT (code) DO NOTHING`.
Migration historis dan RPC `process_qr_scan` serta `process_manual_check_in`
tidak diubah karena keduanya mendapatkan session dari station dan memproses
attendance secara generik. Constraint `UNIQUE (participant_id, session_id)`
memisahkan attendance ARRIVAL, SEMINAR, dan DAY3. Warning khusus SEMINAR tanpa
ARRIVAL tetap dibatasi pada code `SEMINAR`; DAY3 tidak mewarisinya.

Satu QR participant digunakan kembali untuk ketiga session. Tidak ada token atau
QR participant baru untuk DAY3.

## H-3D3 Public Travel Form

`/travel` dibuat sebagai route publik terpisah dari `/register`. Peserta tidak
membuat akun dan tidak memakai QR untuk mengakses form; Server Action menerima
Registration ID dan email terdaftar, menormalisasi keduanya, lalu menyerahkan
validasi identity dan upsert kepada `upsert_participant_travel` yang sudah ada.
RPC tersebut dipakai ulang karena sudah memvalidasi pasangan identity pada
participant `REGISTERED`, menolak `CANCELLED`, dan memakai `ON CONFLICT
(participant_id) DO UPDATE` untuk mempertahankan satu current row.

Validasi aplikasi mencerminkan constraint database: satu date dan satu time per
leg, moda transportasi free text 1-50 karakter, field lokasi wajib dengan batas
panjang, nomor transportasi opsional, boolean `extend_stay`, dan tanggal pulang
tidak lebih awal dari tanggal berangkat. Hotel `Hotel Gumaya Semarang` hanya
ditampilkan sebagai informasi tetap, tanpa hotel field participant.

Tidak ada email pada flow travel. Response success hanya berisi status minimal;
UUID participant, QR token, dan data personal lain tidak dikembalikan ke
browser. Identity failure memakai pesan generic yang sama untuk ID salah, email
salah, pasangan campuran, dan participant `CANCELLED`.

## H-3D3 Durable Rate Limiting

Karena belum ada limiter public yang dapat dipakai ulang, migration additive
`20260901110000_add_participant_travel_rate_limit.sql` membuat tabel private
`private.participant_travel_rate_limits` dan RPC
`consume_participant_travel_rate_limit`. Server-only code membuat HMAC-SHA256
hash dari pasangan identity dan alamat client menggunakan secret server sebelum
memanggil RPC; email, Registration ID, IP, dan QR token tidak disimpan mentah.

RPC `SECURITY DEFINER` memakai `search_path` eksplisit, RLS aktif, direct access
ditutup, dan execution hanya diberikan ke `service_role`. Upsert atomik per key
menetapkan maksimal 12 percobaan dalam rolling 15 menit. Row limiter berusia
lebih dari satu hari dibersihkan secara opportunistic, sehingga retention
terbatas tanpa job tambahan. Limit berlaku sementara dan tidak menjadi permanent
lock untuk participant valid.

Migration ini belum divalidasi pada database lokal maupun remote pada fase
implementasi; validasi database lokal wajib dilakukan sebelum Preview QA.

### Environment Variable Naming

Nama resmi yang digunakan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

`NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` pada backlog adalah nama legacy dan tidak digunakan untuk implementasi baru.

## Admin Authentication

Admin dan operator menggunakan Supabase Auth email/password melalui cookie-based SSR.
Session refresh dilakukan oleh `src/proxy.ts` dan `src/lib/supabase/proxy.ts` pada
request `/admin/:path*`. Proxy hanya me-refresh session dan tidak menjadi lapisan
authorization utama.

Identity diverifikasi dengan `supabase.auth.getClaims()`. Setelah itu profile dibaca
melalui normal SSR client dari `src/lib/supabase/server.ts`, sehingga policy RLS
`profiles_select_self` tetap menjadi defense-in-depth. Profile harus aktif dan memiliki
role `ADMIN` atau `OPERATOR`.

Authorization halaman dan Server Action dilakukan oleh helper server-only di
`src/lib/auth/server.ts`. Session invalid atau profile yang tidak valid dibersihkan
melalui Route Handler internal menggunakan `signOut({ scope: "local" })`.

`src/lib/supabase/admin.ts` adalah secret client server-only menggunakan
`SUPABASE_SECRET_KEY`. Client tersebut disiapkan untuk privileged operation berikutnya
dan tidak digunakan untuk login, `getClaims()`, atau profile lookup authentication.
