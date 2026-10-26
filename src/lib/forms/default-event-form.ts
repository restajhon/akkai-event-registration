import type { RegistrationFormConfig } from "@/lib/forms/form-schema";

export function defaultEventForm(eventName: string): RegistrationFormConfig {
  return {
    schemaVersion: 1,
    title: `Pendaftaran ${eventName}`,
    instructions: "Isi formulir berikut untuk mendaftar.",
    sections: [{ id: "peserta", title: "Data peserta", description: "Informasi pendaftaran", position: 1 }],
    fields: [
      { id: "full_name", key: "full_name", type: "text", label: "Nama lengkap", required: true, sectionId: "peserta", position: 1 },
      { id: "email", key: "email", type: "email", label: "Alamat email", required: true, sectionId: "peserta", position: 2 },
    ],
  };
}
