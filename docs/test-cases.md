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
