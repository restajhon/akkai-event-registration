import { AKKAI_EVENT } from "@/lib/akkai-event";

import { RegistrationLink } from "./registration-link";
import styles from "./landing.module.css";

export function RegistrationCTA() {
  return (
    <section className={styles.cta}>
      <div className={`${styles.container} ${styles.ctaContent}`}>
        <p className={styles.eyebrow}>Pendaftaran Peserta</p>
        <h2 className={styles.ctaTitle}>Siap mengikuti {AKKAI_EVENT.name}?</h2>
        <p className={styles.ctaCopy}>
          Selesaikan registrasi Anda dan dapatkan kode QR unik untuk rangkaian
          acara di {AKKAI_EVENT.venue}.
        </p>
        <RegistrationLink className={styles.footerCta} />
      </div>
    </section>
  );
}
