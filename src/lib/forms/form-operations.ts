import type { RegistrationFormConfig, RegistrationFormField } from "@/lib/forms/form-schema";

export function ordered<T extends { position: number }>(items: T[]) {
  return [...items].sort((left, right) => left.position - right.position);
}

export function normalizeFields(fields: RegistrationFormField[]) {
  const counts = new Map<string, number>();
  return ordered(fields).map((field) => {
    const position = (counts.get(field.sectionId) ?? 0) + 1;
    counts.set(field.sectionId, position);
    return { ...field, position };
  });
}

export function removeFormField(config: RegistrationFormConfig, fieldId: string): RegistrationFormConfig {
  return { ...config, fields: normalizeFields(config.fields.filter((field) => field.id !== fieldId)) };
}

/** Rehome fields into the first remaining section, preserving their keys and answer mapping. */
export function removeFormSection(config: RegistrationFormConfig, sectionId: string): RegistrationFormConfig {
  if (config.sections.length <= 1 || !config.sections.some((section) => section.id === sectionId)) return config;
  const sections = ordered(config.sections.filter((section) => section.id !== sectionId));
  const destination = sections[0];
  const lastPosition = Math.max(0, ...config.fields.filter((field) => field.sectionId === destination.id).map((field) => field.position));
  let moved = 0;
  return {
    ...config,
    sections: sections.map((section, index) => ({ ...section, position: index + 1 })),
    fields: normalizeFields(config.fields.map((field) => field.sectionId === sectionId
      ? { ...field, sectionId: destination.id, position: lastPosition + ++moved }
      : field)),
  };
}

export function moveFormFieldToSection(config: RegistrationFormConfig, fieldId: string, sectionId: string): RegistrationFormConfig {
  if (!config.sections.some((section) => section.id === sectionId)) return config;
  const nextPosition = Math.max(0, ...config.fields.filter((field) => field.sectionId === sectionId).map((field) => field.position)) + 1;
  return { ...config, fields: normalizeFields(config.fields.map((field) => field.id === fieldId
    ? { ...field, sectionId, position: nextPosition }
    : field)) };
}
