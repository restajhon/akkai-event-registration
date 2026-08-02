import { AKKAI_EVENT } from "@/lib/akkai-event";

import { CurvedPanel, GoldDivider } from "./ornaments";
import { RegistrationLink } from "./registration-link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#fcf9f2] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
      <CurvedPanel />

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#c79a35]">
          Rapat Tahunan
        </p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-[#082b5a] sm:text-5xl lg:text-6xl">
          {AKKAI_EVENT.name}
        </h1>

        <div className="mx-auto mb-8 mt-7 flex max-w-20 justify-center">
          <GoldDivider className="w-16" />
        </div>

        <p className="mx-auto mb-10 max-w-2xl text-base leading-7 text-[#667085] sm:text-lg">
          Lakukan registrasi secara online dan terima kode QR unik melalui email
          untuk proses verifikasi kehadiran.
        </p>

        <div className="mb-12 flex flex-col items-center justify-center gap-7 sm:flex-row sm:gap-10">
          <div className="text-center">
            <p className="mb-2 text-sm font-medium text-[#667085]">Tanggal</p>
            <p className="font-serif text-xl font-semibold text-[#082b5a]">
              {AKKAI_EVENT.date}
            </p>
          </div>
          <div
            aria-hidden="true"
            className="hidden h-12 w-px bg-[#c79a35]/40 sm:block"
          />
          <div className="text-center">
            <p className="mb-2 text-sm font-medium text-[#667085]">Lokasi</p>
            <p className="font-serif text-xl font-semibold text-[#082b5a]">
              {AKKAI_EVENT.location}
            </p>
          </div>
        </div>

        <RegistrationLink className="inline-flex rounded bg-[#082b5a] px-6 py-3 text-sm font-semibold text-[#fffdf9] shadow-sm transition-all hover:bg-[#041d3d] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c79a35]" />
      </div>
    </section>
  );
}
