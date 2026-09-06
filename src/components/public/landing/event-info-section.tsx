import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./landing.module.css";

const activityHighlights = [
  "Kedatangan & AKKAI Night",
  "Seminar & Rapat Anggota",
  "Registrasi Kepulangan & City Tour",
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
          {AKKAI_EVENT.participantRundown.map((day, index) => (
            <article
              className={`${styles.dayCard} ${index === 1 ? styles.dayCardFeatured : ""}`}
              key={day.day}
            >
              <span className={styles.dayTag}>{day.day}</span>
              <span className={styles.dayDate}>{day.date}</span>
              <h3 className={styles.dayTitle}>{activityHighlights[index]}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
