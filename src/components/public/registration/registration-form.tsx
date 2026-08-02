"use client";

import { useEffect, useRef, useState } from "react";

import { AKKAI_EVENT, IMPORTANT_INFO } from "@/lib/akkai-event";

import styles from "./registration.module.css";

type FormData = {
  full_name: string;
  email: string;
  phone_number: string;
  institution: string;
  participant_category: string;
  member_number: string;
  privacy_consent: boolean;
};

type FieldName = keyof FormData;
type FieldErrors = Partial<Record<FieldName, string>>;
type SubmissionState =
  | "idle"
  | "loading"
  | "general-error"
  | "duplicate-email"
  | "duplicate-member-number";

const PARTICIPANT_CATEGORIES = [
  "Anggota AKKAI",
  "Pengurus AKKAI",
  "Narasumber",
  "Tamu Undangan",
  "Panitia",
  "Lainnya",
] as const;

const MEMBER_CATEGORIES = new Set(["Anggota AKKAI", "Pengurus AKKAI"]);

const submissionMessages: Partial<Record<SubmissionState, string>> = {
  "general-error":
    "Terjadi kendala saat memproses pendaftaran. Silakan coba kembali.",
  "duplicate-email":
    "Email ini sudah terdaftar. Silakan cek email konfirmasi sebelumnya atau hubungi panitia.",
  "duplicate-member-number":
    "Nomor anggota ini sudah terdaftar. Silakan cek kembali data Anda atau hubungi panitia.",
};

const initialFormData: FormData = {
  full_name: "",
  email: "",
  phone_number: "",
  institution: "",
  participant_category: "",
  member_number: "",
  privacy_consent: false,
};

function requiresMemberNumber(category: string) {
  return MEMBER_CATEGORIES.has(category);
}

function validateForm(data: FormData): FieldErrors {
  const nextErrors: FieldErrors = {};

  if (!data.full_name.trim()) {
    nextErrors.full_name = "Nama lengkap wajib diisi.";
  }

  if (!data.email.trim()) {
    nextErrors.email = "Email wajib diisi.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    nextErrors.email = "Format email belum sesuai.";
  }

  if (!data.phone_number.trim()) {
    nextErrors.phone_number = "Nomor WhatsApp wajib diisi.";
  }

  if (!data.institution.trim()) {
    nextErrors.institution = "Institusi atau cabang wajib diisi.";
  }

  if (!data.participant_category) {
    nextErrors.participant_category = "Pilih kategori peserta.";
  }

  if (
    requiresMemberNumber(data.participant_category) &&
    !data.member_number.trim()
  ) {
    nextErrors.member_number = "Nomor anggota wajib diisi.";
  }

  if (!data.privacy_consent) {
    nextErrors.privacy_consent =
      "Persetujuan penggunaan data wajib diberikan.";
  }

  return nextErrors;
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
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = submissionState === "loading";
  const submissionMessage = submissionMessages[submissionState];
  const memberNumberVisible = requiresMemberNumber(
    formData.participant_category,
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function updateField(field: FieldName, value: string | boolean) {
    setFormData((current) => {
      const nextData = { ...current, [field]: value } as FormData;

      if (
        field === "participant_category" &&
        !requiresMemberNumber(String(value))
      ) {
        nextData.member_number = "";
      }

      return nextData;
    });

    setErrors((current) => {
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

    setSubmissionState((current) =>
      current === "loading" ? current : "idle",
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const nextErrors = validateForm(formData);
    setErrors(nextErrors);
    setSubmissionState("idle");

    const firstInvalidField = Object.keys(nextErrors)[0] as
      | FieldName
      | undefined;

    if (firstInvalidField) {
      window.requestAnimationFrame(() => {
        document.getElementById(firstInvalidField)?.focus();
      });
      return;
    }

    setSubmissionState("loading");
    timeoutRef.current = setTimeout(() => {
      setSubmissionState("idle");
      timeoutRef.current = null;
    }, 1200);
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
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
              Kode QR dan konfirmasi registrasi akan dikirim ke email ini.
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
        <button className={styles.submitButton} disabled={isLoading} type="submit">
          {isLoading ? "Mengirim Pendaftaran..." : "Kirim Pendaftaran"}
        </button>
        <p className={styles.submitHint}>
          Pastikan seluruh data sudah benar sebelum mengirimkan formulir.
        </p>
      </div>
    </form>
  );
}
