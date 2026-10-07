import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./landing.module.css";

const activityHighlights = [
  {
    title: "Kedatangan & Rapat Anggota",
    summary: "Kedatangan peserta, registrasi dan check-in hotel, serta Rapat Anggota.",
  },
  {
    title: "Seminar & AKKAI Night",
    summary: "Registrasi peserta, Seminar Profesi Konsultan Aktuaria, Sertifikasi CIAC, dan AKKAI Night.",
  },
  {
    title: "Registrasi Kepulangan & City Tour",
    summary: "Registrasi kepulangan, City Tour Semarang, makan siang, wisata belanja, serta drop-off ke stasiun atau bandara.",
  },
] as const;

export function EventInfoSection() {
  return (
    <section className={`${styles.section} ${styles.sectionPaper}`} id="informasi">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Informasi Acara</h2>
          </div>
          <p className={styles.sectionDescription}>
            Detail lengkap mengenai {AKKAI_EVENT.name}.
          </p>
        </div>
        <div className={styles.dayGrid}>
          {AKKAI_EVENT.homepageRundown.map((day, index) => (
            <article
              className={`${styles.dayCard} ${index === 1 ? styles.dayCardFeatured : ""}`}
              key={day.day}
            >
              <span className={styles.dayTag}>{day.day}</span>
              <span className={styles.dayDate}>{day.date}</span>
              <h3 className={styles.dayTitle}>{activityHighlights[index].title}</h3>
              <p className={styles.daySummary}>{activityHighlights[index].summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
