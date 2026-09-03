# Authentication Test Cases

## Manual Setup

- Buat user email/password melalui Supabase Dashboard.
- Buat row `public.profiles` dengan `id` yang sama dengan Auth user.
- Uji profile `ADMIN`, `OPERATOR`, inactive, dan profile yang tidak tersedia.

## Authentication

- Login dengan kredensial valid mengarah ke `/admin/dashboard`.
- Password salah menampilkan `Email atau password tidak sesuai.`.
- Email tidak terdaftar menampilkan pesan generic yang sama.
- User Auth valid tanpa profile tidak mengalami redirect loop.
- Profile inactive dibersihkan session-nya dan diarahkan ke `/admin/login`.
- Profile dengan role valid dapat melihat nama, email, role, dan tombol logout.
- `/admin` tanpa login diarahkan ke login.
- `/admin/dashboard` tanpa login diarahkan ke login.
- Logout menggunakan `signOut({ scope: "local" })` dan hanya mengakhiri session browser saat ini.
- Refresh browser mempertahankan login selama session valid.
- Session expired diarahkan ke login setelah cleanup.

## Server Security

- Profile lookup authentication menggunakan normal SSR client, bukan secret admin client.
- `src/lib/supabase/admin.ts` tidak diimpor oleh Client Component.
- Secret admin client tidak masuk client bundle.
- Proxy refresh cookie tetapi Server Action tetap melakukan authentication sendiri.
- Tidak tersedia halaman atau endpoint public signup.
- Tidak tersedia forgot-password atau social login.

# H-3D2 Registration And Compatibility

## Public Registration Form Hotfix

- Form publik tidak menampilkan field Institusi/Cabang dan tidak mengirimkan field tersebut.
- Nama KKA wajib diisi dan menerima 1-150 karakter setelah trim.
- Form publik tidak menampilkan `Kategori peserta` atau `Nomor Anggota AKKAI`.
- `Paket yang diambil` menyediakan `Twin Share` dan `Single` serta wajib dipilih.
- `Mengikuti` menyediakan `Seluruh acara`, `Rapat Anggota`, dan `Seminar Profesi Konsultan Aktuaria` serta wajib dipilih sebagai satu nilai.
- `Konsultan Aktuaria` menyediakan `Peserta Baru` dan `Penerima Grandfathering` serta wajib dipilih.
- `Hadir Kongres PAI` menyediakan `Ya` dan `Tidak` serta wajib dipilih.
- Ukuran Poloshirt menyediakan `S`, `M`, `L`, `XL`, `XXL`, `XXXL`, dan `XXXXL`.
- Model Poloshirt hanya menyediakan `Lengan Panjang` dan `Lengan Pendek`.
- Informasi tetap `Hotel Gumaya Semarang` tampil di homepage dan halaman registrasi tanpa menjadi input.
- Rundown umum menampilkan Day 1, Day 2, dan Day 3 di homepage, bukan pada halaman registrasi.
- Rundown tetap umum dan tidak menampilkan waktu, ruangan, pembicara, transportasi, atau agenda tambahan.
- Server Action menggunakan registration RPC V3 dan mempertahankan hasil `CREATED`, duplicate, `INVALID_INPUT`, serta error umum.
- RPC V2 H-3D2 tetap menerima registration lama setelah migration hotfix.

## Registration Hotfix Local QA

- Semua empat pilihan valid menyimpan row baru dengan `participant_category` dan `member_number` NULL.
- Masing-masing pilihan baru yang hilang ditolak oleh schema, Server Action, dan RPC V3.
- Nilai pilihan baru di luar daftar ditolak.
- `XXXXL` diterima; `S`, `M`, `L`, `XL`, `XXL`, dan `XXXL` tetap diterima.
- Email duplikat tetap mengembalikan hasil duplicate yang sama.
- Registration ID dibuat database dan QR token tetap dibuat server-side.
- Kegagalan email tetap menyimpan registrasi dan mengembalikan status delivery gagal sesuai kontrak lama.
- Participant lama tidak dimutasi; empat kolom hotfix boleh tetap NULL.

## Legacy Compatibility

- Peserta lama dengan institution terisi tetap dapat diproses.
- Peserta baru dengan institution NULL tidak menampilkan baris institusi pada scanner, manual check-in, atau Live Display.
- Peserta lama dengan kategori, KKA, atau data poloshirt NULL tidak menampilkan `null`, `undefined`, atau `[object Object]` pada halaman admin, scanner, manual check-in, atau Live Display.
- QR, Registration ID, attendance, pairing, realtime payload minimum, dan email generation tetap menggunakan kontrak lama.

## H-3D2 DAY3 Session

- Database memiliki session `DAY3` dengan nama `Registrasi Day 3`, tanggal 21 Oktober 2026, dan status awal `CLOSED` setelah migration additive diterapkan.
- Admin dapat membuka dan menutup DAY3 dari session management.
- Station dapat dibuat dan dipasangkan ke DAY3 ketika session dibuka.
- QR yang sama dapat dipindai pada ARRIVAL, SEMINAR, dan DAY3.
- Scan kedua pada DAY3 mengembalikan status sudah check-in tanpa membuat attendance baru.
- Manual check-in pada station DAY3 berhasil dan duplicate DAY3 ditolak.
- Live Display dan dashboard menampilkan hasil serta jumlah attendance DAY3 melalui session_id.
- DAY3 tidak menampilkan warning SEMINAR tanpa ARRIVAL.
- Participant detail dan participant list menampilkan status attendance DAY3.

# H-3D3 Travel Form

## Public Flow

- `/travel` terpisah dari `/register` dan tidak membuat participant baru.
- Participant terdaftar dengan Registration ID dan email yang benar dapat menyimpan travel.
- Submission kedua dengan identity yang sama meng-update satu row `participant_travel`, bukan membuat row baru.
- Moda transportasi arbitrary yang valid diterima sebagai free text trim 1-50 karakter.
- Nomor penerbangan/kereta boleh kosong untuk keberangkatan dan kepulangan.
- `extend_stay = true` dan `extend_stay = false` sama-sama dapat disimpan.
- Hotel Gumaya Semarang tampil sebagai informasi statis dan tidak menjadi field editable.
- Tidak ada email registrasi, resend, atau email travel yang dikirim setelah submission.

## Validation And Identity

- Registration ID dan email wajib diisi, dinormalisasi server, dan harus cocok pada participant yang sama.
- Wrong Registration ID, wrong email, pasangan ID/email dari participant berbeda, dan participant `CANCELLED` menerima pesan browser generic yang sama.
- Email malformed, field wajib kosong, moda transportasi lebih dari 50 karakter, dan tanggal return sebelum outbound ditolak.
- Setiap leg hanya memiliki satu field waktu dan satu field tanggal.
- Return date sama dengan outbound date diterima.

## Security And Rate Limit

- Direct browser access tidak dapat menggunakan service role atau membaca tabel travel secara direct.
- Response success tidak memuat participant UUID, QR token, atau data participant yang tidak diperlukan.
- Tidak ada Registration ID, email, atau data participant pada URL/query parameter, browser log, atau analytics payload.
- Repeated invalid verification dibatasi oleh limiter durable berbasis Supabase/Postgres, bukan `Map` atau counter process-local.
- Limiter menyimpan HMAC key hash tanpa raw email/Registration ID/IP, aman terhadap request concurrent, berlaku lintas instance, dan retention cleanup dibatasi satu hari.
- Rate limit tetap efektif pada request independen yang tidak berbagi memory server.

Room UI dan pickup UI tidak termasuk hotfix ini dan tidak tersedia pada worktree hotfix.
