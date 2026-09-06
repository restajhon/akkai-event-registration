import { AKKAI_EVENT, REGISTRATION_STEPS } from "@/lib/akkai-event";

import styles from "./landing.module.css";

export function RegistrationFlow() {
  return (
    <section className={styles.section} id="alur-registrasi">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Langkah Partisipasi</p>
            <h2 className={styles.sectionTitle}>Alur Registrasi</h2>
          </div>
          <p className={styles.sectionDescription}>Empat langkah sederhana untuk menyelesaikan registrasi.</p>
        </div>
        <div className={styles.flowGrid}>
          {REGISTRATION_STEPS.map((step, index) => (
            <div className={styles.flowItem} key={step.number}>
              <div className={styles.flowNumber}>{step.number}</div>
              <h3 className={styles.flowTitle}>{step.title}</h3>
              <p className={styles.flowText}>{step.description}</p>
              {index < REGISTRATION_STEPS.length - 1 ? (
                <div aria-hidden="true" className={styles.flowConnector} />
              ) : null}
            </div>
          ))}
        </div>
        <div className={styles.qrCard}>
          <h3 className={styles.qrTitle}>Kegunaan Kode QR</h3>
          <p className={styles.qrCopy}>Kode QR yang Anda terima akan digunakan untuk tiga sesi acara:</p>
          <ul className={styles.qrList}>
            <li className="flex items-start gap-3">
              <span>Registrasi Kedatangan — {AKKAI_EVENT.arrivalDate}</span>
            </li>
            <li className="flex items-start gap-3">
              <span>Seminar AKKAI 2026 — {AKKAI_EVENT.seminarDate}</span>
            </li>
            <li className="flex items-start gap-3">
              <span>Registrasi Kepulangan — {AKKAI_EVENT.day3Date}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
