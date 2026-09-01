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
            <div className={styles.contextCard}>
              <p className={styles.contextLabel}>Lokasi acara</p>
              <p className={`${styles.displayFont} ${styles.contextValue}`}>
                {AKKAI_EVENT.venue}
              </p>
              <p className={styles.contextCopy}>
                Seluruh peserta menginap di hotel yang sama. Informasi hotel ini
                bersifat tetap dan tidak perlu diisi pada formulir.
              </p>
            </div>
          </section>

          <TravelForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
