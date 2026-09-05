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
          {AKKAI_EVENT.participantRundown.map((day) => (
            <article
              className="border-l-4 border-[#c79a35] bg-[#fffdf9] p-6 ring-1 ring-[#c79a35]/30"
              key={day.day}
            >
                <h3 className="font-serif text-2xl font-bold text-[#082b5a]">{day.day}</h3>
                <p className="mt-1 text-sm font-semibold text-[#c79a35]">{day.date}</p>
                <ul className="mt-5 space-y-3 leading-6 text-[#667085]">
                  {day.items.map((item) => (
                    <li className="grid gap-1 border-b border-[#c79a35]/15 pb-3 last:border-0 last:pb-0 sm:grid-cols-[7.5rem_1fr]" key={`${day.day}-${item.time}-${item.title}`}>
                      <span className="font-semibold text-[#082b5a]">{item.time}</span>
                      <span>{item.title}</span>
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
