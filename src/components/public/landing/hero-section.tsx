import { AKKAI_EVENT } from "@/lib/akkai-event";

import { RegistrationLink } from "./registration-link";
import styles from "./landing.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div aria-hidden="true" className={styles.ambientOne} />
      <div aria-hidden="true" className={styles.ambientTwo} />
      <div className={`${styles.container} ${styles.heroContent}`}>
        <span className={styles.heroBadge}>
          <span aria-hidden="true" className={styles.statusDot} />
          Rapat Anggota
        </span>
        <h1 className={styles.heroTitle}>
          {AKKAI_EVENT.name}
        </h1>
        <p className={styles.heroCopy}>
          Lakukan registrasi secara online dan terima kode QR unik melalui email
          untuk proses verifikasi kehadiran.
        </p>
        <div className={styles.heroMeta}>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Tanggal</span>
            <span className={styles.metaValue}>{AKKAI_EVENT.date}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Lokasi</span>
            <span className={styles.metaValue}>{AKKAI_EVENT.venue}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Registrasi Kedatangan</span>
            <span className={styles.metaValue}>{AKKAI_EVENT.arrivalDate}</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <RegistrationLink className={styles.primaryCta} />
          <a className={styles.secondaryCta} href="#rundown">Lihat Rundown Acara</a>
        </div>
      </div>
    </section>
  );
}
