# Database Schema

Schema PostgreSQL untuk Sistem Registrasi dan Kehadiran Digital AKKAI 2026.

## Migration

Migration awal berada di:

```text
supabase/migrations/20260801092444_create_initial_schema.sql
```

Migration menggunakan `pgcrypto`, server timestamps (`timestamptz default now()`), RLS, sequence Registration ID, trigger `updated_at`, index operasional, dan seed dua session MVP.

## Enum

- `user_role`: `ADMIN`, `OPERATOR`
- `registration_status`: `REGISTERED`, `CANCELLED`
- `email_status`: `PENDING`, `SENT`, `FAILED`
- `session_status`: `OPEN`, `CLOSED`
- `check_in_method`: `QR`, `MANUAL`
- `station_status`: `WAITING_PAIRING`, `PAIRED`, `ACTIVE`, `DISCONNECTED`, `CLOSED`
- `scan_result_status`: `SUCCESS`, `SUCCESS_WITH_WARNING`, `ALREADY_CHECKED_IN`, `INVALID_QR`, `CANCELLED_PARTICIPANT`, `SESSION_CLOSED`, `STATION_INACTIVE`, `ERROR`
- `email_type`: `REGISTRATION`, `RESEND`

`sessions.code` tetap menggunakan `TEXT` yang harus uppercase agar session baru dapat ditambahkan tanpa mengubah enum database. `participants.participant_category` juga menggunakan `TEXT` karena daftar final belum dikunci.

## Tables

### `profiles`

Profile operator/admin dengan `id` yang sama dengan `auth.users.id`.

- `id uuid primary key references auth.users(id) on delete restrict`
- `full_name`, `email`, `role`, `is_active`
- `created_at`, `updated_at`

### `sessions`

Session operasional dengan `code`, nama, tanggal, status, dan waktu buka/tutup.

Seed awal:

- `ARRIVAL`, `Registrasi Kedatangan`, `2026-10-19`, `CLOSED`
- `SEMINAR`, `Seminar AKKAI 2026`, `2026-10-20`, `CLOSED`

Seed menggunakan `ON CONFLICT (code) DO NOTHING`.

### `participants`

Data peserta dan tiket digital.

- `registration_id` dibuat database dengan sequence concurrency-safe dalam format `AKKAI26-000001` sampai `AKKAI26-999999`
- `qr_token` dibuat dari minimal 32 random bytes `pgcrypto`, disimpan plaintext dalam format hex, dan unique
- email unique secara case-insensitive melalui `lower(email)`
- member number unique secara case-insensitive melalui `upper(member_number)`
- `participant_category` adalah text, wajib, tidak boleh kosong, maksimal 100 karakter
- `registration_status` menggunakan cancel, bukan penghapusan record
- `email_generation` bertambah setiap kali alamat email dikoreksi. Nilai ini
  menjaga status aggregate participant tetap terkait dengan alamat saat ini.

### `scanner_stations`

Menyimpan station display/scanner, session, status, hash pairing, operator pairing, dan waktu aktivitas.

Foreign key ke `sessions` dan `profiles` menggunakan `ON DELETE RESTRICT`.

### `attendance`

Catatan kehadiran per peserta dan session.

```text
UNIQUE (participant_id, session_id)
```

Constraint tersebut mencegah duplicate check-in pada session yang sama. `station_id` nullable untuk manual check-in.

### `scan_events`

Audit setiap percobaan scan, termasuk invalid QR. `participant_id` dan `attendance_id` nullable sesuai hasil scan. `metadata` menggunakan `jsonb` dan tidak boleh menyimpan QR token mentah.

### `email_logs`

Audit email registration dan resend. Tidak menyimpan credential atau password.

`email_logs` adalah histori detail setiap upaya. `participants.email_status` adalah
ringkasan operasional dari status upaya email terakhir yang diketahui untuk
`email_generation` saat ini, bukan bukti email masuk ke inbox. Respons Resend yang
sukses berarti layanan pengiriman menerima request; status `SENT` mempertahankan
nama enum lama untuk kompatibilitas. `last_email_sent_at` hanya berlaku untuk
generation saat ini dan tidak dihapus oleh kegagalan berikutnya pada generation
yang sama.

`email_logs.email_generation` menyimpan generation saat setiap upaya dibuat.
`email_logs.recipient_email` adalah snapshot historis alamat yang digunakan dan
boleh berbeda dari alamat participant saat ini jika generation sudah berubah.

`participant_email_changes` menyimpan audit immutable untuk koreksi email. Koreksi
menaikkan generation, mengembalikan status email ke `PENDING`, dan mengosongkan
`last_email_sent_at`; pengiriman ulang tetap merupakan aksi admin yang terpisah.

Migration `20260829110000_add_admin_email_correction_and_delivery_generation.sql`
menyediakan generation tracking, audit koreksi, reservasi registrasi atomik,
finalisasi generation-aware, dan RPC koreksi email.

PENDING generation saat ini yang berusia kurang dari 15 menit memblokir koreksi.
PENDING yang lebih lama memerlukan konfirmasi eksplisit bahwa status provider tidak
diketahui dan alamat lama mungkin masih menerima email sebelumnya.

Migration `20260828100000_add_atomic_email_resend_reservation.sql` menyediakan
RPC `reserve_participant_email_resend` untuk mengunci participant, mencegah
duplikasi idempotency key, dan menghitung maksimal lima `RESEND` dalam rolling 24
jam sebelum membuat log `PENDING`. Resend key dan log menyimpan generation saat
reservasi. RPC hanya dapat dipanggil oleh `service_role`.

`PENDING` yang lebih tua dari 15 menit diperlakukan aplikasi sebagai UNKNOWN atau
perlu dicek, bukan otomatis dianggap gagal. Kunci resend berbasis bucket menit
berikutnya dapat membuat reservasi baru sesuai aturan kuota; histori lama tidak
dihapus dan tetap dihitung sampai melewati jendela 24 jam.

## Foreign Keys

Seluruh foreign key operasional menggunakan `ON DELETE RESTRICT` agar attendance, scan event, email log, station, dan histori operator tidak hilang. Akun dinonaktifkan melalui `profiles.is_active = false`.

Tidak ada foreign key yang menggunakan cascade delete.

## RLS

RLS aktif pada seluruh tabel.

Policy awal:

- `profiles_select_self`: authenticated user hanya membaca profile aktif miliknya sendiri.
- `sessions_select_authenticated`: authenticated user dapat membaca metadata session.
- Tidak ada policy `anon` untuk `participants`, `attendance`, `scanner_stations`, `scan_events`, atau `email_logs`.
- Tidak ada policy direct client untuk write operasional.

Registration, ticket, admin, dan check-in menggunakan Next.js server route/server action dengan `SUPABASE_SECRET_KEY` yang hanya tersedia di server. Server wajib melakukan validasi dan authorization.

RPC koreksi email, reservasi registrasi awal, reservasi resend, dan finalisasi
email menggunakan lock order `participants FOR UPDATE` lalu `email_logs FOR
UPDATE` jika keduanya diperlukan. Pemanggilan provider selalu terjadi setelah
transaksi database selesai.
