import Link from "next/link";

import { AKKAI_EVENT } from "@/lib/akkai-event";

import { RegistrationLink } from "./registration-link";

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#c79a35] bg-[#fffdf9]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          aria-label="Kembali ke halaman utama"
          className="flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c79a35]"
          href="/"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded bg-[#082b5a] text-xs font-bold text-[#fffdf9]">
            AK
          </span>
          <span className="font-serif text-lg font-semibold text-[#082b5a]">
            {AKKAI_EVENT.shortName}
          </span>
        </Link>

        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-8 sm:flex"
        >
          <Link
            className="rounded text-sm font-medium text-[#263246] underline-offset-4 transition-colors hover:text-[#082b5a] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c79a35]"
            href="#informasi"
          >
            Informasi Acara
          </Link>
        </nav>

        <RegistrationLink className="rounded bg-[#082b5a] px-4 py-2 text-sm font-medium text-[#fffdf9] transition-colors hover:bg-[#041d3d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c79a35]" />
      </div>
    </header>
  );
}
