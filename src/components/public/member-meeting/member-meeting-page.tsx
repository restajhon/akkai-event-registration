import Link from "next/link";

import { Footer } from "../landing/footer";
import { RegistrationHeader } from "../registration/registration-header";
import { MemberMeetingForm } from "./member-meeting-form";
import styles from "./member-meeting.module.css";

const rundown = [
  "Pembukaan",
  "Pemeriksaan Quorum, Pembacaan Tata Tertib Rapat, Pemilihan Ketua Rapat Anggota.",
  "Rapat Pleno I – Perubahan Anggaran Dasar AKKAI.",
  "Rapat Pleno II – Penyampaian Laporan Pertanggung Jawaban Pengurus AKKAI 2023-2026.",
  "Rapat Pleno III – Pemilihan dan Pengesahan Ketua Pengurus AKKAI 2026-2029.",
  "Rapat Pleno IV – Penyampaian Laporan Pertanggung Jawaban Majelis Kehormatan AKKAI 2023-2026.",
  "Rapat Pleno V – Pemilihan dan Pengesahan Majelis Kehormatan AKKAI 2026-2029.",
  "Rapat Pleno VI – Penyusunan dan Pengesahan Garis Besar Arah Asosiasi 2026-2029.",
  "Penutupan dan Foto Bersama.",
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
              <p className={styles.rundownTime}>16:00–21:00 WIB</p>
              <ol aria-label="Agenda Rapat Anggota" className={styles.rundownAgenda}>
                {rundown.map((agenda) => (
                  <li key={agenda}>{agenda}</li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
