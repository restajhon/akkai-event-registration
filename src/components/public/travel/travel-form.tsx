"use client";

import { useActionState, useState, type FormEvent } from "react";

import { submitTravel } from "@/app/travel/actions";
import {
  initialTravelActionState,
  type TravelActionState,
} from "@/lib/travel/travel-action-state";
import {
  getTravelFieldErrors,
  travelSchema,
  type TravelField,
  type TravelFieldErrors,
  type TravelFormValues,
} from "@/lib/validation/travel";

import styles from "./travel.module.css";

const initialFormData: TravelFormValues = {
  registration_id: "",
  registered_email: "",
  outbound_date: "",
  outbound_time: "",
  outbound_transport_mode: "",
  outbound_transport_number: "",
  outbound_origin: "",
  outbound_destination: "",
  return_date: "",
  return_time: "",
  return_transport_mode: "",
  return_transport_number: "",
  return_destination: "",
  extend_stay: undefined,
};

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p className={styles.errorMessage} id={id} role="alert">
      <span aria-hidden="true" className={styles.errorMark}>
        !
      </span>
      <span>{message}</span>
    </p>
  );
}

function FieldLabel({
  children,
  htmlFor,
  optional = false,
}: {
  children: React.ReactNode;
  htmlFor: string;
  optional?: boolean;
}) {
  return (
    <label className={styles.label} htmlFor={htmlFor}>
      {children}{" "}
      <span className={styles.required}>
        ({optional ? "opsional" : "wajib"})
      </span>
    </label>
  );
}

export function TravelForm() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [state, formAction, isPending] = useActionState<
    TravelActionState,
    FormData
  >(async (previousState, formData) => {
    const nextState = await submitTravel(previousState, formData);

    if (nextState.status === "saved") {
      setShowSuccess(true);
    }

    return nextState;
  }, initialTravelActionState);
  const [formData, setFormData] = useState<TravelFormValues>(initialFormData);
  const [clientErrors, setClientErrors] = useState<TravelFieldErrors>({});

  const errors: TravelFieldErrors = {
    ...state.fieldErrors,
    ...clientErrors,
  };

  function updateField(field: TravelField, value: string | boolean) {
    setFormData((current) => ({ ...current, [field]: value }));
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

    const result = travelSchema.safeParse(formData);
    const nextErrors = result.success ? {} : getTravelFieldErrors(result.error);
    setClientErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0] as
      | TravelField
      | undefined;

    if (firstInvalidField) {
      event.preventDefault();
      window.requestAnimationFrame(() => {
        document.getElementById(firstInvalidField)?.focus();
      });
    }
  }

  if (state.status === "saved" && showSuccess) {
    return (
      <section aria-live="polite" className={styles.successCard} role="status">
        <p className={styles.eyebrow}>Informasi Perjalanan</p>
        <h2 className={`${styles.displayFont} ${styles.successTitle}`}>
          Informasi perjalanan berhasil disimpan.
        </h2>
        <p className={styles.successCopy}>
          Data Anda dapat diperbarui kembali kapan saja melalui halaman ini.
        </p>
        <button
          className={styles.secondaryButton}
          onClick={() => setShowSuccess(false)}
          type="button"
        >
          Perbarui Informasi Perjalanan
        </button>
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
      {state.generalError ? (
        <div className={styles.generalAlert} role="alert">
          <span aria-hidden="true" className={styles.alertMark}>
            !
          </span>
          <span>{state.generalError}</span>
        </div>
      ) : null}

      <section className={styles.formSection} id="step-1">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>01</span>
          <div>
            <p className={styles.sectionKicker}>Langkah pertama</p>
            <h2 className={`${styles.displayFont} ${styles.sectionTitle}`}>
              Verifikasi Peserta
            </h2>
          </div>
        </div>
        <p className={styles.sectionDescription}>
          Gunakan Registration ID dan email yang sama dengan data registrasi
          Anda.
        </p>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <FieldLabel htmlFor="registration_id">Registration ID</FieldLabel>
            <input
              aria-describedby={
                errors.registration_id ? "registration_id-error" : undefined
              }
              aria-invalid={Boolean(errors.registration_id)}
              autoComplete="off"
              className={`${styles.input} ${errors.registration_id ? styles.inputError : ""}`}
              id="registration_id"
              name="registration_id"
              onChange={(event) =>
                updateField("registration_id", event.target.value)
              }
              placeholder="Contoh: AKKAI26-000001"
              required
              type="text"
              value={formData.registration_id}
            />
            {errors.registration_id ? (
              <FieldError
                id="registration_id-error"
                message={errors.registration_id}
              />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="registered_email">Email Terdaftar</FieldLabel>
            <input
              aria-describedby={
                errors.registered_email ? "registered_email-error" : undefined
              }
              aria-invalid={Boolean(errors.registered_email)}
              autoComplete="email"
              className={`${styles.input} ${errors.registered_email ? styles.inputError : ""}`}
              id="registered_email"
              name="registered_email"
              onChange={(event) =>
                updateField("registered_email", event.target.value)
              }
              placeholder="nama@email.com"
              required
              type="email"
              value={formData.registered_email}
            />
            {errors.registered_email ? (
              <FieldError
                id="registered_email-error"
                message={errors.registered_email}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.formSection} id="step-2">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>02</span>
          <div>
            <p className={styles.sectionKicker}>Perjalanan menuju Semarang</p>
            <h2 className={`${styles.displayFont} ${styles.sectionTitle}`}>
              Keberangkatan
            </h2>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <FieldLabel htmlFor="outbound_date">
              Tanggal Keberangkatan
            </FieldLabel>
            <input
              aria-describedby={
                errors.outbound_date ? "outbound_date-error" : undefined
              }
              aria-invalid={Boolean(errors.outbound_date)}
              className={`${styles.input} ${errors.outbound_date ? styles.inputError : ""}`}
              id="outbound_date"
              name="outbound_date"
              onChange={(event) =>
                updateField("outbound_date", event.target.value)
              }
              required
              type="date"
              value={formData.outbound_date}
            />
            {errors.outbound_date ? (
              <FieldError id="outbound_date-error" message={errors.outbound_date} />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="outbound_time">Waktu Kedatangan</FieldLabel>
            <input
              aria-describedby={
                errors.outbound_time ? "outbound_time-error" : undefined
              }
              aria-invalid={Boolean(errors.outbound_time)}
              className={`${styles.input} ${errors.outbound_time ? styles.inputError : ""}`}
              id="outbound_time"
              name="outbound_time"
              onChange={(event) =>
                updateField("outbound_time", event.target.value)
              }
              required
              type="time"
              value={formData.outbound_time}
            />
            {errors.outbound_time ? (
              <FieldError id="outbound_time-error" message={errors.outbound_time} />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="outbound_transport_mode">
              Moda Transportasi
            </FieldLabel>
            <input
              aria-describedby={
                errors.outbound_transport_mode
                  ? "outbound_transport_mode-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.outbound_transport_mode)}
              className={`${styles.input} ${errors.outbound_transport_mode ? styles.inputError : ""}`}
              id="outbound_transport_mode"
              maxLength={50}
              name="outbound_transport_mode"
              onChange={(event) =>
                updateField("outbound_transport_mode", event.target.value)
              }
              placeholder="Contoh: Kereta api"
              required
              type="text"
              value={formData.outbound_transport_mode}
            />
            {errors.outbound_transport_mode ? (
              <FieldError
                id="outbound_transport_mode-error"
                message={errors.outbound_transport_mode}
              />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="outbound_transport_number" optional>
              Nomor Penerbangan / Kereta
            </FieldLabel>
            <input
              aria-describedby={
                errors.outbound_transport_number
                  ? "outbound_transport_number-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.outbound_transport_number)}
              className={`${styles.input} ${errors.outbound_transport_number ? styles.inputError : ""}`}
              id="outbound_transport_number"
              maxLength={100}
              name="outbound_transport_number"
              onChange={(event) =>
                updateField("outbound_transport_number", event.target.value)
              }
              placeholder="Boleh dikosongkan"
              type="text"
              value={formData.outbound_transport_number}
            />
            {errors.outbound_transport_number ? (
              <FieldError
                id="outbound_transport_number-error"
                message={errors.outbound_transport_number}
              />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="outbound_origin">Asal Keberangkatan</FieldLabel>
            <input
              aria-describedby={
                errors.outbound_origin ? "outbound_origin-error" : undefined
              }
              aria-invalid={Boolean(errors.outbound_origin)}
              className={`${styles.input} ${errors.outbound_origin ? styles.inputError : ""}`}
              id="outbound_origin"
              maxLength={150}
              name="outbound_origin"
              onChange={(event) =>
                updateField("outbound_origin", event.target.value)
              }
              placeholder="Kota atau lokasi asal"
              required
              type="text"
              value={formData.outbound_origin}
            />
            {errors.outbound_origin ? (
              <FieldError
                id="outbound_origin-error"
                message={errors.outbound_origin}
              />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="outbound_destination">
              Stasiun/Bandara Kedatangan
            </FieldLabel>
            <input
              aria-describedby={
                errors.outbound_destination
                  ? "outbound_destination-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.outbound_destination)}
              className={`${styles.input} ${errors.outbound_destination ? styles.inputError : ""}`}
              id="outbound_destination"
              maxLength={150}
              name="outbound_destination"
              onChange={(event) =>
                updateField("outbound_destination", event.target.value)
              }
              placeholder="Contoh: Stasiun Tawang Semarang"
              required
              type="text"
              value={formData.outbound_destination}
            />
            {errors.outbound_destination ? (
              <FieldError
                id="outbound_destination-error"
                message={errors.outbound_destination}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.formSection} id="step-3">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>03</span>
          <div>
            <p className={styles.sectionKicker}>Perjalanan setelah acara</p>
            <h2 className={`${styles.displayFont} ${styles.sectionTitle}`}>
              Kepulangan
            </h2>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <FieldLabel htmlFor="return_date">Tanggal Kepulangan</FieldLabel>
            <input
              aria-describedby={
                errors.return_date ? "return_date-error" : undefined
              }
              aria-invalid={Boolean(errors.return_date)}
              className={`${styles.input} ${errors.return_date ? styles.inputError : ""}`}
              id="return_date"
              name="return_date"
              onChange={(event) => updateField("return_date", event.target.value)}
              required
              type="date"
              value={formData.return_date}
            />
            {errors.return_date ? (
              <FieldError id="return_date-error" message={errors.return_date} />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="return_time">Waktu Kepulangan</FieldLabel>
            <input
              aria-describedby={
                errors.return_time ? "return_time-error" : undefined
              }
              aria-invalid={Boolean(errors.return_time)}
              className={`${styles.input} ${errors.return_time ? styles.inputError : ""}`}
              id="return_time"
              name="return_time"
              onChange={(event) => updateField("return_time", event.target.value)}
              required
              type="time"
              value={formData.return_time}
            />
            {errors.return_time ? (
              <FieldError id="return_time-error" message={errors.return_time} />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="return_transport_mode">
              Moda Transportasi
            </FieldLabel>
            <input
              aria-describedby={
                errors.return_transport_mode
                  ? "return_transport_mode-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.return_transport_mode)}
              className={`${styles.input} ${errors.return_transport_mode ? styles.inputError : ""}`}
              id="return_transport_mode"
              maxLength={50}
              name="return_transport_mode"
              onChange={(event) =>
                updateField("return_transport_mode", event.target.value)
              }
              placeholder="Contoh: Pesawat"
              required
              type="text"
              value={formData.return_transport_mode}
            />
            {errors.return_transport_mode ? (
              <FieldError
                id="return_transport_mode-error"
                message={errors.return_transport_mode}
              />
            ) : null}
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="return_transport_number" optional>
              Nomor Penerbangan / Kereta
            </FieldLabel>
            <input
              aria-describedby={
                errors.return_transport_number
                  ? "return_transport_number-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.return_transport_number)}
              className={`${styles.input} ${errors.return_transport_number ? styles.inputError : ""}`}
              id="return_transport_number"
              maxLength={100}
              name="return_transport_number"
              onChange={(event) =>
                updateField("return_transport_number", event.target.value)
              }
              placeholder="Boleh dikosongkan"
              type="text"
              value={formData.return_transport_number}
            />
            {errors.return_transport_number ? (
              <FieldError
                id="return_transport_number-error"
                message={errors.return_transport_number}
              />
            ) : null}
          </div>
          <div className={`${styles.field} ${styles.fullWidthField}`}>
            <FieldLabel htmlFor="return_destination">Stasiun/Bandara Kepulangan</FieldLabel>
            <input
              aria-describedby={
                errors.return_destination
                  ? "return_destination-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.return_destination)}
              className={`${styles.input} ${errors.return_destination ? styles.inputError : ""}`}
              id="return_destination"
              maxLength={150}
              name="return_destination"
              onChange={(event) =>
                updateField("return_destination", event.target.value)
              }
              placeholder="Contoh: Stasiun Tawang Semarang"
              required
              type="text"
              value={formData.return_destination}
            />
            {errors.return_destination ? (
              <FieldError
                id="return_destination-error"
                message={errors.return_destination}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.formSection} id="step-4">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>04</span>
          <div>
            <p className={styles.sectionKicker}>Kebutuhan menginap</p>
            <h2 className={`${styles.displayFont} ${styles.sectionTitle}`}>
              Informasi Menginap
            </h2>
          </div>
        </div>
        <fieldset className={styles.radioFieldset}>
          <legend className={styles.label}>
            Perpanjang Masa Menginap? <span className={styles.required}>(wajib)</span>
          </legend>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                checked={formData.extend_stay === true}
                name="extend_stay"
                onChange={() => updateField("extend_stay", true)}
                required
                type="radio"
                value="true"
              />
              <span>Ya</span>
            </label>
            <label className={styles.radioOption}>
              <input
                checked={formData.extend_stay === false}
                name="extend_stay"
                onChange={() => updateField("extend_stay", false)}
                required
                type="radio"
                value="false"
              />
              <span>Tidak</span>
            </label>
          </div>
          {errors.extend_stay ? (
            <FieldError id="extend_stay-error" message={errors.extend_stay} />
          ) : null}
        </fieldset>
      </section>

      <div className={styles.submitArea}>
        <button
          className={styles.submitButton}
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Menyimpan..." : "Simpan Informasi Perjalanan"}
        </button>
        <p className={styles.submitHint}>
          Data disimpan untuk peserta yang sudah terdaftar dan dapat diperbarui
          kembali.
        </p>
      </div>
    </form>
  );
}
