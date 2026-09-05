import { redirect } from "next/navigation";

import { getDefaultAdminRoute } from "@/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export default async function AdminPage() {
  const profile = await requireAuthenticatedUser();

  redirect(getDefaultAdminRoute(profile.role));
}
