import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";

import { RegistrationLink } from "./registration-link";
import styles from "./landing.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.topBand}>
        <div className={styles.topBandInner}>
          <div className={styles.topBandGroup}>
            <span aria-hidden="true" className={styles.statusDot} />
            <span>{AKKAI_EVENT.shortName}</span>
            <span className={styles.topBandMuted}>• {AKKAI_EVENT.venue}</span>
            <span className={styles.topBandMuted}>• Batas akhir pendaftaran dan pembayaran: Jumat, 2 Oktober 2026</span>
          </div>
        </div>
      </div>
      <div className={styles.navInner}>
        <Link aria-label="Kembali ke halaman utama" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.brandMark}>AK</span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>{AKKAI_EVENT.shortName}</span>
          </span>
        </Link>
        <nav aria-label="Navigasi utama" className={styles.navLinks}>
          <Link className={styles.navLink} href="#informasi">Informasi Acara</Link>
          <Link className={styles.navLink} href="#rundown">Rundown Acara</Link>
          <Link className={styles.navLink} href="#paket">Paket &amp; Biaya</Link>
          <Link className={styles.navLink} href="/travel">Informasi Perjalanan</Link>
        </nav>
        <RegistrationLink className={styles.navCta} />
      </div>
    </header>
  );
}
