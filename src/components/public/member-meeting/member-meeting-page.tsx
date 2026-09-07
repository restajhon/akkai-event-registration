import Link from "next/link";

import { Footer } from "../landing/footer";
import { RegistrationHeader } from "../registration/registration-header";
import { MemberMeetingForm } from "./member-meeting-form";
import styles from "./member-meeting.module.css";

const rundown = [
  ["19.30 – 19.45 WIB", "Pembukaan"],
  [
    "19.45 – 20.00 WIB",
    "Pemeriksaan Quorum, Pembacaan Tata Tertib Rapat, Pemilihan Ketua Rapat Anggota.",
  ],
  [
    "20.00 – 21.00 WIB",
    "Rapat Pleno I – Perubahan Anggaran Dasar AKKAI.",
  ],
  [
    "21.00 – 21.30 WIB",
    "Rapat Pleno II – Penyampaian Laporan Pertanggung Jawaban Pengurus AKKAI 2023-2026.",
  ],
  [
    "21.30 – 22.00 WIB",
    "Rapat Pleno III – Pemilihan dan Pengesahan Ketua Pengurus AKKAI 2026-2029.",
  ],
  [
    "22.00 – 22.15 WIB",
    "Rapat Pleno IV – Penyampaian Laporan Pertanggung Jawaban Majelis Kehormatan AKKAI 2023-2026.",
  ],
  [
    "22.15 – 22.30 WIB",
    "Rapat Pleno V – Pemilihan dan Pengesahan Majelis Kehormatan AKKAI 2026-2029.",
  ],
  [
    "22.30 – 23.00 WIB",
    "Rapat Pleno VI – Penyusunan dan Pengesahan Garis Besar Arah Asosiasi 2026-2029.",
  ],
  ["23.00 WIB", "Penutupan dan Foto Bersama."],
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
            <p className={styles.introDescription}>Hari ke-2, 20 Oktober 2026</p>
          </section>

          <div className={styles.contentGrid}>
            <MemberMeetingForm />
            <section className={styles.rundownCard}>
              <div aria-hidden="true" className={styles.rundownAccent} />
              <h2 className={`${styles.displayFont} ${styles.rundownTitle}`}>
                Rundown Rapat Anggota AKKAI 2026
              </h2>
              <p className={styles.rundownDate}>20 Oktober 2026</p>
              <table className={styles.rundownTable}>
                <thead>
                  <tr>
                    <th scope="col">Waktu</th>
                    <th scope="col">Agenda</th>
                  </tr>
                </thead>
                <tbody>
                  {rundown.map(([time, agenda]) => (
                    <tr key={time}>
                      <th scope="row">{time}</th>
                      <td>{agenda}</td>
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
