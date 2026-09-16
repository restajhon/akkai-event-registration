import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ParticipantTicketData } from "./participant-ticket";

export async function loadParticipantTicketData(registrationId: string): Promise<ParticipantTicketData | null> {
  const supabase = createAdminClient();
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, registration_id, full_name, email, phone_number, kka_name, package_type, participation_scope, actuarial_consultant_status, attends_pai_congress, qr_token")
    .eq("registration_id", registrationId)
    .maybeSingle();
  if (participantError || !participant) return null;

  const { data: billing, error: billingError } = await supabase
    .from("registration_billings")
    .select("billing_number, amount, payment_status")
    .eq("participant_id", participant.id)
    .maybeSingle();
  if (billingError) return null;

  return {
    fullName: participant.full_name,
    registrationId: participant.registration_id,
    email: participant.email,
    phoneNumber: participant.phone_number,
    kkaName: participant.kka_name,
    packageType: participant.package_type,
    participationScope: participant.participation_scope,
    actuarialConsultantStatus: participant.actuarial_consultant_status,
    attendsPaiCongress: participant.attends_pai_congress,
    billingNumber: billing?.billing_number ?? null,
    billingAmount: billing?.amount ?? null,
    paymentStatus: billing?.payment_status ?? null,
    qrToken: participant.qr_token,
  };
}
