import { hasPermission } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/server";

export type ParticipantActionVisibility = {
  canDownloadTicket: boolean;
  canEdit: boolean;
  canExport: boolean;
  canResendEmail: boolean;
  canUpdateBilling: boolean;
};

export function getParticipantActionVisibility(role: UserRole): ParticipantActionVisibility {
  return {
    canDownloadTicket: hasPermission(role, "participants.view"),
    canEdit: hasPermission(role, "participants.edit"),
    canExport: hasPermission(role, "participants.export"),
    canResendEmail: hasPermission(role, "participants.email"),
    canUpdateBilling: hasPermission(role, "participants.manage"),
  };
}

export function canChangeRegistrationStatus(role: UserRole) {
  return hasPermission(role, "participants.cancel");
}

export function canRestoreParticipantRegistration(role: UserRole) {
  return hasPermission(role, "participants.restore");
}
