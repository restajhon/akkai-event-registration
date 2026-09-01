import { AKKAI_EVENT } from "@/lib/akkai-event";

import { GoldDivider } from "./ornaments";

export function GeneralEventRundown() {
  return (
    <section
      aria-labelledby="general-rundown-title"
      className="bg-[#fcf9f2] px-4 py-20 sm:px-6 lg:px-8"
      id="rundown"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2
            className="font-serif text-4xl font-bold text-[#082b5a]"
            id="general-rundown-title"
          >
            Rundown Acara
          </h2>
          <div className="mx-auto mb-4 mt-5 flex justify-center">
            <GoldDivider className="w-16" />
          </div>
          <p className="text-[#667085]">
            Rangkaian acara AKKAI 2026 selama tiga hari.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {AKKAI_EVENT.generalRundown.map((day) => (
            <article
              className="border-l-4 border-[#c79a35] bg-[#fffdf9] p-6 ring-1 ring-[#c79a35]/30"
              key={day.day}
            >
              <h3 className="font-serif text-2xl font-bold text-[#082b5a]">
                {day.day}
              </h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 leading-6 text-[#667085]">
                {day.items.map((item, itemIndex) => (
                  <li key={`${day.day}-${itemIndex}`}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
