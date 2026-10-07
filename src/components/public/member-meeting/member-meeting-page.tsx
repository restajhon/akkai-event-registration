import Link from "next/link";

import { Footer } from "../landing/footer";
import { RegistrationHeader } from "../registration/registration-header";
import { MemberMeetingForm } from "./member-meeting-form";
import styles from "./member-meeting.module.css";

const rundown = [
  { time: "16:00–16:15 WIB", agenda: "Pembukaan" },
  {
    time: "16:15–16:30 WIB",
    agenda: "Pemeriksaan Quorum, Pembacaan Tata Tertib Rapat, Pemilihan Ketua Rapat Anggota.",
  },
  {
    time: "16:30–17:30 WIB",
    agenda: "Rapat Pleno I – Perubahan Anggaran Dasar AKKAI.",
  },
  { time: "18:00–19:30 WIB", agenda: "ISHOMA" },
  {
    time: "19:30–20:00 WIB",
    agenda: "Rapat Pleno II – Penyampaian Laporan Pertanggung Jawaban Pengurus AKKAI 2023-2026.",
  },
  {
    time: "20:00–20:30 WIB",
    agenda: "Rapat Pleno III – Pemilihan dan Pengesahan Ketua Pengurus AKKAI 2026-2029.",
  },
  {
    time: "20:30–20:45 WIB",
    agenda: "Rapat Pleno IV – Penyampaian Laporan Pertanggung Jawaban Majelis Kehormatan AKKAI 2023-2026.",
  },
  {
    time: "20:45–21:00 WIB",
    agenda: "Rapat Pleno V – Pemilihan dan Pengesahan Majelis Kehormatan AKKAI 2026-2029.",
  },
  {
    time: "21:00–21:30 WIB",
    agenda: "Rapat Pleno VI – Penyusunan dan Pengesahan Garis Besar Arah Asosiasi 2026-2029.",
  },
  { time: "21:30–22:00 WIB", agenda: "Penutupan dan Foto Bersama" },
] as const;

export function MemberMeetingPage() {
  return (
    <div className={styles.root}>
      <RegistrationHeader />
      <main className={styles.main}>
        <div className={styles.container}>
          <Link className={styles.backLink} href="/">
            <span aria-hidden="true">&larr;</span> Kembali ke Beranda
          </Link>

          <section className={styles.introduction}>
            <p className={styles.eyebrow}>Rapat Anggota AKKAI 2026</p>
            <h1 className={`${styles.displayFont} ${styles.title}`}>
              Formulir Rapat Anggota AKKAI 2026
            </h1>
            <div aria-hidden="true" className={styles.goldDivider} />
            <p className={styles.introDescription}>Hari ke-1, 19 Oktober 2026</p>
          </section>

          <div className={styles.contentGrid}>
            <MemberMeetingForm />
            <section className={styles.rundownCard}>
              <div aria-hidden="true" className={styles.rundownAccent} />
              <h2 className={`${styles.displayFont} ${styles.rundownTitle}`}>
                Rundown Rapat Anggota AKKAI 2026
              </h2>
              <p className={styles.rundownDate}>Senin, 19 Oktober 2026</p>
              <p className={styles.rundownTime}>16:00–22:00 WIB</p>
              <table aria-label="Rundown Rapat Anggota" className={styles.rundownTable}>
                <thead>
                  <tr>
                    <th scope="col">Waktu</th>
                    <th scope="col">Agenda</th>
                  </tr>
                </thead>
                <tbody>
                  {rundown.map(({ time, agenda }) => (
                    <tr key={time}>
                      <th scope="row">
                        <span className={styles.rundownMobileLabel}>Waktu</span>
                        {time}
                      </th>
                      <td>
                        <span className={styles.rundownMobileLabel}>Agenda</span>
                        {agenda}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
