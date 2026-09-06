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
            <p className={styles.eyebrow}>Portal Logistik Delegasi Resmi / AKKAI 2026</p>
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
              <h2 className={styles.preparationTitle}>Persiapan sebelum mengisi</h2>
              <p className={styles.preparationCopy}>
                Siapkan Registration ID, email terdaftar, serta jadwal moda transportasi
                menuju dan dari {AKKAI_EVENT.location}.
              </p>
            </div>
            <div className={styles.preparationTags}>
              <span>Registration ID</span>
              <span>Keberangkatan</span>
              <span>Kepulangan</span>
            </div>
          </div>
          <nav aria-label="Tahapan informasi perjalanan" className={styles.stepper}>
            {[
              ["01", "Verifikasi Peserta", "step-1"],
              ["02", "Keberangkatan", "step-2"],
              ["03", "Kepulangan", "step-3"],
              ["04", "Akomodasi", "step-4"],
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
                <p className={styles.summaryEyebrow}>Ringkasan kegiatan</p>
                <h2 className={`${styles.displayFont} ${styles.summaryTitle}`}>AKKAI 2026</h2>
                <dl className={styles.summaryList}>
                  <div><dt>Tanggal konferensi</dt><dd>{AKKAI_EVENT.date}</dd></div>
                  <div><dt>Pusat acara &amp; hotel</dt><dd>{AKKAI_EVENT.venue}</dd></div>
                  <div><dt>Agenda utama</dt><dd>Sertifikasi CIAC &amp; Rapat Anggota</dd></div>
                </dl>
              </section>
              <section className={styles.helpCard}>
                <p className={styles.summaryEyebrow}>Meja bantuan logistik</p>
                <h2 className={`${styles.displayFont} ${styles.helpTitle}`}>Butuh bantuan jadwal?</h2>
                <p>Hubungi sekretariat AKKAI bila membutuhkan pendampingan informasi perjalanan.</p>
                <a href="https://wa.me/6281219336779" rel="noreferrer" target="_blank">WhatsApp Panitia</a>
              </section>
              <div className={styles.contextCard}>
                <p className={styles.contextLabel}>Lokasi resmi &amp; akomodasi</p>
                <p className={`${styles.displayFont} ${styles.contextValue}`}>{AKKAI_EVENT.venue}</p>
                <p className={styles.contextCopy}>Seluruh peserta menginap di hotel yang sama. Informasi hotel ini bersifat tetap dan dikoordinasikan oleh panitia.</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
