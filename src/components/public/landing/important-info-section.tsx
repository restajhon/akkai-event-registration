import { IMPORTANT_INFO } from "@/lib/akkai-event";

export function ImportantInfoSection() {
  return (
    <section className="bg-[#fffdf9] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12">
          <h2 className="font-serif text-4xl font-bold text-[#082b5a]">
            Informasi Penting
          </h2>
          <div className="mb-4 mt-5 h-px w-10 bg-[#c79a35]/60" />
          <p className="text-[#667085]">
            Harap perhatikan poin-poin berikut sebelum melakukan registrasi.
          </p>
        </div>

        <div className="space-y-4">
          {IMPORTANT_INFO.map((info) => (
            <div
              className="flex gap-4 bg-[#fcf9f2] p-5 ring-1 ring-[#c79a35]/30 transition-shadow hover:shadow-sm"
              key={info}
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c79a35] text-sm font-bold text-[#082b5a]"
              >
                ✓
              </span>
              <p className="leading-6 text-[#263246]">{info}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
