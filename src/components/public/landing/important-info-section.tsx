import { IMPORTANT_INFO } from "@/lib/akkai-event";

import styles from "./landing.module.css";

export function ImportantInfoSection() {
  return (
    <section className={`${styles.section} ${styles.sectionPaper}`}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Ketentuan Peserta</p>
            <h2 className={styles.sectionTitle}>Informasi Penting</h2>
          </div>
          <p className={styles.sectionDescription}>Harap perhatikan poin-poin berikut sebelum melakukan registrasi.</p>
        </div>
        <div className={styles.infoGrid}>
          {IMPORTANT_INFO.map((info) => (
            <div className={styles.infoCard} key={info}>
              <span aria-hidden="true" className={styles.infoMark}>✓</span>
              <p className={styles.infoText}>{info}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
