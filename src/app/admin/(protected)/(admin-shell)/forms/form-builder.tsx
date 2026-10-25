"use client";

import { useState, useTransition } from "react";

import {
  FORM_BUILDER_FIELD_TYPES,
  type RegistrationFormConfig,
  type RegistrationFormField,
  type RegistrationFormFieldType,
} from "@/lib/forms/form-schema";

import { publishRegistrationFormDraft, saveRegistrationFormDraft, setEventRegistrationOpen } from "./actions";

type Props = { initialConfig: RegistrationFormConfig; publishedVersion: number | null; registrationOpen: boolean };

function ordered<T extends { position: number }>(items: T[]) {
  return [...items].sort((left, right) => left.position - right.position);
}

function normalizePositions(config: RegistrationFormConfig, sectionId: string, fields: RegistrationFormField[]) {
  const inSection = ordered(fields.filter((field) => field.sectionId === sectionId));
  const position = new Map(inSection.map((field, index) => [field.id, index + 1]));
  return {
    ...config,
    fields: fields.map((field) => position.has(field.id) ? { ...field, position: position.get(field.id)! } : field),
  };
}

function FormPreview({ config }: { config: RegistrationFormConfig }) {
  return (
    <div className="rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7526]">Pratinjau formulir publik</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#142842]">{config.title}</h2>
      {config.instructions ? <p className="mt-2 text-sm text-[#5b6c7c]">{config.instructions}</p> : null}
      <div className="mt-6 grid gap-5">
        {ordered(config.sections).map((section) => {
          const fields = ordered(config.fields.filter((field) => field.sectionId === section.id));
          if (fields.length === 0) return null;
          return (
            <section className="rounded-xl border border-[#eee6d8] p-4" key={section.id}>
              <h3 className="font-semibold text-[#142842]">{section.title}</h3>
              {section.description ? <p className="mt-1 text-sm text-[#657181]">{section.description}</p> : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div className="grid gap-1" key={field.id}>
                    <span className="text-sm font-medium text-[#344d68]">
                      {field.label}{field.required ? <span className="ml-1 text-[#9b3d31]">*</span> : null}
                    </span>
                    {field.type === "checkbox" ? (
                      <span className="min-h-10 rounded-md border border-[#d8cfbf] px-3 py-2 text-xs text-[#77808a]">☐ {field.label}</span>
                    ) : field.type === "select" || field.type === "radio" ? (
                      <span className="min-h-10 rounded-md border border-[#d8cfbf] px-3 py-2 text-xs text-[#77808a]">{field.options?.join(" · ")}</span>
                    ) : (
                      <span className="min-h-10 rounded-md border border-[#d8cfbf] px-3 py-2 text-xs text-[#77808a]">
                        {field.type === "file" ? "Pilih dokumen" : field.placeholder || `Jawaban ${field.label.toLowerCase()}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function FormBuilder({ initialConfig, publishedVersion, registrationOpen }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(registrationOpen);
  const [hasPublishedVersion, setHasPublishedVersion] = useState(publishedVersion !== null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateSection(sectionId: string, patch: Partial<RegistrationFormConfig["sections"][number]>) {
    setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) }));
    setSaved(false);
  }

  function updateField(fieldId: string, patch: Partial<RegistrationFormField>) {
    setConfig((current) => ({ ...current, fields: current.fields.map((field) => field.id === fieldId ? { ...field, ...patch } as RegistrationFormField : field) }));
    setSaved(false);
  }

  function moveField(sectionId: string, fieldId: string, direction: -1 | 1) {
    setConfig((current) => {
      const sectionFields = ordered(current.fields.filter((field) => field.sectionId === sectionId));
      const index = sectionFields.findIndex((field) => field.id === fieldId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sectionFields.length) return current;
      [sectionFields[index], sectionFields[nextIndex]] = [sectionFields[nextIndex], sectionFields[index]];
      const inSectionPosition = new Map(sectionFields.map((field, itemIndex) => [field.id, itemIndex + 1]));
      setSaved(false);
      return { ...current, fields: current.fields.map((field) => inSectionPosition.has(field.id) ? { ...field, position: inSectionPosition.get(field.id)! } : field) };
    });
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setConfig((current) => {
      const sections = ordered(current.sections);
      const index = sections.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return current;
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      setSaved(false);
      return { ...current, sections: sections.map((section, itemIndex) => ({ ...section, position: itemIndex + 1 })) };
    });
  }

  function addSection() {
    setConfig((current) => {
      let index = current.sections.length + 1;
      let id = `bagian-${index}`;
      while (current.sections.some((section) => section.id === id)) id = `bagian-${++index}`;
      setSaved(false);
      return { ...current, sections: [...current.sections, { id, title: `Bagian ${index}`, description: "", position: current.sections.length + 1 }] };
    });
  }

  function removeSection(sectionId: string) {
    setConfig((current) => {
      if (current.sections.length <= 1 || current.fields.some((field) => field.system && field.sectionId === sectionId)) return current;
      const sections = ordered(current.sections.filter((section) => section.id !== sectionId));
      const destination = sections[0];
      const fields = current.fields.map((field) => field.sectionId === sectionId ? { ...field, sectionId: destination.id } : field);
      setSaved(false);
      return normalizePositions({ ...current, sections: sections.map((section, index) => ({ ...section, position: index + 1 })), fields }, destination.id, fields);
    });
  }

  function addField() {
    setConfig((current) => {
      const section = ordered(current.sections)[0];
      const base = `field_${current.fields.length + 1}`;
      let key = base;
      let suffix = 1;
      while (current.fields.some((field) => field.key === key)) key = `${base}_${suffix++}`;
      setSaved(false);
      return {
        ...current,
        fields: [...current.fields, {
          id: key,
          key,
          type: "text",
          label: "Field baru",
          placeholder: "",
          required: false,
          sectionId: section.id,
          position: current.fields.filter((field) => field.sectionId === section.id).length + 1,
        }],
      };
    });
  }

  function removeField(fieldId: string) {
    setConfig((current) => {
      const field = current.fields.find((item) => item.id === fieldId);
      if (!field || field.system) return current;
      const fields = current.fields.filter((item) => item.id !== fieldId);
      setSaved(false);
      return normalizePositions(current, field.sectionId, fields);
    });
  }

  function runSave() {
    startTransition(async () => {
      const result = await saveRegistrationFormDraft(JSON.stringify(config));
      setNotice(result.message);
      setSaved(result.success);
    });
  }

  function runPublish() {
    startTransition(async () => {
      if (!saved) {
        const saveResult = await saveRegistrationFormDraft(JSON.stringify(config));
        if (!saveResult.success) {
          setNotice(saveResult.message);
          return;
        }
      }
      const result = await publishRegistrationFormDraft();
      setNotice(result.message);
       if (result.success) {
         setSaved(true);
         setHasPublishedVersion(true);
       }
    });
  }

  function runRegistrationToggle() {
    startTransition(async () => {
      const result = await setEventRegistrationOpen(!isRegistrationOpen);
      setNotice(result.message);
      if (result.success) setIsRegistrationOpen(!isRegistrationOpen);
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7526]">Form Builder</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#142842]">Atur formulir pendaftaran event</h1>
          <p className="mt-1 text-sm text-[#667386]">Versi publik aktif: {publishedVersion ? `v${publishedVersion}` : hasPublishedVersion ? "versi baru diterbitkan" : "belum diterbitkan"}. Draft tidak terlihat oleh pendaftar.</p>
          <p className="mt-1 text-sm text-[#667386]">Status pendaftaran: <strong>{isRegistrationOpen ? "Dibuka" : "Ditutup"}</strong></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-10 rounded-lg border border-[#c8b58d] px-4 text-sm font-semibold text-[#725a27] hover:bg-[#faf4e7]" onClick={() => setPreview((value) => !value)} type="button">{preview ? "Kembali mengedit" : "Pratinjau"}</button>
          <button className="min-h-10 rounded-lg border border-[#142842] px-4 text-sm font-semibold text-[#142842] disabled:opacity-50" disabled={isPending} onClick={runSave} type="button">{isPending ? "Menyimpan…" : "Simpan draft"}</button>
          <button className="min-h-10 rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={isPending} onClick={runPublish} type="button">Terbitkan</button>
          <button className="min-h-10 rounded-lg border border-[#d8cfbf] px-4 text-sm font-semibold text-[#344d68] disabled:opacity-50" disabled={isPending || (!isRegistrationOpen && !hasPublishedVersion)} onClick={runRegistrationToggle} type="button">{isRegistrationOpen ? "Tutup registrasi" : "Buka registrasi"}</button>
        </div>
      </div>

      {notice ? <p className={`rounded-lg border p-3 text-sm ${saved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#ead3cc] bg-[#fff5f2] text-[#9b3d31]"}`} role="status">{notice}</p> : null}

      {preview ? <FormPreview config={config} /> : (
        <div className="grid gap-5">
          <section className="grid gap-4 rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5">
            <label className="grid gap-1 text-sm font-semibold text-[#344d68]">Judul formulir
              <input className="min-h-11 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" maxLength={200} onChange={(event) => { setConfig((current) => ({ ...current, title: event.target.value })); setSaved(false); }} value={config.title} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[#344d68]">Instruksi
              <textarea className="min-h-24 rounded-lg border border-[#d8cfbf] bg-white px-3 py-2 font-normal" maxLength={2000} onChange={(event) => { setConfig((current) => ({ ...current, instructions: event.target.value })); setSaved(false); }} value={config.instructions} />
            </label>
          </section>

          {ordered(config.sections).map((section, sectionIndex) => {
            const fields = ordered(config.fields.filter((field) => field.sectionId === section.id));
            return (
              <section className="grid gap-4 rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5" key={section.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold text-[#344d68]">Bagian
                      <input className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" maxLength={120} onChange={(event) => updateSection(section.id, { title: event.target.value })} value={section.title} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-[#344d68]">Instruksi bagian
                      <input className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" maxLength={500} onChange={(event) => updateSection(section.id, { description: event.target.value })} value={section.description ?? ""} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button aria-label="Pindahkan bagian ke atas" className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40" disabled={sectionIndex === 0} onClick={() => moveSection(section.id, -1)} type="button">↑</button>
                    <button aria-label="Pindahkan bagian ke bawah" className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40" disabled={sectionIndex === config.sections.length - 1} onClick={() => moveSection(section.id, 1)} type="button">↓</button>
                    <button className="min-h-10 rounded-lg border border-rose-200 px-3 text-sm text-rose-700 disabled:opacity-40" disabled={config.sections.length <= 1 || config.fields.some((field) => field.system && field.sectionId === section.id)} onClick={() => removeSection(section.id)} type="button">Hapus</button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {fields.map((field, fieldIndex) => (
                    <article className="grid gap-3 rounded-xl border border-[#eee6d8] bg-white p-4" key={field.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div><h3 className="font-semibold text-[#142842]">{field.label || "Field tanpa label"}</h3><p className="text-xs text-[#748090]">{field.system ? "Field inti AKKAI" : `Field tambahan · key: ${field.key}`}</p></div>
                        <div className="flex gap-2">
                          <button aria-label="Pindahkan field ke atas" className="min-h-9 rounded-md border px-2" disabled={fieldIndex === 0} onClick={() => moveField(section.id, field.id, -1)} type="button">↑</button>
                          <button aria-label="Pindahkan field ke bawah" className="min-h-9 rounded-md border px-2" disabled={fieldIndex === fields.length - 1} onClick={() => moveField(section.id, field.id, 1)} type="button">↓</button>
                          {!field.system ? <button className="min-h-9 rounded-md border border-rose-200 px-3 text-sm text-rose-700" onClick={() => removeField(field.id)} type="button">Hapus field</button> : null}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="grid gap-1 text-sm text-[#344d68]">Label
                          <input className="min-h-10 rounded-lg border border-[#d8cfbf] px-3" maxLength={160} onChange={(event) => updateField(field.id, { label: event.target.value })} value={field.label} />
                        </label>
                        <label className="grid gap-1 text-sm text-[#344d68]">Tipe field
                          <select className="min-h-10 rounded-lg border border-[#d8cfbf] px-3" disabled={field.system} onChange={(event) => updateField(field.id, { type: event.target.value as RegistrationFormFieldType, options: ["select", "radio"].includes(event.target.value) ? ["Opsi 1"] : undefined })} value={field.type}>
                            {FORM_BUILDER_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                            {field.system && field.type === "file" ? <option value="file">file</option> : null}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm text-[#344d68]">Placeholder
                          <input className="min-h-10 rounded-lg border border-[#d8cfbf] px-3" maxLength={200} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} value={field.placeholder ?? ""} />
                        </label>
                        <label className="grid gap-1 text-sm text-[#344d68]">Bagian
                          <select className="min-h-10 rounded-lg border border-[#d8cfbf] px-3" onChange={(event) => setConfig((current) => {
                            const nextFields = current.fields.map((item) => item.id === field.id ? { ...item, sectionId: event.target.value, position: current.fields.filter((candidate) => candidate.sectionId === event.target.value).length + 1 } : item);
                            setSaved(false);
                            return normalizePositions(current, event.target.value, nextFields);
                          })} value={field.sectionId}>
                            {ordered(config.sections).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                          </select>
                        </label>
                        <label className="flex min-h-10 items-center gap-2 text-sm text-[#344d68]">
                          <input checked={field.required} disabled={field.system} onChange={(event) => updateField(field.id, { required: event.target.checked })} type="checkbox" /> Wajib diisi
                        </label>
                        {field.type === "select" || field.type === "radio" ? (
                          <label className="grid gap-1 text-sm text-[#344d68] sm:col-span-2">Opsi (satu opsi per baris)
                            <textarea className="min-h-20 rounded-lg border border-[#d8cfbf] px-3 py-2 disabled:bg-[#f4f1ea]" disabled={field.system} onChange={(event) => updateField(field.id, { options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })} value={(field.options ?? []).join("\n")} />
                          </label>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <button className="min-h-11 rounded-lg border border-[#c8b58d] px-4 text-sm font-semibold text-[#725a27]" onClick={addSection} type="button">Tambah bagian</button>
            <button className="min-h-11 rounded-lg border border-[#c8b58d] px-4 text-sm font-semibold text-[#725a27]" onClick={addField} type="button">Tambah field</button>
          </div>
        </div>
      )}
    </div>
  );
}
