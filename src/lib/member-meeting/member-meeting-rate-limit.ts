import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

type MemberMeetingRateLimitResult = "allowed" | "limited" | "unavailable";

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

export async function consumeMemberMeetingRateLimit(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<MemberMeetingRateLimitResult> {
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    return "unavailable";
  }

  const requestHeaders = await headers();
  const clientAddress = getClientAddress(requestHeaders);
  const keyHashes = [
    hashLimiterKey(secret, `ip:${clientAddress}`),
    hashLimiterKey(secret, `identity:${email}`),
  ];
  const { data, error } = await supabase.rpc(
    "consume_member_meeting_rate_limit",
    { p_key_hashes: keyHashes },
  );

  if (error) {
    return "unavailable";
  }

  return data === true ? "allowed" : "limited";
}
