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

Travel UI, room UI, dan pickup UI tidak termasuk hotfix ini dan tidak tersedia pada worktree hotfix.
