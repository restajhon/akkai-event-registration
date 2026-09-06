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
          Seminar &amp; Rapat Anggota Tahunan
        </span>
        <h1 className={styles.heroTitle}>
          Seminar Profesi Konsultan Aktuaria Indonesia, Sertifikasi CIAC dan
          <span className={styles.heroTitleAccent}> Rapat Anggota AKKAI 2026</span>
        </h1>
        <p className={styles.heroCopy}>
          Lakukan registrasi secara online dan terima kode QR unik melalui email
          untuk proses verifikasi kehadiran di setiap rangkaian acara.
        </p>
        <div className={styles.heroMeta}>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Tanggal acara</span>
            <span className={styles.metaValue}>{AKKAI_EVENT.date}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Lokasi pertemuan</span>
            <span className={styles.metaValue}>{AKKAI_EVENT.venue}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Rangkaian kegiatan</span>
            <span className={styles.metaValue}>Tiga hari acara resmi</span>
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
