import Link from "next/link";

import { Footer } from "../landing/footer";
import { RegistrationHeader } from "../registration/registration-header";
import { MemberMeetingForm } from "./member-meeting-form";
import styles from "./member-meeting.module.css";

const rundown = [
  { time: "16:00–16:15", agenda: "Pembukaan" },
  { time: "16:15–16:30", agenda: "QUORUM" },
  { time: "16:30–17:30", agenda: "Rapat Pleno 1" },
  { time: "18:00–19:30", agenda: "ISHOMA" },
  { time: "19:30–20:00", agenda: "Rapat Pleno 2" },
  { time: "20:00–20:30", agenda: "Rapat Pleno 3" },
  { time: "20:30–20:45", agenda: "Rapat Pleno 4" },
  { time: "20:45–21:00", agenda: "Rapat Pleno 5" },
  { time: "21:00–21:30", agenda: "Rapat Pleno 6" },
  { time: "21:30–22:00", agenda: "Penutupan dan Foto Bersama" },
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
