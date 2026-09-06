import styles from "./landing.module.css";
import { RegistrationLink } from "./registration-link";

const packages = [
  {
    name: "Twin Share",
    price: "Rp6.000.000",
    description: "Akomodasi penginapan bersama peserta lain.",
    items: [
      "Akomodasi",
      "Konsumsi termasuk Welcome Dinner",
      "Pick-up & drop-off bandara/stasiun",
      "Polo shirt",
      "City Tour",
      "Oleh-oleh",
    ],
    featured: false,
  },
  {
    name: "Single",
    price: "Rp7.000.000",
    description: "Akomodasi penginapan privat untuk satu peserta.",
    items: [
      "Akomodasi",
      "Konsumsi termasuk Welcome Dinner",
      "Pick-up & drop-off bandara/stasiun",
      "Polo shirt",
      "City Tour",
      "Oleh-oleh",
    ],
    featured: true,
  },
] as const;

export function PackageSection() {
  return (
    <section className={`${styles.section} ${styles.sectionPaper}`} id="paket">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Informasi Peserta</p>
            <h2 className={styles.sectionTitle}>Paket &amp; Biaya</h2>
          </div>
          <p className={styles.sectionDescription}>
            Untuk Anggota AKKAI
          </p>
        </div>
        <div className={styles.packageGrid}>
          {packages.map((item) => (
            <article
              className={`${styles.packageCard} ${item.featured ? styles.packageCardFeatured : ""}`}
              key={item.name}
            >
              <div>
                <h3 className={styles.packageTitle}>{item.name}</h3>
                <strong className={styles.packagePrice}>{item.price}</strong>
                <p className={styles.packageDescription}>{item.description}</p>
                <ul className={styles.packageList}>
                  {item.items.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </div>
              <RegistrationLink className={styles.secondaryCta} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
