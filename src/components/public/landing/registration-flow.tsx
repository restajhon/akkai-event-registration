import { AKKAI_EVENT, REGISTRATION_STEPS } from "@/lib/akkai-event";

export function RegistrationFlow() {
  return (
    <section className="bg-[#fcf9f2] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="font-serif text-4xl font-bold text-[#082b5a]">
            Alur Registrasi
          </h2>
          <div className="mx-auto mb-4 mt-5 h-px w-16 bg-[#c79a35]/60" />
          <p className="text-[#667085]">
            Empat langkah sederhana untuk menyelesaikan registrasi.
          </p>
        </div>

        <div className="mb-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {REGISTRATION_STEPS.map((step, index) => (
            <div className="relative flex flex-col" key={step.number}>
              <div className="mb-6 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#082b5a] font-serif text-lg font-bold text-[#fffdf9] ring-8 ring-[#c79a35]/10">
                  {step.number}
                </div>
              </div>
              <h3 className="mb-3 text-center font-serif text-xl font-semibold text-[#082b5a]">
                {step.title}
              </h3>
              <p className="flex-grow text-center text-sm leading-6 text-[#667085]">
                {step.description}
              </p>
              {index < REGISTRATION_STEPS.length - 1 ? (
                <div
                  aria-hidden="true"
                  className="absolute -bottom-7 left-1/2 hidden h-px w-20 -translate-x-1/2 bg-[#c79a35]/40 lg:block"
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="border-t-4 border-[#c79a35] bg-[#fffdf9] p-8 shadow-sm">
          <h3 className="font-serif text-2xl font-bold text-[#082b5a]">
            Kegunaan Kode QR
          </h3>
          <div className="mb-4 mt-4 h-px w-10 bg-[#c79a35]/60" />
          <p className="mb-4 leading-7 text-[#667085]">
            Kode QR yang Anda terima akan digunakan untuk tiga sesi acara:
          </p>
          <ul className="grid gap-3 text-[#667085] sm:grid-cols-2">
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="text-lg text-[#c79a35]">
                •
              </span>
              <span>Registrasi Kedatangan — {AKKAI_EVENT.arrivalDate}</span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="text-lg text-[#c79a35]">
                •
              </span>
              <span>Seminar AKKAI 2026 — {AKKAI_EVENT.seminarDate}</span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="text-lg text-[#c79a35]">
                •
              </span>
               <span>Registrasi Kepulangan — {AKKAI_EVENT.day3Date}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
