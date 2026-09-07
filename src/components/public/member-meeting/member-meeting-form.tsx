"use client";

import {
  useActionState,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  cancelMemberMeetingUpload,
  prepareMemberMeetingUpload,
  submitMemberMeeting,
} from "@/app/rapat-anggota/actions";
import {
  initialMemberMeetingActionState,
  type MemberMeetingActionState,
} from "@/lib/member-meeting/member-meeting-action-state";
import { MEMBER_MEETING_BUCKET } from "@/lib/member-meeting/storage";
import {
  getMemberMeetingFieldErrors,
  memberMeetingSchema,
  type MemberMeetingField,
  type MemberMeetingFieldErrors,
  type MemberMeetingFormValues,
} from "@/lib/validation/member-meeting";
import { createClient } from "@/lib/supabase/client";

import styles from "./member-meeting.module.css";

const initialFormData: MemberMeetingFormValues = {
  name: "",
  consulting_firm: "",
  position: "",
  phone: "",
  email: "",
  attendance_type: "",
  proxy_name: "",
  proxy_position: "",
  authorization_file: null,
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
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label className={styles.label} htmlFor={htmlFor}>
      {children} <span className={styles.required}>(wajib)</span>
    </label>
  );
}

export function MemberMeetingForm() {
  const [showSuccess, setShowSuccess] = useState(false);
  const submitLockRef = useRef(false);
  const [state, formAction, isPending] = useActionState<
    MemberMeetingActionState,
    FormData
  >(async (previousState, formData) => {
    if (formData.get("attendance_type") === "PROXY") {
      const file = formData.get("authorization_file");

      if (!(file instanceof File) || file.size === 0) {
        return await submitMemberMeeting(previousState, formData);
      }

      const preparationData = new FormData();
      preparationData.set("email", String(formData.get("email") ?? ""));
      preparationData.set("file_name", file.name);
      preparationData.set("file_type", file.type);
      preparationData.set("file_size", String(file.size));
      preparationData.set("website", String(formData.get("website") ?? ""));

      const preparation = await prepareMemberMeetingUpload(preparationData);
      if (preparation.status === "error") {
        submitLockRef.current = false;
        return {
          status: "general-error",
          fieldErrors: {},
          generalError: preparation.message,
        };
      }

      let uploadError: Error | null = null;
      try {
        const supabase = createClient();
        const result = await supabase.storage
          .from(MEMBER_MEETING_BUCKET)
          .uploadToSignedUrl(preparation.path, preparation.token, file, {
            contentType: file.type,
          });
        uploadError = result.error;
      } catch {
        uploadError = new Error("Upload failed");
      }

      if (uploadError) {
        await cancelMemberMeetingUpload(preparation.intentId);
        submitLockRef.current = false;
        return {
          status: "general-error",
          fieldErrors: {},
          generalError:
            "Surat Kuasa belum dapat diunggah. Silakan coba kembali.",
        };
      }

      const submissionData = new FormData();
      formData.forEach((value, key) => {
        if (key !== "authorization_file") {
          submissionData.append(key, value);
        }
      });
      submissionData.set("upload_intent_id", preparation.intentId);
      const nextState = await submitMemberMeeting(previousState, submissionData);

      if (nextState.status === "saved") {
        setShowSuccess(true);
      } else {
        submitLockRef.current = false;
      }

      return nextState;
    }

    const nextState = await submitMemberMeeting(previousState, formData);

    if (nextState.status === "saved") {
      setShowSuccess(true);
    } else {
      submitLockRef.current = false;
    }

    return nextState;
  }, initialMemberMeetingActionState);
  const [formData, setFormData] = useState<MemberMeetingFormValues>(
    initialFormData,
  );
  const [clientErrors, setClientErrors] = useState<MemberMeetingFieldErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errors: MemberMeetingFieldErrors = {
    ...state.fieldErrors,
    ...clientErrors,
  };

  function updateField(field: MemberMeetingField, value: string | File | null) {
    setFormData((current) => ({ ...current, [field]: value }));
    setClientErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function chooseAttendance(value: "SELF" | "PROXY") {
    updateField("attendance_type", value);

    if (value === "SELF") {
      setFormData((current) => ({
        ...current,
        proxy_name: "",
        proxy_position: "",
        authorization_file: null,
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setClientErrors((current) => {
        const nextErrors = { ...current };
        delete nextErrors.proxy_name;
        delete nextErrors.proxy_position;
        delete nextErrors.authorization_file;
        return nextErrors;
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending || submitLockRef.current) {
      event.preventDefault();
      return;
    }

    const result = memberMeetingSchema.safeParse(formData);
    const nextErrors = result.success
      ? {}
      : getMemberMeetingFieldErrors(result.error);
    setClientErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0] as
      | MemberMeetingField
      | undefined;

    if (firstInvalidField) {
      event.preventDefault();
      window.requestAnimationFrame(() => {
        document.getElementById(firstInvalidField)?.focus();
      });
      return;
    }

    submitLockRef.current = true;
  }

  if (state.status === "saved" && showSuccess) {
    return (
      <section aria-live="polite" className={styles.successCard} role="status">
        <p className={styles.eyebrow}>Rapat Anggota AKKAI 2026</p>
        <h2 className={`${styles.displayFont} ${styles.successTitle}`}>
          Data berhasil dikirim.
        </h2>
        <p className={styles.successCopy}>
          Terima kasih. Data kehadiran Rapat Anggota AKKAI 2026 telah tersimpan.
        </p>
        <button
          className={styles.secondaryButton}
          onClick={() => {
            submitLockRef.current = false;
            setShowSuccess(false);
          }}
          type="button"
        >
          Kirim Data Lain
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
      <input
        aria-hidden="true"
        className={styles.honeypot}
        name="website"
        tabIndex={-1}
        type="text"
      />
      {state.generalError ? (
        <div className={styles.generalAlert} role="alert">
          <span aria-hidden="true" className={styles.alertMark}>
            !
          </span>
          <span>{state.generalError}</span>
        </div>
      ) : null}

      <section className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>01</span>
          <div>
            <p className={styles.sectionKicker}>Informasi utama</p>
            <h2 className={`${styles.displayFont} ${styles.sectionTitle}`}>
              Data Pemimpin KKA
            </h2>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          {(
            [
              ["name", "Nama", "Nama lengkap pemimpin KKA", "text"],
              [
                "consulting_firm",
                "Kantor Konsultan Aktuaria",
                "Nama kantor konsultan aktuaria",
                "text",
              ],
              ["position", "Jabatan", "Jabatan pemimpin KKA", "text"],
              ["phone", "No. HP", "Contoh: 081234567890", "tel"],
              ["email", "Alamat Email", "nama@email.com", "email"],
            ] as const
          ).map(([field, label, placeholder, type]) => (
            <div
              className={`${styles.field} ${field === "email" ? styles.fullWidth : ""}`}
              key={field}
            >
              <FieldLabel htmlFor={field}>{label}</FieldLabel>
              <input
                aria-describedby={errors[field] ? `${field}-error` : undefined}
                aria-invalid={Boolean(errors[field])}
                autoComplete={field === "email" ? "email" : "off"}
                className={`${styles.input} ${errors[field] ? styles.inputError : ""}`}
                id={field}
                maxLength={field === "consulting_firm" ? 150 : 100}
                name={field}
                onChange={(event) => updateField(field, event.target.value)}
                placeholder={placeholder}
                required
                type={type}
                value={formData[field] as string}
              />
              {errors[field] ? (
                <FieldError id={`${field}-error`} message={errors[field]!} />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>02</span>
          <div>
            <p className={styles.sectionKicker}>Konfirmasi kehadiran</p>
            <h2 className={`${styles.displayFont} ${styles.sectionTitle}`}>
              Kehadiran atau Surat Kuasa
            </h2>
          </div>
        </div>
        <fieldset className={styles.radioFieldset}>
          <legend className={styles.radioLegend}>
            Pilihan kehadiran <span className={styles.required}>(wajib)</span>
          </legend>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                checked={formData.attendance_type === "SELF"}
                name="attendance_type"
                onChange={() => chooseAttendance("SELF")}
                required
                type="radio"
                value="SELF"
              />
              <span>Pemimpin KKA hadir sendiri</span>
            </label>
            <label className={styles.radioOption}>
              <input
                checked={formData.attendance_type === "PROXY"}
                name="attendance_type"
                onChange={() => chooseAttendance("PROXY")}
                required
                type="radio"
                value="PROXY"
              />
              <span>Pemimpin KKA berhalangan hadir dan memberikan kuasa</span>
            </label>
          </div>
          {errors.attendance_type ? (
            <FieldError
              id="attendance_type-error"
              message={errors.attendance_type}
            />
          ) : null}
        </fieldset>

        {formData.attendance_type === "PROXY" ? (
          <div className={styles.proxySection}>
            <h3 className={styles.proxyTitle}>
              Apabila Pemimpin KKA berhalangan hadir, dikuasakan kepada:
            </h3>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <FieldLabel htmlFor="proxy_name">Nama penerima kuasa</FieldLabel>
                <input
                  aria-describedby={errors.proxy_name ? "proxy_name-error" : undefined}
                  aria-invalid={Boolean(errors.proxy_name)}
                  className={`${styles.input} ${errors.proxy_name ? styles.inputError : ""}`}
                  id="proxy_name"
                  maxLength={100}
                  name="proxy_name"
                  onChange={(event) => updateField("proxy_name", event.target.value)}
                  required
                  type="text"
                  value={formData.proxy_name}
                />
                {errors.proxy_name ? (
                  <FieldError id="proxy_name-error" message={errors.proxy_name} />
                ) : null}
              </div>
              <div className={styles.field}>
                <FieldLabel htmlFor="proxy_position">
                  Jabatan penerima kuasa
                </FieldLabel>
                <input
                  aria-describedby={
                    errors.proxy_position ? "proxy_position-error" : undefined
                  }
                  aria-invalid={Boolean(errors.proxy_position)}
                  className={`${styles.input} ${errors.proxy_position ? styles.inputError : ""}`}
                  id="proxy_position"
                  maxLength={100}
                  name="proxy_position"
                  onChange={(event) =>
                    updateField("proxy_position", event.target.value)
                  }
                  required
                  type="text"
                  value={formData.proxy_position}
                />
                {errors.proxy_position ? (
                  <FieldError
                    id="proxy_position-error"
                    message={errors.proxy_position}
                  />
                ) : null}
              </div>
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <FieldLabel htmlFor="authorization_file">
                  Upload Surat Kuasa
                </FieldLabel>
                <input
                  accept=".doc,.docx,.pdf,.png,.jpg,.jpeg"
                  aria-describedby={
                    errors.authorization_file
                      ? "authorization_file-error"
                      : "authorization_file-help"
                  }
                  aria-invalid={Boolean(errors.authorization_file)}
                  className={`${styles.input} ${styles.fileInput} ${errors.authorization_file ? styles.inputError : ""}`}
                  id="authorization_file"
                  name="authorization_file"
                  onChange={(event) =>
                    updateField("authorization_file", event.target.files?.[0] ?? null)
                  }
                  ref={fileInputRef}
                  required
                  type="file"
                />
                <p className={styles.helper} id="authorization_file-help">
                   Format .doc, .docx, .pdf, .png, .jpg, atau .jpeg. Ukuran maksimal 2 MB (2.097.152 bytes).
                </p>
                {errors.authorization_file ? (
                  <FieldError
                    id="authorization_file-error"
                    message={errors.authorization_file}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className={styles.submitArea}>
        <button className={styles.submitButton} disabled={isPending} type="submit">
          {isPending ? "Mengirim..." : "Kirim Formulir"}
        </button>
        <p className={styles.submitHint}>
          Pastikan seluruh data yang diisi sudah benar sebelum dikirimkan.
        </p>
      </div>
    </form>
  );
}
