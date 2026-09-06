"use client";

import { useActionState, useState, type FormEvent } from "react";

import {
  submitRegistration,
} from "@/app/register/actions";
import { AKKAI_EVENT, IMPORTANT_INFO } from "@/lib/akkai-event";
import {
  initialRegistrationState,
  type RegistrationActionState,
} from "@/lib/registration/registration-action-state";
import {
  ACTUARIAL_CONSULTANT_STATUSES,
  getRegistrationFieldErrors,
  PACKAGE_TYPES,
  PARTICIPATION_SCOPES,
  PAI_CONGRESS_OPTIONS,
  POLO_MODELS,
  POLO_SIZES,
  registrationSchema,
  type RegistrationField,
  type RegistrationFieldErrors,
  type RegistrationFormValues,
} from "@/lib/validation/registration";

import styles from "./registration.module.css";

const initialFormData: RegistrationFormValues = {
  full_name: "",
  email: "",
  phone_number: "",
  kka_name: "",
  polo_size: "",
  polo_model: "",
  package_type: "",
  participation_scope: "",
  actuarial_consultant_status: "",
  attends_pai_congress: "",
  privacy_consent: false,
};

const packageDetails = {
  "Twin Share": {
    description: "Akomodasi penginapan bersama peserta lain.",
    price: "Rp6.000.000",
    benefits: [
      "Akomodasi",
      "Konsumsi termasuk Welcome Dinner",
      "Pick-up & drop-off bandara/stasiun",
      "Polo shirt",
      "City Tour",
      "Oleh-oleh",
    ],
  },
  Single: {
    description: "Akomodasi penginapan privat untuk satu peserta.",
    price: "Rp7.000.000",
    benefits: [
      "Akomodasi",
      "Konsumsi termasuk Welcome Dinner",
      "Pick-up & drop-off bandara/stasiun",
      "Polo shirt",
      "City Tour",
      "Oleh-oleh",
    ],
  },
} as const;

function ErrorMessage({ id, message }: { id: string; message: string }) {
  return (
    <p className={styles.errorMessage} id={id} role="alert">
      <span aria-hidden="true" className={styles.errorMark}>
        !
      </span>
      <span>Error: {message}</span>
    </p>
  );
}

export function RegistrationForm() {
  const [state, formAction, isPending] = useActionState<
    RegistrationActionState,
    FormData
  >(
    submitRegistration,
    initialRegistrationState,
  );
  const [formData, setFormData] = useState<RegistrationFormValues>(
    initialFormData,
  );
  const [clientErrors, setClientErrors] =
    useState<RegistrationFieldErrors>({});

  const errors: RegistrationFieldErrors = {
    ...state.fieldErrors,
    ...clientErrors,
  };
  const submissionMessage = state.generalError;

  function updateField(field: RegistrationField, value: string | boolean) {
    setFormData((current) => {
      const nextData = { ...current, [field]: value } as RegistrationFormValues;

      return nextData;
    });

    setClientErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];

      return nextErrors;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault();
      return;
    }

    const result = registrationSchema.safeParse(formData);
    const nextErrors = result.success
      ? {}
      : getRegistrationFieldErrors(result.error);

    setClientErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0] as
      | RegistrationField
      | undefined;

    if (firstInvalidField) {
      event.preventDefault();
      window.requestAnimationFrame(() => {
        document.getElementById(firstInvalidField)?.focus();
      });
    }
  }

  if (state.status === "submitted") {
    const emailWasAccepted = state.emailDelivery === "accepted";

    return (
      <section
        aria-live="polite"
        className={styles.closedCard}
        role="status"
      >
        <p className={styles.eyebrow}>Registrasi Peserta</p>
        <h1 className={`${styles.displayFont} ${styles.closedTitle}`}>
          Pendaftaran Berhasil
        </h1>
        <p className={styles.closedDescription}>
          Data registrasi Anda telah berhasil disimpan.
        </p>
        {state.registrationId ? (
          <p className={styles.eventValue}>
            Nomor Registrasi: {state.registrationId}
          </p>
        ) : null}
        {emailWasAccepted ? (
          <p className={styles.closedDescription}>
            Layanan pengiriman telah menerima email konfirmasi dan kode QR untuk
            alamat yang didaftarkan.
          </p>
        ) : (
          <p className={styles.closedDescription}>
            Email konfirmasi belum dapat diterima oleh layanan pengiriman. Data
            registrasi tetap tersimpan. Simpan nomor registrasi Anda dan
            hubungi panitia.
          </p>
        )}
        {state.emailStatusSyncPending ? (
          <p className={styles.closedDescription}>
            Status internal pengiriman belum dapat diperbarui. Jangan mengirim
            ulang melalui formulir; hubungi panitia bila email belum terlihat.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className={styles.form}
      noValidate
      onSubmit={handleSubmit}
    >
      {submissionMessage ? (
        <div className={styles.generalAlert} role="alert">
          <span aria-hidden="true" className={styles.alertMark}>
            !
          </span>
          <span>{submissionMessage}</span>
        </div>
      ) : null}

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>01</span>
          <div>
            <p className={styles.sectionKicker}>Identitas peserta</p>
            <h2 className={styles.sectionTitle}>Data Diri &amp; Kontak</h2>
          </div>
        </div>
        <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="full_name">
            Nama lengkap <span className={styles.required}>(wajib)</span>
          </label>
          <input
            aria-describedby={
              errors.full_name ? "full_name-error" : "full_name-helper"
            }
            aria-invalid={Boolean(errors.full_name)}
            autoComplete="name"
            className={`${styles.input} ${errors.full_name ? styles.inputError : ""}`}
            id="full_name"
            name="full_name"
            onChange={(event) => updateField("full_name", event.target.value)}
            placeholder="Masukkan nama lengkap sesuai identitas"
            required
            type="text"
            value={formData.full_name}
          />
          {errors.full_name ? (
            <ErrorMessage id="full_name-error" message={errors.full_name} />
          ) : (
            <p className={styles.helper} id="full_name-helper">
              Nama akan ditampilkan pada data registrasi peserta.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Alamat email <span className={styles.required}>(wajib)</span>
          </label>
          <input
            aria-describedby={errors.email ? "email-error" : "email-helper"}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
            id="email"
            name="email"
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="nama@email.com"
            required
            type="email"
            value={formData.email}
          />
          {errors.email ? (
            <ErrorMessage id="email-error" message={errors.email} />
          ) : (
            <p className={styles.helper} id="email-helper">
              Gunakan alamat email aktif untuk komunikasi panitia.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone_number">
            Nomor WhatsApp <span className={styles.required}>(wajib)</span>
          </label>
          <input
            aria-describedby={
              errors.phone_number
                ? "phone_number-error"
                : "phone_number-helper"
            }
            aria-invalid={Boolean(errors.phone_number)}
            autoComplete="tel"
            className={`${styles.input} ${errors.phone_number ? styles.inputError : ""}`}
            id="phone_number"
            inputMode="tel"
            name="phone_number"
            onChange={(event) =>
              updateField("phone_number", event.target.value)
            }
            placeholder="Contoh: 081234567890"
            required
            type="tel"
            value={formData.phone_number}
          />
          {errors.phone_number ? (
            <ErrorMessage
              id="phone_number-error"
              message={errors.phone_number}
            />
          ) : (
            <p className={styles.helper} id="phone_number-helper">
              Gunakan nomor WhatsApp yang aktif.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="kka_name">
            Nama KKA <span className={styles.required}>(wajib)</span>
          </label>
          <input
            aria-describedby={
              errors.kka_name ? "kka_name-error" : undefined
            }
            aria-invalid={Boolean(errors.kka_name)}
            className={`${styles.input} ${errors.kka_name ? styles.inputError : ""}`}
            id="kka_name"
            maxLength={150}
            name="kka_name"
            onChange={(event) =>
              updateField("kka_name", event.target.value)
            }
            placeholder="Masukkan nama KKA"
            required
            type="text"
            value={formData.kka_name}
          />
          {errors.kka_name ? (
            <ErrorMessage
              id="kka_name-error"
              message={errors.kka_name}
            />
          ) : null}
        </div>

        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>02</span>
          <div>
            <p className={styles.sectionKicker}>Akomodasi kegiatan</p>
            <h2 className={styles.sectionTitle}>Paket yang Diambil</h2>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.visuallyHidden} htmlFor="package_type">
            Paket yang diambil <span className={styles.required}>(wajib)</span>
          </label>
          <div aria-label="Pilihan paket" className={styles.packageOptions} role="group">
            {PACKAGE_TYPES.map((packageType) => {
              const details = packageDetails[packageType];
              const selected = formData.package_type === packageType;

              return (
                <button
                  aria-pressed={selected}
                  className={`${styles.packageCard} ${selected ? styles.packageCardSelected : ""}`}
                  key={packageType}
                  onClick={() => updateField("package_type", packageType)}
                  type="button"
                >
                  <span className={styles.packageCardHeader}>
                    <span className={styles.packageCardName}>{packageType}</span>
                    <span aria-hidden="true" className={styles.packageCardCheck}>✓</span>
                  </span>
                  <span className={styles.packageCardPriceRow}>
                    <strong className={styles.packageCardPrice}>{details.price}</strong>
                    <span className={styles.packageCardUnit}>per peserta</span>
                  </span>
                  <span className={styles.packageCardDescription}>{details.description}</span>
                  <span className={styles.packageCardIncludes}>Termasuk:</span>
                  <span className={styles.packageCardList}>
                    {details.benefits.map((benefit) => (
                      <span key={benefit}>✓ {benefit}</span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <select
            aria-describedby={errors.package_type ? "package_type-error" : undefined}
            aria-invalid={Boolean(errors.package_type)}
            className={styles.visuallyHiddenControl}
            id="package_type"
            name="package_type"
            onChange={(event) => updateField("package_type", event.target.value)}
            required
            tabIndex={-1}
            value={formData.package_type}
          >
            <option value="">Pilih paket</option>
            {PACKAGE_TYPES.map((packageType) => (
              <option key={packageType} value={packageType}>{packageType}</option>
            ))}
          </select>
          {errors.package_type ? (
            <ErrorMessage id="package_type-error" message={errors.package_type} />
          ) : null}
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>03</span>
          <div>
            <p className={styles.sectionKicker}>Pilihan Peserta</p>
            <h2 className={styles.sectionTitle}>Pilihan Poloshirt</h2>
          </div>
        </div>
        <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="polo_size">
            Ukuran Poloshirt <span className={styles.required}>(wajib)</span>
          </label>
          <select
            aria-describedby={errors.polo_size ? "polo_size-error" : undefined}
            aria-invalid={Boolean(errors.polo_size)}
            className={`${styles.select} ${errors.polo_size ? styles.inputError : ""}`}
            id="polo_size"
            name="polo_size"
            onChange={(event) => updateField("polo_size", event.target.value)}
            required
            value={formData.polo_size}
          >
            <option value="">Pilih ukuran</option>
            {POLO_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          {errors.polo_size ? (
            <ErrorMessage id="polo_size-error" message={errors.polo_size} />
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="polo_model">
            Model Poloshirt <span className={styles.required}>(wajib)</span>
          </label>
          <select
            aria-describedby={errors.polo_model ? "polo_model-error" : undefined}
            aria-invalid={Boolean(errors.polo_model)}
            className={`${styles.select} ${errors.polo_model ? styles.inputError : ""}`}
            id="polo_model"
            name="polo_model"
            onChange={(event) => updateField("polo_model", event.target.value)}
            required
            value={formData.polo_model}
          >
            <option value="">Pilih model</option>
            {POLO_MODELS.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          {errors.polo_model ? (
            <ErrorMessage id="polo_model-error" message={errors.polo_model} />
          ) : null}
        </div>

        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>04</span>
          <div>
            <p className={styles.sectionKicker}>Status kepesertaan</p>
            <h2 className={styles.sectionTitle}>Informasi Profesi &amp; Kehadiran</h2>
          </div>
        </div>
        <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="participation_scope">
            Mengikuti <span className={styles.required}>(wajib)</span>
          </label>
          <select
            aria-describedby={
              errors.participation_scope ? "participation_scope-error" : undefined
            }
            aria-invalid={Boolean(errors.participation_scope)}
            className={`${styles.select} ${errors.participation_scope ? styles.inputError : ""}`}
            id="participation_scope"
            name="participation_scope"
            onChange={(event) => updateField("participation_scope", event.target.value)}
            required
            value={formData.participation_scope}
          >
            <option value="">Pilih keikutsertaan</option>
            {PARTICIPATION_SCOPES.map((scope) => (
              <option key={scope} value={scope}>{scope}</option>
            ))}
          </select>
          {errors.participation_scope ? (
            <ErrorMessage
              id="participation_scope-error"
              message={errors.participation_scope}
            />
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="actuarial_consultant_status">
            Konsultan Aktuaria <span className={styles.required}>(wajib)</span>
          </label>
          <select
            aria-describedby={
              errors.actuarial_consultant_status
                ? "actuarial_consultant_status-error"
                : undefined
            }
            aria-invalid={Boolean(errors.actuarial_consultant_status)}
            className={`${styles.select} ${errors.actuarial_consultant_status ? styles.inputError : ""}`}
            id="actuarial_consultant_status"
            name="actuarial_consultant_status"
            onChange={(event) =>
              updateField("actuarial_consultant_status", event.target.value)
            }
            required
            value={formData.actuarial_consultant_status}
          >
            <option value="">Pilih status</option>
            {ACTUARIAL_CONSULTANT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {errors.actuarial_consultant_status ? (
            <ErrorMessage
              id="actuarial_consultant_status-error"
              message={errors.actuarial_consultant_status}
            />
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="attends_pai_congress">
            Hadir Kongres PAI <span className={styles.required}>(wajib)</span>
          </label>
          <select
            aria-describedby={
              errors.attends_pai_congress ? "attends_pai_congress-error" : undefined
            }
            aria-invalid={Boolean(errors.attends_pai_congress)}
            className={`${styles.select} ${errors.attends_pai_congress ? styles.inputError : ""}`}
            id="attends_pai_congress"
            name="attends_pai_congress"
            onChange={(event) => updateField("attends_pai_congress", event.target.value)}
            required
            value={formData.attends_pai_congress}
          >
            <option value="">Pilih jawaban</option>
            {PAI_CONGRESS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option === "true" ? "Ya" : "Tidak"}</option>
            ))}
          </select>
          {errors.attends_pai_congress ? (
            <ErrorMessage
              id="attends_pai_congress-error"
              message={errors.attends_pai_congress}
            />
          ) : null}
        </div>

        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>05</span>
          <div>
            <p className={styles.sectionKicker}>Konfirmasi akhir</p>
            <h2 className={styles.sectionTitle}>Persetujuan &amp; Kebijakan Data</h2>
          </div>
        </div>
        <div className={styles.consentField}>
          <div className={styles.consentRow}>
            <input
              aria-describedby={
                errors.privacy_consent ? "privacy_consent-error" : undefined
              }
              aria-invalid={Boolean(errors.privacy_consent)}
              checked={formData.privacy_consent}
              className={styles.checkbox}
              id="privacy_consent"
              name="privacy_consent"
              onChange={(event) =>
                updateField("privacy_consent", event.target.checked)
              }
              required
              type="checkbox"
              value="true"
            />
            <label className={styles.consentLabel} htmlFor="privacy_consent">
              Dengan mengirimkan formulir ini, saya menyetujui penggunaan data
              untuk keperluan registrasi, komunikasi, dan administrasi{" "}
              {AKKAI_EVENT.name}. <span className={styles.required}>(wajib)</span>
            </label>
          </div>
          {errors.privacy_consent ? (
            <ErrorMessage
              id="privacy_consent-error"
              message={errors.privacy_consent}
            />
          ) : null}
        </div>
      </section>

      <aside className={styles.notice}>
        <h2 className={`${styles.displayFont} ${styles.noticeTitle}`}>
          Informasi Penting Registrasi
        </h2>
        <ul className={styles.noticeList}>
          {IMPORTANT_INFO.map((info) => (
            <li className={styles.noticeItem} key={info}>
              <span aria-hidden="true" className={styles.noticeMark}>
                &bull;
              </span>
              <span>{info}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className={styles.submitArea}>
        <button
          className={styles.submitButton}
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Mengirim Pendaftaran..." : "Kirim Pendaftaran"}
        </button>
        <p className={styles.submitHint}>
          Pastikan seluruh data sudah benar sebelum mengirimkan formulir.
        </p>
      </div>
    </form>
  );
}
