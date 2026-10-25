import type { RegistrationFormAnswer } from "@/lib/admin/form-answer-data";

export function ParticipantFormAnswers({ answers }: { answers: RegistrationFormAnswer[] }) {
  if (answers.length === 0) return null;

  return (
    <section
      aria-labelledby="participant-form-answers-heading"
      className="mt-4 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold text-[#142842]" id="participant-form-answers-heading">
        Jawaban Formulir Tambahan
      </h2>
      <p className="mt-1 text-xs text-[#5b6c7c]">
        Tersimpan menggunakan versi formulir v{answers[0].versionNumber}.
      </p>
      <dl className="mt-3 divide-y divide-[#eee6d8]">
        {answers.map((answer) => (
          <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-4" key={answer.key}>
            <dt className="text-xs font-medium text-[#5b6c7c]">{answer.label}</dt>
            <dd className="break-words text-sm font-semibold text-[#142842] sm:text-right">{answer.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
