"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";

import {
  cancelRegistrationCertificateUpload,
  prepareRegistrationCertificateUpload,
  reportRegistrationStageFailure,
  submitGenericRegistration,
  submitRegistration,
} from "@/app/register/actions";
import { formatIndonesianRupiah, PAYMENT_INSTRUCTIONS, REGISTRATION_PACKAGE_PRICES } from "@/lib/billing/pricing";
import { type PublishedEventForm } from "@/lib/tenant/public-events";
import { createClient } from "@/lib/supabase/client";
import { REGISTRATION_CERTIFICATE_BUCKET, validateRegistrationCertificateFile } from "@/lib/registration/certificate";
import { initialRegistrationState, type RegistrationActionState } from "@/lib/registration/registration-action-state";
import { supportsAkkaiParticipantWorkflow, validateRegistrationFormAnswers } from "@/lib/forms/form-schema";
import { getRegistrationFieldErrors, registrationSchema, type RegistrationFormValues } from "@/lib/validation/registration";

import styles from "./registration.module.css";

type Answer = string | number | boolean;

const packageDetails: Record<string, { description: string; benefits: string[] }> = {
  "Twin Share": { description: "Akomodasi penginapan bersama peserta lain.", benefits: ["Akomodasi", "Konsumsi termasuk Welcome Dinner", "Pick-up & drop-off bandara/stasiun", "Polo shirt", "City Tour", "Oleh-oleh"] },
  Single: { description: "Akomodasi penginapan privat untuk satu peserta.", benefits: ["Akomodasi", "Konsumsi termasuk Welcome Dinner", "Pick-up & drop-off bandara/stasiun", "Polo shirt", "City Tour", "Oleh-oleh"] },
};

function sorted<T extends { position: number }>(items: T[]) {
  return [...items].sort((left, right) => left.position - right.position);
}

function ErrorMessage({ id, message }: { id: string; message: string }) {
  return <p className={styles.errorMessage} id={id} role="alert"><span aria-hidden="true" className={styles.errorMark}>!</span><span>Error: {message}</span></p>;
}

function asText(value: Answer | undefined) {
  return value === undefined || typeof value === "boolean" ? "" : String(value);
}

export function PublishedRegistrationForm({ publishedForm }: { publishedForm: PublishedEventForm }) {
  const akkaiWorkflow = publishedForm.eventSlug === "akkai-2026" && supportsAkkaiParticipantWorkflow(publishedForm.config);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(
    publishedForm.config.fields.filter((field) => field.type !== "file").map((field) => [field.key, field.type === "checkbox" ? false : ""]),
  ));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [submitLocked, setSubmitLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState<RegistrationActionState, FormData>(async (previousState, formData) => {
    if (!akkaiWorkflow) {
      const result = await submitGenericRegistration(previousState, formData);
      if (result.status !== "submitted") setSubmitLocked(false);
      return result;
    }
    const selectedFile = formData.get("certificate_file");
    if (typeof File !== "undefined" && selectedFile instanceof File && selectedFile.size > 0) {
      const prepareData = new FormData();
      prepareData.set("event_id", publishedForm.eventId);
      prepareData.set("form_version_id", publishedForm.versionId);
      prepareData.set("email", String(formData.get("email") ?? ""));
      prepareData.set("file_name", selectedFile.name);
      prepareData.set("file_type", selectedFile.type);
      prepareData.set("file_size", String(selectedFile.size));
      const prepared = await prepareRegistrationCertificateUpload(prepareData);
      if (prepared.status === "error") {
        setSubmitLocked(false);
        return { ...initialRegistrationState, status: "general-error", generalError: prepared.message };
      }

      try {
        const { error } = await createClient().storage.from(REGISTRATION_CERTIFICATE_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, selectedFile, { contentType: selectedFile.type });
        if (error) throw error;
        const submissionData = new FormData();
        formData.forEach((value, key) => { if (key !== "certificate_file") submissionData.append(key, value); });
        submissionData.set("certificate_upload_id", prepared.intentId);
        const result = await submitRegistration(previousState, submissionData);
        if (result.status !== "submitted") {
          setSubmitLocked(false);
          await cancelRegistrationCertificateUpload(prepared.intentId, publishedForm.eventId, publishedForm.versionId);
        }
        return result;
      } catch (error) {
        const errorRecord = typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
        try {
          await reportRegistrationStageFailure("storage-upload", {
            errorType: error instanceof Error ? error.name : typeof error,
            errorCode: errorRecord?.code,
            message: error instanceof Error ? error.message : String(error),
          });
        } catch { /* Diagnostics do not change the public error response. */ }
        await cancelRegistrationCertificateUpload(prepared.intentId, publishedForm.eventId, publishedForm.versionId);
        setSubmitLocked(false);
        return { ...initialRegistrationState, status: "general-error", generalError: "Surat Keterangan Kerja belum dapat diunggah. Silakan coba kembali." };
      }
    }

    const result = await submitRegistration(previousState, formData);
    if (result.status !== "submitted") setSubmitLocked(false);
    return result;
  }, initialRegistrationState);

  function update(key: string, value: Answer) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setClientErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function coreValues(file: File | null): RegistrationFormValues {
    return {
      full_name: asText(answers.full_name),
      email: asText(answers.email),
      phone_number: asText(answers.phone_number),
      kka_name: asText(answers.kka_name),
      position: asText(answers.position),
      polo_size: asText(answers.polo_size),
      polo_model: asText(answers.polo_model),
      package_type: asText(answers.package_type),
      participation_scope: asText(answers.participation_scope),
      actuarial_consultant_status: asText(answers.actuarial_consultant_status),
      attends_pai_congress: asText(answers.attends_pai_congress),
      privacy_consent: answers.privacy_consent === true,
      certificate_file: file,
      certificate_upload_id: "",
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending || submitLocked) {
      event.preventDefault();
      return;
    }
    if (idempotencyRef.current && !idempotencyRef.current.value) idempotencyRef.current.value = crypto.randomUUID();

    const selectedFile = akkaiWorkflow ? fileInputRef.current?.files?.[0] ?? null : null;
    const fileError = selectedFile ? validateRegistrationCertificateFile(selectedFile) : undefined;
    const values = akkaiWorkflow ? coreValues(selectedFile) : null;
    if (values?.actuarial_consultant_status === "Peserta Baru" && selectedFile) values.certificate_upload_id = "pending-upload";
    const staticResult = values ? registrationSchema.safeParse(values) : null;
    const dynamicResult = validateRegistrationFormAnswers(publishedForm.config, answers);
    const nextErrors: Record<string, string> = {
      ...(staticResult && !staticResult.success ? getRegistrationFieldErrors(staticResult.error) : {}),
      ...(dynamicResult.success ? {} : dynamicResult.errors),
    };
    if (fileError) nextErrors.certificate_file = fileError;
    setClientErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0];
    if (firstInvalidField) {
      event.preventDefault();
      window.requestAnimationFrame(() => document.getElementById(firstInvalidField)?.focus());
      return;
    }
    setSubmitLocked(true);
  }

  function renderField(field: (typeof publishedForm.config.fields)[number]) {
    const error = (state.fieldErrors as Record<string, string>)[field.key] ?? clientErrors[field.key];
    const errorId = `${field.key}-error`;
    const required = field.required || (field.key === "certificate_file" && answers.actuarial_consultant_status === "Peserta Baru");
    const wrapperClass = field.type === "checkbox" ? styles.consentField : styles.field;

    if (field.type === "file") {
      if (!akkaiWorkflow || field.key !== "certificate_file" || answers.actuarial_consultant_status !== "Peserta Baru") return null;
      return <div className={wrapperClass} key={field.id}>
        <label className={styles.label} htmlFor={field.key}>{field.label} {required ? <span className={styles.required}>(wajib)</span> : null}</label>
        <input accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-invalid={Boolean(error)} className={`${styles.input} ${styles.fileInput} ${error ? styles.inputError : ""}`} id={field.key} name={field.key} ref={fileInputRef} required={required} type="file" />
        <input name="certificate_upload_id" type="hidden" value="" />
         <p className={styles.helper}>PDF, JPG, JPEG, atau PNG maksimal 2 MiB.</p>
         {field.instructions ? <p className={styles.helper}>{field.instructions}</p> : null}
         {error ? <ErrorMessage id={errorId} message={error} /> : null}
      </div>;
    }

    if (akkaiWorkflow && field.key === "package_type" && field.type === "select") {
      return <div className={wrapperClass} key={field.id}>
        <label className={styles.visuallyHidden} htmlFor={field.key}>{field.label}</label>
        <div aria-label={field.label} className={styles.packageOptions} role="group">
          {(field.options ?? []).map((option) => {
            const details = packageDetails[option];
            const selected = answers[field.key] === option;
            return <button aria-pressed={selected} className={`${styles.packageCard} ${selected ? styles.packageCardSelected : ""}`} key={option} onClick={() => update(field.key, option)} type="button">
              <span className={styles.packageCardHeader}><span className={styles.packageCardName}>{option}</span><span aria-hidden="true" className={styles.packageCardCheck}>✓</span></span>
              <span className={styles.packageCardPriceRow}><strong className={styles.packageCardPrice}>{REGISTRATION_PACKAGE_PRICES[option as keyof typeof REGISTRATION_PACKAGE_PRICES] ? formatIndonesianRupiah(REGISTRATION_PACKAGE_PRICES[option as keyof typeof REGISTRATION_PACKAGE_PRICES]) : ""}</strong><span className={styles.packageCardUnit}>per peserta</span></span>
              {details ? <><span className={styles.packageCardDescription}>{details.description}</span><span className={styles.packageCardIncludes}>Termasuk:</span><span className={styles.packageCardList}>{details.benefits.map((benefit) => <span key={benefit}>✓ {benefit}</span>)}</span></> : null}
            </button>;
          })}
        </div>
        <select aria-invalid={Boolean(error)} className={styles.visuallyHiddenControl} id={field.key} name={field.key} onChange={(event) => update(field.key, event.target.value)} required={required} tabIndex={-1} value={asText(answers[field.key])}>
          <option value="">Pilih paket</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
         {field.instructions ? <p className={styles.helper}>{field.instructions}</p> : null}
         {error ? <ErrorMessage id={errorId} message={error} /> : null}
      </div>;
    }

    if (field.type === "checkbox") {
      return <div className={wrapperClass} key={field.id}>
        <div className={styles.consentRow}>
          <input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} checked={answers[field.key] === true} className={styles.checkbox} id={field.key} name={field.key} onChange={(event) => update(field.key, event.target.checked)} required={required} type="checkbox" value="true" />
          <label className={styles.consentLabel} htmlFor={field.key}>{field.label} {required ? <span className={styles.required}>(wajib)</span> : null}</label>
        </div>
         {field.instructions ? <p className={styles.helper}>{field.instructions}</p> : null}
         {error ? <ErrorMessage id={errorId} message={error} /> : null}
      </div>;
    }

    return <div className={wrapperClass} key={field.id}>
      <label className={styles.label} htmlFor={field.key}>{field.label} {required ? <span className={styles.required}>(wajib)</span> : <span className={styles.required}>(opsional)</span>}</label>
      {field.type === "select" ? <select aria-invalid={Boolean(error)} className={`${styles.select} ${error ? styles.inputError : ""}`} id={field.key} name={field.key} onChange={(event) => update(field.key, event.target.value)} required={required} value={asText(answers[field.key])}>
         <option value="">Pilih {field.label.toLowerCase()}</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{akkaiWorkflow && field.key === "attends_pai_congress" ? (option === "true" ? "Ya" : "Tidak") : option}</option>)}
      </select> : field.type === "radio" ? <fieldset className="grid gap-2">
        <legend className="sr-only">{field.label}</legend>{(field.options ?? []).map((option) => <label className={styles.consentRow} key={option}><input checked={answers[field.key] === option} name={field.key} onChange={() => update(field.key, option)} required={required && !answers[field.key]} type="radio" value={option} /><span>{option}</span></label>)}
      </fieldset> : field.type === "textarea" ? <textarea aria-invalid={Boolean(error)} className={`${styles.input} ${error ? styles.inputError : ""}`} id={field.key} maxLength={2000} name={field.key} onChange={(event) => update(field.key, event.target.value)} placeholder={field.placeholder} required={required} value={asText(answers[field.key])} /> : <input aria-invalid={Boolean(error)} className={`${styles.input} ${error ? styles.inputError : ""}`} id={field.key} max={field.type === "number" ? undefined : undefined} name={field.key} onChange={(event) => update(field.key, field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} placeholder={field.placeholder} required={required} type={field.type} value={asText(answers[field.key])} />}
       {field.instructions ? <p className={styles.helper}>{field.instructions}</p> : null}
       {error ? <ErrorMessage id={errorId} message={error} /> : null}
    </div>;
  }

  if (state.status === "submitted") {
    return <section aria-live="polite" className={styles.closedCard} role="status">
      <p className={styles.eyebrow}>Registrasi Peserta</p><h2 className={`${styles.displayFont} ${styles.closedTitle}`}>Pendaftaran Berhasil</h2>
      <p className={styles.closedDescription}>Data registrasi Anda telah berhasil disimpan.</p>
       {state.registrationId ? <p className={styles.eventValue}>Nomor Registrasi: {state.registrationId}</p> : null}
       {akkaiWorkflow ? <p className={styles.closedDescription}>{state.emailDelivery === "accepted" ? "Email QR dan konfirmasi telah diterima oleh layanan pengiriman." : "Data tersimpan, tetapi email QR belum dapat dikirim. Silakan hubungi panitia."}</p> : null}
      {state.billing ? <section aria-label="Ringkasan pembayaran" className={styles.billingCard}>
        <p className={styles.billingEyebrow}>Ringkasan pembayaran</p><h3 className={styles.billingTitle}>Tagihan Biaya Pendaftaran</h3>
        <dl className={styles.billingDetails}>
          <div><dt>Nomor registrasi</dt><dd>{state.billing.registrationId}</dd></div><div><dt>Nomor tagihan unik</dt><dd>{state.billing.billingNumber}</dd></div><div><dt>Nama peserta</dt><dd>{state.billing.fullName}</dd></div><div><dt>KKA</dt><dd>{state.billing.kkaName}</dd></div><div><dt>Paket</dt><dd>{state.billing.packageType}</dd></div><div><dt>Total tagihan</dt><dd>{formatIndonesianRupiah(state.billing.amount)}</dd></div>
        </dl>
        <p className={styles.billingInstruction}>Instruksi pembayaran: {PAYMENT_INSTRUCTIONS.bank}, rekening {PAYMENT_INSTRUCTIONS.accountNumber} atas nama {PAYMENT_INSTRUCTIONS.accountName}. Batas akhir {PAYMENT_INSTRUCTIONS.deadline}. Kirim bukti ke {PAYMENT_INSTRUCTIONS.proofEmail} atau {PAYMENT_INSTRUCTIONS.proofWhatsapp}.</p>
        <p className={styles.billingEmailStatus}>{state.billingEmailDelivery === "accepted" ? "Tagihan juga telah dikirim ke alamat email Anda." : "Tagihan tersimpan, tetapi email tagihan belum dapat dikirim. Hubungi panitia."}</p>
      </section> : null}
    </section>;
  }

  return <form action={formAction} className={styles.form} noValidate onSubmit={handleSubmit}>
    <input name="event_id" type="hidden" value={publishedForm.eventId} />
    <input name="form_version_id" type="hidden" value={publishedForm.versionId} />
    <input name="form_answers" type="hidden" value={JSON.stringify(answers)} />
    <input name="registration_idempotency_key" ref={idempotencyRef} type="hidden" />
    {state.generalError ? <div className={styles.generalAlert} role="alert">{state.generalError}</div> : null}
    {sorted(publishedForm.config.sections).map((section, index) => {
      const fields = sorted(publishedForm.config.fields.filter((field) => field.sectionId === section.id));
      if (fields.length === 0) return null;
      return <section className={styles.formSection} key={section.id}>
        <div className={styles.sectionHeader}><span className={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</span><div><p className={styles.sectionKicker}>{section.description || "Lengkapi bagian ini"}</p><h2 className={styles.sectionTitle}>{section.title}</h2></div></div>
        <div className={styles.fieldGroup}>{fields.map(renderField)}</div>
      </section>;
    })}
    <div className={styles.submitArea}>
      <button className={styles.submitButton} disabled={isPending || submitLocked} type="submit">{isPending ? "Mengirim Pendaftaran…" : "Kirim Pendaftaran"}</button>
      <p className={styles.submitHint}>Pastikan seluruh data sudah benar sebelum mengirimkan formulir.</p>
    </div>
  </form>;
}
