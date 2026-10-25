import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";
import { loadPublishedEventForm } from "@/lib/tenant/public-events";
import type { PublishedEventForm } from "@/lib/tenant/public-events";

import { Footer } from "../landing/footer";
import { RegistrationFlow } from "./registration-flow";
import { RegistrationHeader } from "./registration-header";
import { RegistrationInformation } from "./registration-information";
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
       <div className={styles.eventItem}>
         <p className={styles.eventLabel}>Registrasi Kepulangan</p>
        <p className={styles.eventValue}>{AKKAI_EVENT.day3Date}</p>
      </div>
    </div>
  );
}

function GenericEventInformation({ publishedForm }: { publishedForm: PublishedEventForm }) {
  return (
    <div className={styles.eventCard}>
      <div className={styles.eventItem}>
        <p className={styles.eventLabel}>Event</p>
        <p className={styles.eventValue}>{publishedForm.eventName}</p>
      </div>
      <div className={styles.eventItem}>
        <p className={styles.eventLabel}>Kode Event</p>
        <p className={styles.eventValue}>{publishedForm.eventCode}</p>
      </div>
      {publishedForm.startsOn ? (
        <div className={styles.eventItem}>
          <p className={styles.eventLabel}>Tanggal Mulai</p>
          <p className={styles.eventValue}>{publishedForm.startsOn}</p>
        </div>
      ) : null}
      {publishedForm.endsOn ? (
        <div className={styles.eventItem}>
          <p className={styles.eventLabel}>Tanggal Selesai</p>
          <p className={styles.eventValue}>{publishedForm.endsOn}</p>
        </div>
      ) : null}
    </div>
  );
}

function RegistrationClosed({ isAkkaiEvent }: { isAkkaiEvent: boolean }) {
  return (
    <section className={styles.closedCard}>
      <p className={styles.eyebrow}>Registrasi Peserta</p>
      <h1 className={`${styles.displayFont} ${styles.closedTitle}`}>
        Registrasi Telah Ditutup
      </h1>
      <p className={styles.closedDescription}>
        {isAkkaiEvent ? `Periode registrasi ${AKKAI_EVENT.name} telah berakhir.` : "Pendaftaran event ini sedang ditutup."}
      </p>
      <Link className={styles.primaryLink} href="/">
        Kembali ke Beranda
      </Link>
    </section>
  );
}

function RegistrationContent({
  publishedForm,
  isAkkaiEvent,
}: {
  publishedForm: NonNullable<Awaited<ReturnType<typeof loadPublishedEventForm>>>;
  isAkkaiEvent: boolean;
}) {
  return (
    <div className={styles.container}>
      <Link className={styles.mobileBackLink} href="/">
        <span aria-hidden="true">&larr;</span> Kembali ke Beranda
      </Link>

      <section className={styles.introduction}>
        <p className={styles.eyebrow}>Registrasi Peserta</p>
        <h1 className={`${styles.displayFont} ${styles.title}`}>
          {publishedForm.config.title}
        </h1>
        <div aria-hidden="true" className={styles.goldDivider} />
        <p className={styles.introDescription}>
          {publishedForm.config.instructions}
        </p>
          {isAkkaiEvent ? <EventInformation /> : <GenericEventInformation publishedForm={publishedForm} />}
       </section>

       <div className={styles.workspace}>
         <div className={styles.formColumn}>
            <RegistrationFlow publishedForm={publishedForm} />
         </div>
          {isAkkaiEvent ? <aside className={styles.sidebar}><RegistrationInformation /></aside> : null}
       </div>
    </div>
  );
}

export async function RegistrationPage({ eventSlug = "akkai-2026" }: { eventSlug?: string } = {}) {
  const isAkkaiEvent = eventSlug === "akkai-2026";
  const publishedForm = await loadPublishedEventForm(eventSlug);

  return (
    <div className={styles.root}>
      <RegistrationHeader />
      <main className={styles.main}>
        {publishedForm ? (
          <RegistrationContent isAkkaiEvent={isAkkaiEvent} publishedForm={publishedForm} />
        ) : (
          <div className={styles.closedContainer}>
          <RegistrationClosed isAkkaiEvent={isAkkaiEvent} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
