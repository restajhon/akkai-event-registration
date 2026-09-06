import styles from "./landing.module.css";

const packages = [
  {
    name: "Twin Share",
    label: "Kategori standar",
    price: "Rp6.000.000",
    description: "Akomodasi bersama satu rekan sesama konsultan aktuaria di Hotel Gumaya.",
    items: ["Akomodasi penginapan", "Konsumsi selama kegiatan", "City Tour Semarang"],
    featured: false,
  },
  {
    name: "Single",
    label: "Kategori single",
    price: "Rp7.000.000",
    description: "Akomodasi privat satu orang penuh per kamar di Hotel Gumaya Semarang.",
    items: ["Kamar privat", "Konsumsi selama kegiatan", "City Tour Semarang"],
    featured: true,
  },
] as const;

export function PackageSection() {
  return (
    <section className={`${styles.section} ${styles.sectionPaper}`} id="paket">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Opsi Kepesertaan</p>
            <h2 className={styles.sectionTitle}>Paket &amp; Investasi</h2>
          </div>
          <p className={styles.sectionDescription}>
            Pilihan akomodasi dan fasilitas komprehensif bagi anggota konsultan
            aktuaria terdaftar.
          </p>
        </div>
        <div className={styles.packageGrid}>
          {packages.map((item) => (
            <article
              className={`${styles.packageCard} ${item.featured ? styles.packageCardFeatured : ""}`}
              key={item.name}
            >
              <div>
                <span className={styles.packageEyebrow}>{item.label}</span>
                <h3 className={styles.packageTitle}>{item.name}</h3>
                <p className={styles.packageDescription}>{item.description}</p>
                <strong className={styles.packagePrice}>{item.price}</strong>
                <ul className={styles.packageList}>
                  {item.items.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
              <span className={styles.secondaryCta}>Tersedia di formulir registrasi</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
