import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./landing.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div>
          <div className={styles.footerBrand}>
            <span aria-hidden="true" className={styles.brandMark}>AK</span>
            <div>
              <h3 className={styles.footerTitle}>AKKAI 2026</h3>
              <p className={styles.footerCopy}>{AKKAI_EVENT.name}</p>
            </div>
          </div>
          <p className={styles.footerCopy}>
            Diselenggarakan oleh {AKKAI_EVENT.organizer} dan didukung oleh {AKKAI_EVENT.eventHandler}.
          </p>
        </div>
        <nav aria-label="Navigasi footer" className={styles.footerLinks}>
          <a className={styles.footerLink} href="#informasi">Informasi Acara</a>
          <a className={styles.footerLink} href="#rundown">Rundown</a>
          <a className={styles.footerLink} href="/travel">Informasi Perjalanan</a>
        </nav>
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}>
        Data yang dikirimkan hanya digunakan untuk kebutuhan registrasi dan administrasi acara.
      </div>
    </footer>
  );
}
