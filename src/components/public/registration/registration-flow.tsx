"use client";

import { useState } from "react";

import { CollectiveRegistrationForm } from "./collective-registration-form";
import { RegistrationForm } from "./registration-form";
import styles from "./registration.module.css";

export function RegistrationFlow() {
  const [mode, setMode] = useState<"single" | "collective" | null>(null);

  if (mode === "single") {
    return (
      <div>
        <button className={styles.modeBack} onClick={() => setMode(null)} type="button">&larr; Ubah jenis pendaftaran</button>
        <RegistrationForm />
      </div>
    );
  }

  if (mode === "collective") {
    return (
      <div>
        <button className={styles.modeBack} onClick={() => setMode(null)} type="button">&larr; Ubah jenis pendaftaran</button>
        <CollectiveRegistrationForm />
      </div>
    );
  }

  return (
    <section aria-labelledby="registration-mode-heading" className={styles.modeChooser}>
      <p className={styles.sectionKicker}>Mulai pendaftaran</p>
      <h2 className={styles.sectionTitle} id="registration-mode-heading">Pilih cara pendaftaran</h2>
      <p className={styles.introDescription}>Gunakan pendaftaran satu peserta untuk mengikuti flow lama, atau daftarkan beberapa peserta dengan kartu terpisah.</p>
      <div className={styles.modeOptions}>
        <button className={styles.modeCard} onClick={() => setMode("single")} type="button">
          <span className={styles.modeNumber}>01</span>
          <strong>Daftar Satu Peserta</strong>
          <span>Flow registrasi existing, dengan satu registration ID, QR, dan tagihan.</span>
        </button>
        <button className={styles.modeCard} onClick={() => setMode("collective")} type="button">
          <span className={styles.modeNumber}>02</span>
          <strong>Daftarkan Beberapa Peserta</strong>
          <span>Tambahkan kartu peserta dan proses setiap peserta secara independen dalam satu batch.</span>
        </button>
      </div>
    </section>
  );
}
