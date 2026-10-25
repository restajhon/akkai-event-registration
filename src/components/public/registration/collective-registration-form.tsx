"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  cancelRegistrationCertificateUpload,
  prepareRegistrationCertificateUpload,
  submitCollectiveRegistration,
} from "@/app/register/actions";
import { createClient } from "@/lib/supabase/client";
import { REGISTRATION_CERTIFICATE_BUCKET, validateRegistrationCertificateFile } from "@/lib/registration/certificate";
import {
  collectiveParticipantSchema,
  getCollectiveParticipantFieldErrors,
  type CollectiveParticipantFieldErrors,
  type CollectiveParticipantFormValues,
} from "@/lib/validation/registration";
import { validateRegistrationFormAnswers } from "@/lib/forms/form-schema";
import type { PublishedEventForm } from "@/lib/tenant/public-events";
import {
  initialCollectiveRegistrationState,
  type CollectiveRegistrationActionState,
} from "@/lib/registration/registration-action-state";

import styles from "./registration.module.css";

const emptyTravel = {
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
  extend_stay: false,
};

type CollectiveFormParticipant = CollectiveParticipantFormValues & {
  custom_answers: Record<string, string | number | boolean>;
};

function createParticipant(publishedForm: PublishedEventForm): CollectiveFormParticipant {
  return {
    full_name: "",
    email: "",
    phone_number: "",
    kka_name: "",
    position: "",
    polo_size: "",
    polo_model: "",
    package_type: "",
    participation_scope: "",
    actuarial_consultant_status: "",
    attends_pai_congress: "",
    privacy_consent: false,
    certificate_file: null,
    certificate_upload_id: "",
    member_number: "",
    institution: "",
    include_travel: false,
    travel: { ...emptyTravel },
    custom_answers: Object.fromEntries(
      publishedForm.config.fields
        .filter((field) => !field.system && field.type !== "file")
        .map((field) => [field.key, field.type === "checkbox" ? false : ""]),
    ),
  };
}

type FieldName = keyof CollectiveParticipantFormValues | "travel" | "custom_answers";
type ErrorMap = Record<number, CollectiveParticipantFieldErrors>;

function CardError({ error }: { error?: string }) {
  return error ? <p className={styles.errorMessage} role="alert">Error: {error}</p> : null;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label className={styles.label} htmlFor={htmlFor}>{children}</label>;
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={id}>{label} {required ? <span className={styles.required}>(wajib)</span> : <span className={styles.required}>(opsional)</span>}</FieldLabel>
      <input
        aria-invalid={Boolean(error)}
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      <CardError error={error} />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  error,
  onChange,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  error?: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={id}>{label} {required ? <span className={styles.required}>(wajib)</span> : <span className={styles.required}>(opsional)</span>}</FieldLabel>
      <select
        aria-invalid={Boolean(error)}
        className={`${styles.select} ${error ? styles.inputError : ""}`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">Pilih {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <CardError error={error} />
    </div>
  );
}

function TravelFields({
  participant,
  index,
  errors,
  updateTravel,
}: {
  participant: CollectiveParticipantFormValues;
  index: number;
  errors: CollectiveParticipantFieldErrors;
  updateTravel: (field: keyof typeof emptyTravel, value: string | boolean) => void;
}) {
  const travel = participant.travel;
  const field = (name: keyof typeof emptyTravel) => `participant-${index}-${name}`;
  return (
    <div className={styles.collectiveTravel}>
      <div className={styles.collectiveTravelGrid}>
        <TextField id={field("outbound_date")} label="Tanggal berangkat" type="date" value={travel.outbound_date} error={errors["travel.outbound_date"]} onChange={(value) => updateTravel("outbound_date", value)} required />
        <TextField id={field("outbound_time")} label="Waktu berangkat" type="time" value={travel.outbound_time} error={errors["travel.outbound_time"]} onChange={(value) => updateTravel("outbound_time", value)} required />
        <TextField id={field("outbound_transport_mode")} label="Moda berangkat" value={travel.outbound_transport_mode} error={errors["travel.outbound_transport_mode"]} onChange={(value) => updateTravel("outbound_transport_mode", value)} required />
        <TextField id={field("outbound_transport_number")} label="Nomor kendaraan/tiket" value={travel.outbound_transport_number} error={errors["travel.outbound_transport_number"]} onChange={(value) => updateTravel("outbound_transport_number", value)} />
        <TextField id={field("outbound_origin")} label="Asal berangkat" value={travel.outbound_origin} error={errors["travel.outbound_origin"]} onChange={(value) => updateTravel("outbound_origin", value)} required />
        <TextField id={field("outbound_destination")} label="Tujuan berangkat" value={travel.outbound_destination} error={errors["travel.outbound_destination"]} onChange={(value) => updateTravel("outbound_destination", value)} required />
        <TextField id={field("return_date")} label="Tanggal pulang" type="date" value={travel.return_date} error={errors["travel.return_date"]} onChange={(value) => updateTravel("return_date", value)} required />
        <TextField id={field("return_time")} label="Waktu pulang" type="time" value={travel.return_time} error={errors["travel.return_time"]} onChange={(value) => updateTravel("return_time", value)} required />
        <TextField id={field("return_transport_mode")} label="Moda pulang" value={travel.return_transport_mode} error={errors["travel.return_transport_mode"]} onChange={(value) => updateTravel("return_transport_mode", value)} required />
        <TextField id={field("return_transport_number")} label="Nomor kendaraan/tiket pulang" value={travel.return_transport_number} error={errors["travel.return_transport_number"]} onChange={(value) => updateTravel("return_transport_number", value)} />
        <TextField id={field("return_destination")} label="Tujuan pulang" value={travel.return_destination} error={errors["travel.return_destination"]} onChange={(value) => updateTravel("return_destination", value)} required />
      </div>
      <label className={styles.consentRow} htmlFor={field("extend_stay")}>
        <input checked={travel.extend_stay} className={styles.checkbox} id={field("extend_stay")} onChange={(event) => updateTravel("extend_stay", event.target.checked)} type="checkbox" />
        <span className={styles.consentLabel}>Peserta memperpanjang masa tinggal.</span>
      </label>
      <CardError error={errors.travel} />
    </div>
  );
}

function ParticipantCard({
  participant,
  publishedForm,
  index,
  errors,
  update,
  updateTravel,
  chooseFile,
  remove,
}: {
  participant: CollectiveFormParticipant;
  publishedForm: PublishedEventForm;
  index: number;
  errors: CollectiveParticipantFieldErrors;
  update: (field: FieldName, value: string | number | boolean | File | Record<string, string | number | boolean> | null) => void;
  updateTravel: (field: keyof typeof emptyTravel, value: string | boolean) => void;
  chooseFile: (file: File | null) => void;
  remove?: () => void;
}) {
  const id = (field: string) => `participant-${index}-${field}`;
  const getFieldValue = (field: (typeof publishedForm.config.fields)[number]) => {
    if (!field.system) return participant.custom_answers[field.key] ?? (field.type === "checkbox" ? false : "");
    const value = (participant as unknown as Record<string, unknown>)[field.key];
    return typeof value === "string" || typeof value === "boolean" || typeof value === "number" ? value : "";
  };
  const updateConfiguredField = (
    field: (typeof publishedForm.config.fields)[number],
    value: string | number | boolean,
  ) => {
    if (field.system) update(field.key as FieldName, value);
    else update("custom_answers", { ...participant.custom_answers, [field.key]: value });
  };
  const renderConfiguredField = (field: (typeof publishedForm.config.fields)[number]) => {
    const value = getFieldValue(field);
    const error = (errors as Record<string, string | undefined>)[field.key];
    const inputId = id(field.key);
    const required = field.required || (field.key === "certificate_file" && participant.actuarial_consultant_status === "Peserta Baru");

    if (field.type === "file") {
      if (field.key !== "certificate_file" || participant.actuarial_consultant_status !== "Peserta Baru") return null;
      return (
        <div className={styles.field} key={field.id}>
          <FieldLabel htmlFor={inputId}>{field.label} <span className={styles.required}>(wajib)</span></FieldLabel>
          <input accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-invalid={Boolean(error)} className={`${styles.input} ${styles.fileInput} ${error ? styles.inputError : ""}`} id={inputId} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} type="file" />
          <p className={styles.helper}>PDF, JPG, JPEG, atau PNG maksimal 2 MiB.</p>
          <CardError error={error} />
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <div className={styles.field} key={field.id}>
          <label className={styles.consentRow} htmlFor={inputId}>
            <input aria-invalid={Boolean(error)} checked={value === true} className={styles.checkbox} id={inputId} onChange={(event) => updateConfiguredField(field, event.target.checked)} required={required} type="checkbox" />
            <span className={styles.consentLabel}>{field.label} {required ? <span className={styles.required}>(wajib)</span> : null}</span>
          </label>
          <CardError error={error} />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <SelectField
          error={error}
          id={inputId}
          key={field.id}
          label={field.label}
          onChange={(nextValue) => updateConfiguredField(field, nextValue)}
          options={field.options ?? []}
          required={required}
          value={typeof value === "string" ? value : ""}
        />
      );
    }

    if (field.type === "radio") {
      return (
        <div className={styles.field} key={field.id}>
          <fieldset className="grid gap-2">
            <legend className={styles.label}>{field.label} {required ? <span className={styles.required}>(wajib)</span> : <span className={styles.required}>(opsional)</span>}</legend>
            {(field.options ?? []).map((option) => <label className={styles.consentRow} key={option}><input checked={value === option} name={inputId} onChange={() => updateConfiguredField(field, option)} required={required && !value} type="radio" value={option} /><span>{option}</span></label>)}
          </fieldset>
          <CardError error={error} />
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div className={styles.field} key={field.id}>
          <FieldLabel htmlFor={inputId}>{field.label} {required ? <span className={styles.required}>(wajib)</span> : <span className={styles.required}>(opsional)</span>}</FieldLabel>
          <textarea aria-invalid={Boolean(error)} className={`${styles.input} ${error ? styles.inputError : ""}`} id={inputId} maxLength={2000} onChange={(event) => updateConfiguredField(field, event.target.value)} placeholder={field.placeholder} required={required} value={typeof value === "string" ? value : ""} />
          <CardError error={error} />
        </div>
      );
    }

    return (
      <TextField
        error={error}
        id={inputId}
        label={field.label}
        onChange={(nextValue) => updateConfiguredField(field, field.type === "number" && nextValue !== "" ? Number(nextValue) : nextValue)}
        placeholder={field.placeholder}
        required={required}
        type={field.type}
        value={typeof value === "boolean" ? "" : String(value)}
      />
    );
  };

  return (
    <article className={styles.collectiveCard}>
      <div className={styles.collectiveCardHeader}>
        <div>
          <p className={styles.sectionKicker}>Peserta {index + 1}</p>
          <h2 className={styles.collectiveCardTitle}>{participant.full_name || "Data peserta baru"}</h2>
        </div>
        {remove ? <button className={styles.collectiveRemove} onClick={remove} type="button">Hapus peserta</button> : null}
      </div>
      <div className={styles.collectiveGrid}>
        <TextField id={id("member_number")} label="Nomor anggota" value={participant.member_number} error={errors.member_number} onChange={(value) => update("member_number", value)} />
        <TextField id={id("institution")} label="Institusi" value={participant.institution} error={errors.institution} onChange={(value) => update("institution", value)} />
      </div>
      <div className="grid gap-4">
        {[...publishedForm.config.sections].sort((left, right) => left.position - right.position).map((section) => {
          const fields = publishedForm.config.fields
            .filter((field) => field.sectionId === section.id)
            .sort((left, right) => left.position - right.position);
          if (fields.length === 0) return null;
          return (
            <section className="grid gap-3" key={section.id}>
              <div><h3 className={styles.sectionTitle}>{section.title}</h3>{section.description ? <p className={styles.helper}>{section.description}</p> : null}</div>
              <div className={styles.collectiveGrid}>{fields.map(renderConfiguredField)}</div>
            </section>
          );
        })}
      </div>
      <label className={styles.collectiveToggle} htmlFor={id("include_travel")}>
        <input checked={participant.include_travel} className={styles.checkbox} id={id("include_travel")} onChange={(event) => update("include_travel", event.target.checked)} type="checkbox" />
        <span><strong>Isi data travel peserta</strong><small>Data ini dapat dilengkapi atau disesuaikan admin kemudian.</small></span>
      </label>
      {participant.include_travel ? <TravelFields errors={errors} index={index} participant={participant} updateTravel={updateTravel} /> : null}
    </article>
  );
}

function CollectiveResult({ state }: { state: CollectiveRegistrationActionState }) {
  return (
    <section aria-live="polite" className={styles.closedCard} role="status">
      <p className={styles.eyebrow}>Registrasi Kolektif</p>
      <h1 className={`${styles.displayFont} ${styles.closedTitle}`}>Pendaftaran Diproses</h1>
      <p className={styles.closedDescription}>Batch <strong>{state.batchCode}</strong> telah dicatat. Setiap peserta memiliki registration ID, QR, dan tagihan sendiri.</p>
      <div className={styles.collectiveResults}>
        {state.participants.map((participant) => (
          <article className={styles.collectiveResult} key={`${participant.index}-${participant.registrationId ?? participant.fullName}`}>
            <div><strong>{participant.fullName}</strong><span>{participant.email}</span></div>
            <p className={participant.status === "failed" ? styles.collectiveResultFailed : styles.collectiveResultSuccess}>{participant.message}</p>
            {participant.registrationId ? <dl><div><dt>Registration ID</dt><dd>{participant.registrationId}</dd></div><div><dt>Nomor tagihan</dt><dd>{participant.billingNumber}</dd></div></dl> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function CollectiveRegistrationForm({ publishedForm }: { publishedForm: PublishedEventForm }) {
  const [participants, setParticipants] = useState<CollectiveFormParticipant[]>([createParticipant(publishedForm)]);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitLocked, setSubmitLocked] = useState(false);
  const uploadedIntentsForResponse = useRef<{ eventId: string; versionId: string; intentIds: string[] } | null>(null);
  const [state, formAction, isPending] = useActionState(async (previousState: CollectiveRegistrationActionState, formData: FormData) => {
    const result = await submitCollectiveRegistration(previousState, formData);
    if (result.status !== "submitted") setSubmitLocked(false);
    return result;
  }, initialCollectiveRegistrationState);

  useEffect(() => {
    const uploaded = uploadedIntentsForResponse.current;
    if (!uploaded || state.status === "idle") return;
    uploadedIntentsForResponse.current = null;
    void Promise.all(uploaded.intentIds.map((intentId) => cancelRegistrationCertificateUpload(
      intentId,
      uploaded.eventId,
      uploaded.versionId,
    )));
  }, [state]);

  function updateParticipant(index: number, field: FieldName, value: string | number | boolean | File | Record<string, string | number | boolean> | null) {
    setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index ? { ...participant, [field]: value } : participant));
    setErrors((current) => ({
      ...current,
      [index]: field === "custom_answers" && value && typeof value === "object"
        ? { ...current[index], ...Object.fromEntries(Object.keys(value).map((key) => [key, undefined])) }
        : { ...current[index], [field]: undefined },
    }));
  }

  function updateTravel(index: number, field: keyof typeof emptyTravel, value: string | boolean) {
    setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index ? { ...participant, travel: { ...participant.travel, [field]: value } } : participant));
    setErrors((current) => ({ ...current, [index]: { ...current[index], [`travel.${field}`]: undefined } }));
  }

  function chooseFile(index: number, file: File | null) {
    updateParticipant(index, "certificate_file", file);
    const fileError = file ? validateRegistrationCertificateFile(file) : undefined;
    if (fileError) setErrors((current) => ({ ...current, [index]: { ...current[index], certificate_file: fileError } }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || submitLocked) return;

    const normalized = participants.map((participant) => ({
      ...participant,
      travel: participant.include_travel ? participant.travel : null,
      form_answers: {
        full_name: participant.full_name,
        email: participant.email,
        phone_number: participant.phone_number,
        kka_name: participant.kka_name,
        position: participant.position,
        polo_size: participant.polo_size,
        polo_model: participant.polo_model,
        package_type: participant.package_type,
        participation_scope: participant.participation_scope,
        actuarial_consultant_status: participant.actuarial_consultant_status,
        attends_pai_congress: participant.attends_pai_congress,
        privacy_consent: participant.privacy_consent,
        ...participant.custom_answers,
      },
    }));
    const parsedParticipants = normalized.map((participant) => collectiveParticipantSchema.safeParse(participant));
    const nextErrors: ErrorMap = {};
    parsedParticipants.forEach((result, index) => {
      if (!result.success) nextErrors[index] = getCollectiveParticipantFieldErrors(result.error);
      const answerResult = validateRegistrationFormAnswers(publishedForm.config, normalized[index].form_answers);
      if (!answerResult.success) nextErrors[index] = { ...nextErrors[index], ...answerResult.errors } as CollectiveParticipantFieldErrors;
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitLocked(true);
    const uploadedIntentIds: string[] = [];
    const cleanupUploadedIntents = async () => {
      await Promise.all(uploadedIntentIds.map((intentId) => cancelRegistrationCertificateUpload(
        intentId,
        publishedForm.eventId,
        publishedForm.versionId,
      )));
    };
    const payloadParticipants = [];
    for (let index = 0; index < normalized.length; index += 1) {
      const participant = normalized[index];
      let uploadId = participant.certificate_upload_id;
      const file = participant.certificate_file;
      if (participant.actuarial_consultant_status === "Peserta Baru" && file instanceof File && file.size > 0) {
        const preparation = new FormData();
        preparation.set("event_id", publishedForm.eventId);
        preparation.set("form_version_id", publishedForm.versionId);
        preparation.set("email", participant.email);
        preparation.set("file_name", file.name);
        preparation.set("file_type", file.type);
        preparation.set("file_size", String(file.size));
        const prepared = await prepareRegistrationCertificateUpload(preparation);
        if (prepared.status === "error") {
          await cleanupUploadedIntents();
          setErrors((current) => ({ ...current, [index]: { ...current[index], certificate_file: prepared.message } }));
          setSubmitLocked(false);
          return;
        }
        try {
          const { error } = await createClient().storage.from(REGISTRATION_CERTIFICATE_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
          if (error) throw error;
          uploadId = prepared.intentId;
          uploadedIntentIds.push(uploadId);
        } catch {
          await cancelRegistrationCertificateUpload(prepared.intentId, publishedForm.eventId, publishedForm.versionId);
          await cleanupUploadedIntents();
          setErrors((current) => ({ ...current, [index]: { ...current[index], certificate_file: "Surat Keterangan Kerja belum dapat diunggah." } }));
          setSubmitLocked(false);
          return;
        }
      }
      const payloadParticipant = {
        ...participant,
        certificate_file: undefined,
        certificate_upload_id: uploadId,
        custom_answers: undefined,
      };
      payloadParticipants.push(payloadParticipant);
    }

    const payload = new FormData();
    payload.set("payload", JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      event_id: publishedForm.eventId,
      form_version_id: publishedForm.versionId,
      participants: payloadParticipants,
    }));
    uploadedIntentsForResponse.current = {
      eventId: publishedForm.eventId,
      versionId: publishedForm.versionId,
      intentIds: uploadedIntentIds,
    };
    formAction(payload);
  }

  if (state.status === "submitted") return <CollectiveResult state={state} />;

  const serverErrors = state.fieldErrors.reduce<ErrorMap>((result, fieldErrors, index) => {
    result[index] = fieldErrors as CollectiveParticipantFieldErrors;
    return result;
  }, {});
  const visibleErrors = { ...serverErrors, ...errors };

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {state.generalError || state.status === "validation-error" ? <div className={styles.generalAlert} role="alert">{state.generalError ?? "Periksa kembali data pada setiap kartu peserta."}</div> : null}
      <div className={styles.collectiveIntro}>
        <p className={styles.sectionKicker}>Pendaftaran kolektif</p>
        <h2 className={styles.sectionTitle}>Daftarkan beberapa peserta sekaligus</h2>
        <p className={styles.introDescription}>Setiap kartu diproses sebagai peserta independen. Email QR dan tagihan akan dikirim ke alamat pada kartu tersebut.</p>
      </div>
      {participants.map((participant, index) => (
        <ParticipantCard
          chooseFile={(file) => chooseFile(index, file)}
          errors={visibleErrors[index] ?? {}}
          index={index}
          key={index}
          participant={participant}
          publishedForm={publishedForm}
          remove={participants.length > 1 ? () => setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index)) : undefined}
          update={(field, value) => updateParticipant(index, field, value)}
          updateTravel={(field, value) => updateTravel(index, field, value)}
        />
      ))}
      <div className={styles.collectiveActions}>
        <button className={styles.secondaryButton} disabled={participants.length >= 100} onClick={() => setParticipants((current) => current.length >= 100 ? current : [...current, createParticipant(publishedForm)])} type="button">+ Tambah Peserta</button>
        <p className={styles.collectiveSummary}>Ringkasan: <strong>{participants.length} peserta</strong>. Setiap peserta akan memperoleh registration ID, QR, dan nomor tagihan berbeda.</p>
      </div>
      <div className={styles.submitArea}>
        <button className={styles.submitButton} disabled={isPending || submitLocked} type="submit">{isPending ? "Memproses Pendaftaran..." : `Kirim ${participants.length} Pendaftaran`}</button>
        <p className={styles.submitHint}>Periksa kembali setiap kartu sebelum mengirimkan formulir.</p>
      </div>
    </form>
  );
}
