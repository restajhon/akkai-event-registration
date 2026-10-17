# QA PASS dan checklist release production — 17 Oktober 2026

## Hasil QA

**PASS** — Penguji melaporkan alur end-to-end registrasi hingga scan berhasil pada kelima sesi: `ARRIVAL`, `DAY1_MEMBER_MEETING`, `SEMINAR`, `DAY2_AKKAI_NIGHT`, dan `DAY3`.

Verifikasi record dilakukan **read-only** pada Supabase QA `ydzuazlzgsgcwhqzbsmv` (`akkai-registration-qa`) pada **2026-10-17 03:43 UTC**. Hasilnya mencakup seluruh record attendance dan scan event yang ada di QA saat pemeriksaan, bukan pemeriksaan log aplikasi atau production.

| Sesi | Attendance | Scan `SUCCESS` | Scan `ALREADY_CHECKED_IN` |
| --- | ---: | ---: | ---: |
| `ARRIVAL` | 8 | 8 | 1 |
| `DAY1_MEMBER_MEETING` | 6 | 6 | 1 |
| `SEMINAR` | 6 | 6 | 1 |
| `DAY2_AKKAI_NIGHT` | 6 | 6 | 2 |
| `DAY3` | 6 | 6 | 1 |
| **Total** | **32** | **32** | **6** |

- **0 scan event berstatus `ERROR`**; tidak ada status penolakan lain pada 38 scan event. Enam `ALREADY_CHECKED_IN` adalah respons duplikasi yang diharapkan, bukan kegagalan penyimpanan.
- **0 masalah integritas terdeteksi** pada pasangan peserta+sesi attendance (duplikat), QR attendance tanpa station, relasi attendance/scan ke session dan station, rujukan scan ke attendance, atau semantik status scan yang diperiksa. Pemeriksaan ini melengkapi constraint database, tidak menggantikan pemeriksaan log runtime.
- Kelima session berstatus `CLOSED` setelah pengujian. Migration `20261009230000` tercatat sama di Local dan Remote QA pada `supabase migration list --linked`.

**QA tambahan: PASS (dilaporkan penguji).** Dua sesi dibuka bersamaan dengan dua station dan dua scanner; scan masuk ke sesi masing-masing dan Live Display berjalan lancar. Multi-session `OPEN` bersamaan adalah perilaku yang didukung, tanpa batas satu sesi aktif secara global.

Pemeriksaan lokal awal sebelum integrasi branch: `npm run lint`, `npm test` (38 file, 189 test), `npx tsc --noEmit`, dan `npm run build` lulus. Kandidat integrasi harus menjalankan ulang seluruh pemeriksaan tersebut pada commit final.

## Cakupan kandidat release

- Branch kandidat: `release/akkai-2026-qa-candidate`, dibangun dari rangkaian commit fitur sesi sampai `11b4c10` dan merge perubahan registrasi kolektif/rapat anggota `7a80df5`. Riwayat kedua branch dipertahankan untuk audit.
- Lima migration Oktober yang telah terpasang pada QA menjadi file tracked: `20261002100000`, `20261002110000`, `20261002120000`, `20261004100000` (berasal dari `7a80df5`) dan `20261009230000` (berasal dari `11b4c10`). Hash file sama dengan sumber lokal yang sebelumnya belum tracked. Riwayat QA Local/Remote cocok hingga `20261009230000`.
- Perubahan lokal yang diikutkan: teks multi-session pada UI, SOP/PRD, test dua session `OPEN`, catatan QA/release ini, serta `.vercelignore`/konfigurasi lint untuk keamanan input deployment dan pemeriksaan worktree. Perubahan registrasi/rapat anggota yang identik dengan `7a80df5` diambil melalui merge, bukan diduplikasi dari working tree.
- Perubahan lokal lain pada checkout asal tetap **di luar kandidat** dan tidak dihapus: desain referensi, revamp visual admin (layout, CSS, detail peserta, tombol download), penyaringan/ekspor peserta yang dibatalkan dan pemolesan form, beserta test terkait. Perubahan ini perlu review dan QA terpisah sebelum dijadikan bagian rilis lain.
- Preview untuk branch fitur sesi lama memiliki override QA; variabel Preview umum pada project Vercel tidak boleh diasumsikan mengarah ke QA. Deployment kandidat harus membawa override build-time dan runtime yang spesifik untuk project QA `ydzuazlzgsgcwhqzbsmv`; verifikasi ref pada deployment sebelum melakukan smoke test. Jangan menggunakan `--prod`.

## Checklist release production

Status: **persiapan; belum ada perubahan pada production**. Centang gate berikut saat pelaksanaan release, setelah otorisasi release diberikan.

### Paket rilis dan verifikasi sebelum perubahan

- [x] Catat QA E2E PASS dan periksa record attendance/scan QA seperti di atas.
- [ ] Tetapkan commit/artifact kandidat final dan bandingkan dengan deployment QA yang telah lulus E2E; perubahan hasil merge `7a80df5` juga harus diverifikasi pada Preview kandidat.
- [x] Pastikan kelima file migration QA tracked pada branch kandidat dan cocok dengan sumbernya; jangan mengandalkan migration untracked pada checkout asal.
- [x] Sertakan pembaruan teks UI/SOP dan automated test dua sesi `OPEN` dengan station/scanner masing-masing; tidak ada unique constraint yang membatasi satu sesi `OPEN` secara global.
- [ ] Review diff final dan perubahan kerja lain; pilih hanya perubahan yang memang ikut release. Jalankan `npm run lint`, `npm test`, `npx tsc --noEmit`, dan `npm run build` pada kandidat final, kemudian cocokkan perilakunya dengan yang diuji di QA.
- [ ] Konfirmasi target project ref **production** secara eksplisit dan pastikan berbeda dari QA `ydzuazlzgsgcwhqzbsmv`; verifikasi target CLI/Vercel dan environment server/browser (Supabase URL dan key) tanpa mencetak rahasia. Jangan menggunakan `.env.local` sebagai bukti target deployment.
- [ ] Ambil snapshot/backup dan titik rollback production, termasuk versi aplikasi, riwayat migration, serta rencana pemulihan data; tentukan jadwal dan penanggung jawab release.

### Saat release disetujui (belum dijalankan)

- [ ] Jalankan `supabase migration list` terhadap **production yang sudah diverifikasi**; cocokkan riwayat Local/Remote. Review `supabase db push --dry-run` ke target itu dan hentikan bila ada migration yang tidak direncanakan, termasuk migration QA yang ternyata belum ada di production.
- [ ] Setelah daftar migration disetujui, terapkan migration yang diperlukan hanya ke production yang telah diverifikasi, lalu ulangi `migration list` hingga Local/Remote cocok. Jangan menandai migration sebagai applied tanpa penerapan dan verifikasi sebenarnya.
- [ ] Deploy artifact aplikasi yang sama dengan kandidat yang diverifikasi; pastikan konfigurasi deployment menunjuk ke Supabase production yang benar dan tidak membocorkan `SUPABASE_SECRET_KEY`/`RESEND_API_KEY` ke browser.
- [ ] Smoke test terotorisasi: registrasi hingga tiket/QR, kelima sesi pada halaman admin, station creation/pairing, scan dan penolakan duplikat, attendance/dashboard/export. Jika menguji dua sesi `OPEN` bersamaan, gunakan station/scanner terpisah dan periksa isolasi hasil scan serta Live Display; tutup kembali sesi uji dan station setelah selesai. Pastikan data uji production ditangani sesuai prosedur operasional.
- [ ] Pantau error aplikasi, log, status `scan_events`, serta integritas attendance pascadeploy; jika gagal, hentikan rollout dan ikuti rencana rollback yang sudah disepakati. Catat commit, target ref, migration, waktu, dan hasil smoke test production.

### Rencana rollback untuk review (belum dijalankan)

1. Sebelum perubahan production, catat deployment/commit production yang aktif, beri penanda restore point dan ambil backup database; simpan riwayat migration production serta validasi restore backup.
2. Jika smoke test aplikasi gagal, hentikan traffic ke versi baru dan kembalikan deployment Vercel ke deployment production sebelumnya. Verifikasi kembali login, registrasi, dan check-in terhadap database yang tetap ada.
3. Migration dalam kandidat adalah perbaikan fungsi/tabel dan penambahan sesi. Jangan menghapus migration atau menandai riwayat sebagai applied secara manual saat rollback aplikasi; bila skema/data harus dibatalkan, lakukan analisis kompatibilitas, forward fix atau pemulihan dari backup teruji melalui prosedur production yang disetujui.
4. Pantau scan/attendance, email, dan error pascarollback; dokumentasikan dampak terhadap data yang masuk sejak release dan keputusan tindak lanjut sebelum mencoba rollout ulang.
