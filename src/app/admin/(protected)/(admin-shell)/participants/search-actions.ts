"use server";

import { z } from "zod";

import { requireRole } from "@/lib/auth/server";

import { loadParticipantPage } from "./participant-data";
import type { ParticipantPageData } from "./participant-page-data";

const pageSchema = z.coerce.number().int().min(1).catch(1);

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
  await requireRole(["ADMIN"]);

  const query = formData.get("reset") === "true"
    ? ""
    : normalizeSearchQuery(formData.get("query"));
  const requestedPage = pageSchema.parse(formData.get("page"));
  const data = await loadParticipantPage(query, requestedPage);

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
