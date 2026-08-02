import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";

type RegistrationLinkProps = {
  className?: string;
};

export function RegistrationLink({ className = "" }: RegistrationLinkProps) {
  if (!AKKAI_EVENT.registrationOpen) {
    return (
      <span aria-disabled="true" className={className}>
        Registrasi Telah Ditutup
      </span>
    );
  }

  return (
    <Link className={className} href="/register">
      Daftar Sekarang
    </Link>
  );
}
