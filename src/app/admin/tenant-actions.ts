"use server";

import { revalidatePath } from "next/cache";

import { setActiveEventForCurrentUser } from "@/lib/tenant/server-context";

export async function selectActiveEvent(formData: FormData) {
  const eventIdValue = formData.get("eventId");
  if (typeof eventIdValue !== "string" || !(await setActiveEventForCurrentUser(eventIdValue))) {
    return;
  }

  revalidatePath("/admin");
}
