import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./landing.module.css";

export function EventInfoSection() {
  return (
    <section className={`${styles.section} ${styles.sectionPaper}`} id="informasi">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Informasi Acara</p>
            <h2 className={styles.sectionTitle}>Detail Rangkaian Kegiatan</h2>
          </div>
          <p className={styles.sectionDescription}>
            Tiga hari agenda seminar profesi aktuaria, sertifikasi CIAC, dan
            Rapat Anggota AKKAI di {AKKAI_EVENT.location}.
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
              <h3 className={styles.dayTitle}>{day.items[0]?.title}</h3>
              <p className={styles.dayText}>
                {index === 0
                  ? "Penyambutan peserta dan registrasi kedatangan."
                  : index === 1
                    ? "Seminar utama, sertifikasi CIAC, dan Rapat Anggota."
                    : "Rangkaian kepulangan dan penutupan kegiatan."}
              </p>
              <div className={styles.dayFooter}>{day.items.length} agenda terjadwal</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
