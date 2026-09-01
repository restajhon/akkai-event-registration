import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";

import { Footer } from "../landing/footer";
import { RegistrationForm } from "./registration-form";
import { RegistrationHeader } from "./registration-header";
import styles from "./registration.module.css";

function EventInformation() {
  return (
    <div className={styles.eventCard}>
      <div className={styles.eventItem}>
        <p className={styles.eventLabel}>Tanggal Acara</p>
        <p className={styles.eventValue}>{AKKAI_EVENT.date}</p>
      </div>
      <div className={styles.eventItem}>
        <p className={styles.eventLabel}>Lokasi</p>
        <p className={styles.eventValue}>{AKKAI_EVENT.venue}</p>
      </div>
      <div className={styles.eventItem}>
        <p className={styles.eventLabel}>Registrasi Kedatangan</p>
        <p className={styles.eventValue}>{AKKAI_EVENT.arrivalDate}</p>
      </div>
      <div className={styles.eventItem}>
        <p className={styles.eventLabel}>Seminar AKKAI 2026</p>
        <p className={styles.eventValue}>{AKKAI_EVENT.seminarDate}</p>
      </div>
    </div>
  );
}

function RegistrationClosed() {
  return (
    <section className={styles.closedCard}>
      <p className={styles.eyebrow}>Registrasi Peserta</p>
      <h1 className={`${styles.displayFont} ${styles.closedTitle}`}>
        Registrasi Telah Ditutup
      </h1>
      <p className={styles.closedDescription}>
        Periode registrasi {AKKAI_EVENT.name} telah berakhir.
      </p>
      <Link className={styles.primaryLink} href="/">
        Kembali ke Beranda
      </Link>
    </section>
  );
}

function RegistrationContent() {
  return (
    <div className={styles.container}>
      <Link className={styles.mobileBackLink} href="/">
        <span aria-hidden="true">&larr;</span> Kembali ke Beranda
      </Link>

      <section className={styles.introduction}>
        <p className={styles.eyebrow}>Registrasi Peserta</p>
        <h1 className={`${styles.displayFont} ${styles.title}`}>
          Formulir Registrasi {AKKAI_EVENT.name}
        </h1>
        <div aria-hidden="true" className={styles.goldDivider} />
        <p className={styles.introDescription}>
          Lengkapi data berikut dengan benar untuk menyimpan pendaftaran Anda.
        </p>
        <EventInformation />
      </section>

      <RegistrationForm />
    </div>
  );
}

export function RegistrationPage() {
  return (
    <div className={styles.root}>
      <RegistrationHeader />
      <main className={styles.main}>
        {AKKAI_EVENT.registrationOpen ? (
          <RegistrationContent />
        ) : (
          <div className={styles.closedContainer}>
            <RegistrationClosed />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
