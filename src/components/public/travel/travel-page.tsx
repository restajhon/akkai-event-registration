import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";

import { Footer } from "../landing/footer";
import { RegistrationHeader } from "../registration/registration-header";
import { TravelForm } from "./travel-form";
import styles from "./travel.module.css";

export function TravelPage() {
  return (
    <div className={styles.root}>
      <RegistrationHeader />
      <main className={styles.main}>
        <div className={styles.container}>
          <Link className={styles.backLink} href="/">
            <span aria-hidden="true">&larr;</span> Kembali ke Beranda
          </Link>

          <section className={styles.introduction}>
            <p className={styles.eyebrow}>Peserta Terdaftar</p>
            <h1 className={`${styles.displayFont} ${styles.title}`}>
              Informasi Perjalanan
            </h1>
            <div aria-hidden="true" className={styles.goldDivider} />
            <p className={styles.introDescription}>
              Form ini digunakan peserta yang sudah terdaftar untuk melengkapi
              informasi perjalanan menuju dan dari Semarang.
            </p>
          </section>
          <div className={styles.preparationCard}>
            <div className={styles.preparationIcon} aria-hidden="true">✓</div>
            <div>
              <h2 className={styles.preparationTitle}>Lokasi acara</h2>
              <p className={`${styles.displayFont} ${styles.contextValue}`}>{AKKAI_EVENT.venue}</p>
              <p className={styles.contextCopy}>
                Seluruh peserta menginap di hotel yang sama. Informasi hotel ini bersifat tetap dan tidak perlu diisi pada formulir.
              </p>
            </div>
          </div>
          <nav aria-label="Tahapan informasi perjalanan" className={styles.stepper}>
            {[
              ["01", "Verifikasi Peserta", "step-1"],
              ["02", "Keberangkatan", "step-2"],
              ["03", "Kepulangan", "step-3"],
              ["04", "Informasi Menginap", "step-4"],
            ].map(([number, label, id]) => (
              <a className={styles.step} href={`#${id}`} key={id}>
                <span className={styles.stepNumber}>{number}</span>
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className={styles.workspace}>
            <TravelForm />
            <aside className={styles.sidebar}>
              <section className={styles.summaryCard}>
                <div className={styles.summaryAccent} />
                <h2 className={`${styles.displayFont} ${styles.summaryTitle}`}>{AKKAI_EVENT.shortName}</h2>
                <dl className={styles.summaryList}>
                  <div><dt>Tanggal Acara</dt><dd>{AKKAI_EVENT.date}</dd></div>
                  <div><dt>Lokasi</dt><dd>{AKKAI_EVENT.venue}</dd></div>
                  <div><dt>Registrasi Kedatangan</dt><dd>{AKKAI_EVENT.arrivalDate}</dd></div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
