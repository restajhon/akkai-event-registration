"use client";

import { useState } from "react";

import type { PublishedEventForm } from "@/lib/tenant/public-events";
import { supportsAkkaiParticipantWorkflow } from "@/lib/forms/form-schema";

import { CollectiveRegistrationForm } from "./collective-registration-form";
import { PublishedRegistrationForm } from "./published-registration-form";
import styles from "./registration.module.css";

export function RegistrationFlow({ publishedForm }: { publishedForm: PublishedEventForm }) {
  const [mode, setMode] = useState<"single" | "collective" | null>(null);
  if (publishedForm.eventSlug !== "akkai-2026" || !supportsAkkaiParticipantWorkflow(publishedForm.config)) {
    return <PublishedRegistrationForm publishedForm={publishedForm} />;
  }

  if (mode === "single") {
    return (
      <div>
        <button className={styles.modeBack} onClick={() => setMode(null)} type="button">&larr; Ubah jenis pendaftaran</button>
        <PublishedRegistrationForm publishedForm={publishedForm} />
      </div>
    );
  }

  if (mode === "collective") {
    return (
      <div>
        <button className={styles.modeBack} onClick={() => setMode(null)} type="button">&larr; Ubah jenis pendaftaran</button>
        <CollectiveRegistrationForm publishedForm={publishedForm} />
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
