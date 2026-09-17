"use server";

import { z } from "zod";

import { getAuthorizedProfile } from "@/lib/auth/server";

import { loadParticipantPage } from "./participant-data";
import type { ParticipantPageData } from "./participant-page-data";

const pageSchema = z.coerce.number().int().min(1).catch(1);
const billingStatusSchema = z.enum(["all", "PAID", "UNPAID"]).catch("all");

export type ParticipantSearchState = {
  data: ParticipantPageData;
  message: string | null;
};

function normalizeSearchQuery(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

export async function searchParticipants(
  previousState: ParticipantSearchState,
  formData: FormData,
): Promise<ParticipantSearchState> {
  if (!(await getAuthorizedProfile("participants.view"))) {
    return {
      ...previousState,
      message: "Anda tidak memiliki akses untuk melihat peserta.",
    };
  }

  const query = formData.get("reset") === "true"
    ? ""
    : normalizeSearchQuery(formData.get("query"));
  const requestedPage = pageSchema.parse(formData.get("page"));
  const billingStatus = billingStatusSchema.parse(formData.get("billingStatus"));
  const rawBatchCode = formData.get("batchCode");
  const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim().slice(0, 30) : "all";
  const data = await loadParticipantPage(query, requestedPage, billingStatus, batchCode || "all");

  if (!data) {
    return {
      ...previousState,
      message: "Data peserta belum dapat dimuat. Silakan coba kembali.",
    };
  }

  return {
    data,
    message: null,
  };
}
