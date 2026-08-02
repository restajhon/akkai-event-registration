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
  getRegistrationFieldErrors,
  MEMBER_CATEGORIES,
  PARTICIPANT_CATEGORIES,
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
  institution: "",
  participant_category: "",
  member_number: "",
  privacy_consent: false,
};

function requiresMemberNumber(category: string) {
  return MEMBER_CATEGORIES.has(category as (typeof PARTICIPANT_CATEGORIES)[number]);
}

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

  const memberNumberVisible = requiresMemberNumber(
    formData.participant_category,
  );
  const errors: RegistrationFieldErrors = {
    ...state.fieldErrors,
    ...clientErrors,
  };
  const submissionMessage = state.generalError;

  function updateField(field: RegistrationField, value: string | boolean) {
    setFormData((current) => {
      const nextData = { ...current, [field]: value } as RegistrationFormValues;

      if (
        field === "participant_category" &&
        !requiresMemberNumber(String(value))
      ) {
        nextData.member_number = "";
      }

      return nextData;
    });

    setClientErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];

      if (
        field === "participant_category" &&
        !requiresMemberNumber(String(value))
      ) {
        delete nextErrors.member_number;
      }

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
        <p className={styles.closedDescription}>
          Informasi selanjutnya akan disampaikan oleh panitia melalui alamat
          email yang didaftarkan.
        </p>
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
          <label className={styles.label} htmlFor="institution">
            Institusi atau cabang <span className={styles.required}>(wajib)</span>
          </label>
          <input
            aria-describedby={
              errors.institution ? "institution-error" : undefined
            }
            aria-invalid={Boolean(errors.institution)}
            className={`${styles.input} ${errors.institution ? styles.inputError : ""}`}
            id="institution"
            name="institution"
            onChange={(event) =>
              updateField("institution", event.target.value)
            }
            placeholder="Masukkan nama institusi atau cabang"
            required
            type="text"
            value={formData.institution}
          />
          {errors.institution ? (
            <ErrorMessage
              id="institution-error"
              message={errors.institution}
            />
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="participant_category">
            Kategori peserta <span className={styles.required}>(wajib)</span>
          </label>
          <select
            aria-describedby={
              errors.participant_category
                ? "participant_category-error"
                : undefined
            }
            aria-invalid={Boolean(errors.participant_category)}
            className={`${styles.select} ${errors.participant_category ? styles.inputError : ""}`}
            id="participant_category"
            name="participant_category"
            onChange={(event) =>
              updateField("participant_category", event.target.value)
            }
            required
            value={formData.participant_category}
          >
            <option value="">Pilih kategori peserta</option>
            {PARTICIPANT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.participant_category ? (
            <ErrorMessage
              id="participant_category-error"
              message={errors.participant_category}
            />
          ) : null}
        </div>

        {memberNumberVisible ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="member_number">
              Nomor anggota AKKAI <span className={styles.required}>(wajib)</span>
            </label>
            <input
              aria-describedby={
                errors.member_number ? "member_number-error" : undefined
              }
              aria-invalid={Boolean(errors.member_number)}
              className={`${styles.input} ${errors.member_number ? styles.inputError : ""}`}
              id="member_number"
              name="member_number"
              onChange={(event) =>
                updateField("member_number", event.target.value)
              }
              placeholder="Contoh: AKKAI-00125"
              required
              type="text"
              value={formData.member_number}
            />
            {errors.member_number ? (
              <ErrorMessage
                id="member_number-error"
                message={errors.member_number}
              />
            ) : null}
          </div>
        ) : null}

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
      </div>

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
