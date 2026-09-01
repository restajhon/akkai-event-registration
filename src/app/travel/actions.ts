"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeTravelRateLimit,
} from "@/lib/travel/travel-rate-limit";
import {
  getTravelFieldErrors,
  travelSchema,
  type TravelFormValues,
} from "@/lib/validation/travel";
import type { TravelActionState } from "@/lib/travel/travel-action-state";

const GENERIC_IDENTITY_ERROR =
  "Data peserta tidak dapat diverifikasi. Periksa kembali Registration ID dan email yang terdaftar.";
const GENERAL_ERROR =
  "Terjadi kendala saat menyimpan informasi perjalanan. Silakan coba kembali.";
const RATE_LIMIT_ERROR =
  "Terlalu banyak percobaan. Silakan coba kembali beberapa saat lagi.";

type TravelUpsertResult = {
  result_code: string;
};

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): TravelFormValues {
  const extendStay = formData.get("extend_stay");

  return {
    registration_id: getFormValue(formData, "registration_id"),
    registered_email: getFormValue(formData, "registered_email"),
    outbound_date: getFormValue(formData, "outbound_date"),
    outbound_time: getFormValue(formData, "outbound_time"),
    outbound_transport_mode: getFormValue(
      formData,
      "outbound_transport_mode",
    ),
    outbound_transport_number: getFormValue(
      formData,
      "outbound_transport_number",
    ),
    outbound_origin: getFormValue(formData, "outbound_origin"),
    outbound_destination: getFormValue(formData, "outbound_destination"),
    return_date: getFormValue(formData, "return_date"),
    return_time: getFormValue(formData, "return_time"),
    return_transport_mode: getFormValue(formData, "return_transport_mode"),
    return_transport_number: getFormValue(
      formData,
      "return_transport_number",
    ),
    return_destination: getFormValue(formData, "return_destination"),
    extend_stay:
      extendStay === "true" ? true : extendStay === "false" ? false : undefined,
  };
}

function errorState(
  status: Extract<TravelActionState["status"], "general-error" | "rate-limited">,
  generalError: string,
): TravelActionState {
  return {
    status,
    fieldErrors: {},
    generalError,
  };
}

export async function submitTravel(
  previousState: TravelActionState,
  formData: FormData,
): Promise<TravelActionState> {
  void previousState;

  const parsed = travelSchema.safeParse(getFormValues(formData));

  if (!parsed.success) {
    return {
      status: "validation-error",
      fieldErrors: getTravelFieldErrors(parsed.error),
    };
  }

  try {
    const supabase = createAdminClient();
    const rateLimitResult = await consumeTravelRateLimit(
      supabase,
      parsed.data.registration_id,
      parsed.data.registered_email,
    );

    if (rateLimitResult === "limited") {
      return errorState("rate-limited", RATE_LIMIT_ERROR);
    }

    if (rateLimitResult === "unavailable") {
      return errorState("general-error", GENERAL_ERROR);
    }

    const { data, error } = await supabase.rpc("upsert_participant_travel", {
      p_registration_id: parsed.data.registration_id,
      p_registered_email: parsed.data.registered_email,
      p_outbound_date: parsed.data.outbound_date,
      p_outbound_time: parsed.data.outbound_time,
      p_outbound_transport_mode: parsed.data.outbound_transport_mode,
      p_outbound_transport_number: parsed.data.outbound_transport_number,
      p_outbound_origin: parsed.data.outbound_origin,
      p_outbound_destination: parsed.data.outbound_destination,
      p_return_date: parsed.data.return_date,
      p_return_time: parsed.data.return_time,
      p_return_transport_mode: parsed.data.return_transport_mode,
      p_return_transport_number: parsed.data.return_transport_number,
      p_return_destination: parsed.data.return_destination,
      p_extend_stay: parsed.data.extend_stay,
    });

    if (error || !data) {
      return errorState("general-error", GENERAL_ERROR);
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | TravelUpsertResult
      | undefined;

    if (result?.result_code === "INVALID_IDENTITY") {
      return errorState("general-error", GENERIC_IDENTITY_ERROR);
    }

    if (result?.result_code !== "SAVED") {
      return errorState("general-error", GENERAL_ERROR);
    }

    return {
      status: "saved",
      fieldErrors: {},
    };
  } catch {
    return errorState("general-error", GENERAL_ERROR);
  }
}
