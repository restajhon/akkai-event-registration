import { AKKAI_EVENT } from "@/lib/akkai-event";

import { RegistrationLink } from "./registration-link";

export function RegistrationCTA() {
  return (
    <section className="relative overflow-hidden bg-[#082b5a] px-4 py-24 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#c79a35]/70" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#ddbb6a]">
          Pendaftaran Peserta
        </p>
        <h2 className="font-serif text-4xl font-bold text-[#fffdf9] sm:text-5xl">
          Siap mengikuti {AKKAI_EVENT.name}?
        </h2>
        <div className="mx-auto mb-6 mt-7 h-px w-16 bg-[#c79a35]" />
        <p className="mb-10 text-lg leading-8 text-[#cbd5e1]">
          Selesaikan registrasi Anda dan dapatkan kode QR unik untuk rangkaian
          acara di {AKKAI_EVENT.venue}.
        </p>
        <RegistrationLink className="inline-flex rounded bg-[#c79a35] px-6 py-3 text-sm font-semibold text-[#082b5a] transition-all hover:bg-[#ddbb6a] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fffdf9]" />
      </div>
    </section>
  );
}
