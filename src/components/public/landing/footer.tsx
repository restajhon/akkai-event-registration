import { AKKAI_EVENT } from "@/lib/akkai-event";

import { SemarangSkylineSvg } from "./ornaments";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t-2 border-[#c79a35] bg-[#082b5a] px-4 pb-8 pt-16 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-10 grid gap-10 sm:grid-cols-2">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#fffdf9]">
              {AKKAI_EVENT.name}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#cbd5e1]">
              Diselenggarakan oleh {AKKAI_EVENT.organizer}.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-[#fffdf9]">
              Didukung oleh
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#cbd5e1]">
              {AKKAI_EVENT.eventHandler}
            </p>
          </div>
        </div>

        <div className="border-t border-[#c79a35]/30 pt-6">
          <p className="text-center text-xs leading-5 text-[#cbd5e1]">
            Data yang dikirimkan hanya digunakan untuk kebutuhan registrasi dan
            administrasi acara.
          </p>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-24"
      >
        <SemarangSkylineSvg />
      </div>
    </footer>
  );
}
