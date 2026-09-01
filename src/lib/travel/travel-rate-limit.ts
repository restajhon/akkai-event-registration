import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitResult = "allowed" | "limited" | "unavailable";

function hashLimiterKey(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function getClientAddress(requestHeaders: Headers) {
  const forwardedAddress = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return (
    forwardedAddress || requestHeaders.get("x-real-ip")?.trim() || "unknown"
  );
}

export async function consumeTravelRateLimit(
  supabase: ReturnType<typeof createAdminClient>,
  registrationId: string,
  email: string,
): Promise<RateLimitResult> {
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    return "unavailable";
  }

  const requestHeaders = await headers();
  const clientAddress = getClientAddress(requestHeaders);
  const keyHashes = [
    hashLimiterKey(secret, `identity:${registrationId}:${email}`),
    hashLimiterKey(secret, `ip:${clientAddress}`),
  ];
  const { data, error } = await supabase.rpc(
    "consume_participant_travel_rate_limit",
    { p_key_hashes: keyHashes },
  );

  if (error) {
    return "unavailable";
  }

  return data === true ? "allowed" : "limited";
}
