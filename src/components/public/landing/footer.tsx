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
              <h3 className={styles.footerTitle}>{AKKAI_EVENT.name}</h3>
              <p className={styles.footerCopy}>
                Diselenggarakan oleh {AKKAI_EVENT.organizer}.
              </p>
            </div>
          </div>
        </div>
        <div>
          <h3 className={styles.footerTitle}>Didukung oleh</h3>
          <p className={styles.footerCopy}>{AKKAI_EVENT.eventHandler}</p>
        </div>
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}>
        Data yang dikirimkan hanya digunakan untuk kebutuhan registrasi dan administrasi acara.
      </div>
    </footer>
  );
}
