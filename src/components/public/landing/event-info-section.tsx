import { AKKAI_EVENT } from "@/lib/akkai-event";

import { CornerOrnament, GoldDivider } from "./ornaments";

export function EventInfoSection() {
  const infoItems = [
    { label: "Tanggal Acara", value: AKKAI_EVENT.date },
    { label: "Lokasi", value: AKKAI_EVENT.venue },
    { label: AKKAI_EVENT.arrivalDate, value: "Registrasi Kedatangan" },
    { label: AKKAI_EVENT.seminarDate, value: "Seminar AKKAI 2026" },
    { label: AKKAI_EVENT.day3Date, value: "Registrasi Kepulangan" },
  ];

  return (
    <section
      className="bg-[#fffdf9] px-4 py-20 sm:px-6 lg:px-8"
      id="informasi"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="font-serif text-4xl font-bold text-[#082b5a]">
            Informasi Acara
          </h2>
          <div className="mx-auto mb-4 mt-5 flex justify-center">
            <GoldDivider className="w-16" />
          </div>
          <p className="text-[#667085]">
            Detail lengkap mengenai {AKKAI_EVENT.name}.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {infoItems.map((item) => (
            <div
              className="relative min-h-36 bg-[#fcf9f2] p-6 text-center ring-1 ring-[#c79a35]/40 transition-transform hover:-translate-y-1"
              key={item.label}
            >
              <CornerOrnament position="tr" />
              <p className="mb-4 text-sm font-medium text-[#667085]">{item.label}</p>
              <p className="font-serif text-xl font-bold text-[#082b5a]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
