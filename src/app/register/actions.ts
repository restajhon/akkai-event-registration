"use server";

import { AKKAI_EVENT } from "@/lib/akkai-event";
import type { RegistrationActionState } from "@/lib/registration/registration-action-state";
import {
  getRegistrationFieldErrors,
  registrationSchema,
  type RegistrationFormValues,
} from "@/lib/validation/registration";
import { createAdminClient } from "@/lib/supabase/admin";

const GENERAL_ERROR =
  "Terjadi kendala saat memproses pendaftaran. Silakan coba kembali.";
const DUPLICATE_EMAIL_ERROR =
  "Email ini sudah terdaftar. Silakan cek email konfirmasi sebelumnya atau hubungi panitia.";
const DUPLICATE_MEMBER_NUMBER_ERROR =
  "Nomor anggota ini sudah terdaftar. Silakan cek kembali data Anda atau hubungi panitia.";
const REGISTRATION_CLOSED_ERROR = "Periode registrasi telah ditutup.";

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): RegistrationFormValues {
  const privacyConsent = formData.get("privacy_consent");

  return {
    full_name: getFormValue(formData, "full_name"),
    email: getFormValue(formData, "email"),
    phone_number: getFormValue(formData, "phone_number"),
    institution: getFormValue(formData, "institution"),
    participant_category: getFormValue(formData, "participant_category"),
    member_number: getFormValue(formData, "member_number"),
    privacy_consent: privacyConsent === "on" || privacyConsent === "true",
  };
}

function stateWithGeneralError(generalError: string): RegistrationActionState {
  return {
    status: "general-error",
    fieldErrors: {},
    generalError,
  };
}

function errorContainsConstraint(error: unknown, constraintName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const databaseError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return [databaseError.message, databaseError.details, databaseError.hint].some(
    (value) =>
      typeof value === "string" && value.includes(constraintName),
  );
}

function getDatabaseErrorState(error: unknown): RegistrationActionState {
  const databaseError =
    error && typeof error === "object"
      ? (error as { code?: unknown })
      : {};

  if (
    databaseError.code === "23505" &&
    errorContainsConstraint(error, "participants_email_lower_unique")
  ) {
    return {
      status: "duplicate-email",
      fieldErrors: {},
      generalError: DUPLICATE_EMAIL_ERROR,
    };
  }

  if (
    databaseError.code === "23505" &&
    errorContainsConstraint(error, "participants_member_number_upper_unique")
  ) {
    return {
      status: "duplicate-member-number",
      fieldErrors: {},
      generalError: DUPLICATE_MEMBER_NUMBER_ERROR,
    };
  }

  return stateWithGeneralError(GENERAL_ERROR);
}

export async function submitRegistration(
  previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  void previousState;

  if (!AKKAI_EVENT.registrationOpen) {
    return stateWithGeneralError(REGISTRATION_CLOSED_ERROR);
  }

  const parsed = registrationSchema.safeParse(getFormValues(formData));

  if (!parsed.success) {
    return {
      status: "validation-error",
      fieldErrors: getRegistrationFieldErrors(parsed.error),
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("participants")
      .insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone_number: parsed.data.phone_number,
        institution: parsed.data.institution,
        participant_category: parsed.data.participant_category,
        member_number: parsed.data.member_number,
        privacy_consent_at: new Date().toISOString(),
      })
      .select("registration_id")
      .single();

    if (error || !data?.registration_id) {
      return getDatabaseErrorState(error);
    }

    return {
      status: "submitted",
      fieldErrors: {},
      registrationId: data.registration_id,
    };
  } catch {
    return stateWithGeneralError(GENERAL_ERROR);
  }
}
