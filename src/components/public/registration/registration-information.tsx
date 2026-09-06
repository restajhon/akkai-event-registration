import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./registration.module.css";

const includedItems = [
  "Akomodasi penginapan",
  "Konsumsi selama kegiatan, termasuk Welcome Dinner",
  "Transportasi pickup dan drop-off Bandara/Stasiun Semarang",
  "Polo shirt",
  "City Tour Semarang",
  "Oleh-oleh khas Semarang",
];

const excludedItems = [
  "Tiket perjalanan dari dan menuju Semarang",
  "Pengeluaran pribadi di luar paket yang telah disediakan",
  "Laundry, minibar, room service, dan pengeluaran pribadi peserta lainnya",
];

function InformationList({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.infoList}>
      {items.map((item) => (
        <li className={styles.infoListItem} key={item}>
          <span aria-hidden="true" className={styles.infoListMark}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function RegistrationInformation() {
  return (
    <section aria-labelledby="registration-information-title" className={styles.information}>
      <div className={styles.informationHeading}>
        <p className={styles.eyebrow}>Informasi Peserta</p>
        <h2 className={`${styles.displayFont} ${styles.informationTitle}`} id="registration-information-title">
          Paket, Pembayaran & Rundown
        </h2>
        <p className={styles.informationDescription}>
          Silakan periksa informasi berikut sebelum melengkapi formulir registrasi.
        </p>
      </div>

      <div className={`${styles.infoGrid} ${styles.packagePaymentGrid}`}>
        <section className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>Paket & Biaya</h3>
          <p className={styles.infoCardIntro}>Untuk Anggota AKKAI</p>
          <div className={styles.packageList}>
            <div className={styles.packageItem}>
              <span>Twin Share</span>
              <strong>Rp6.000.000</strong>
            </div>
            <div className={styles.packageItem}>
              <span>Single</span>
              <strong>Rp7.000.000</strong>
            </div>
          </div>
        </section>

        <section className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>Pembayaran</h3>
          <dl className={styles.paymentDetails}>
            <div>
              <dt>Pembayaran melalui</dt>
              <dd>Bank Mandiri</dd>
            </div>
            <div>
              <dt>No. Rekening</dt>
              <dd className={styles.breakWord}>1570007591903</dd>
            </div>
            <div>
              <dt>Atas Nama</dt>
              <dd>Asosiasi Konsultan Aktuaria Indonesia</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className={styles.deadlineCard}>
        <p className={styles.deadlineLabel}>Batas akhir pendaftaran dan pembayaran</p>
        <p className={`${styles.displayFont} ${styles.deadlineValue}`}>Jumat, 2 Oktober 2026</p>
      </div>

      <section className={styles.proofCard}>
        <h3 className={styles.infoCardTitle}>Bukti Pembayaran</h3>
        <p className={styles.infoCardIntro}>Bukti pembayaran dapat disampaikan melalui:</p>
        <div className={styles.proofLinks}>
          <p><strong>Email:</strong> <a href="mailto:sekretariat@akkai.or.id">sekretariat@akkai.or.id</a></p>
          <p><strong>WhatsApp:</strong> <a href="https://wa.me/6281219336779">+62 812 1933 6779</a></p>
        </div>
      </section>

      <div className={styles.infoGrid}>
        <section className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>Biaya Termasuk</h3>
          <InformationList items={includedItems} />
        </section>
        <section className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>Biaya Tidak Termasuk</h3>
          <InformationList items={excludedItems} />
        </section>
      </div>

      <section className={styles.rundownCard}>
        <div className={styles.rundownHeading}>
          <h3 className={styles.infoCardTitle}>Rundown Peserta</h3>
          <p className={styles.infoCardIntro}>Rangkaian kegiatan {AKKAI_EVENT.shortName}.</p>
        </div>
        <div className={styles.rundownList}>
          {AKKAI_EVENT.participantRundown.map((day) => (
            <details className={styles.rundownDay} key={day.day} open={day.day === "Day 1"}>
              <summary className={styles.rundownSummary}>
                <span>
                  <strong>{day.day}</strong>
                  <span>{day.date}</span>
                </span>
                <span aria-hidden="true">+</span>
              </summary>
              <ul className={styles.rundownItems}>
                {day.items.map((item) => (
                  <li className={styles.rundownItem} key={`${day.day}-${item.time}-${item.title}`}>
                    <span>{item.time}</span>
                    <span>{item.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </section>
  );
}
