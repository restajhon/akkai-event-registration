import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./registration.module.css";

export function RegistrationHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          aria-label="Kembali ke halaman utama"
          className={styles.brand}
          href="/"
        >
          <span aria-hidden="true" className={styles.brandMark}>
            AK
          </span>
          <span className={`${styles.displayFont} ${styles.brandName}`}>
            {AKKAI_EVENT.shortName}
          </span>
        </Link>

        <Link className={styles.headerBackLink} href="/">
          Kembali ke Beranda
        </Link>
      </div>
    </header>
  );
}
