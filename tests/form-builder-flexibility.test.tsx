import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormBuilder } from "@/app/admin/(protected)/(admin-shell)/forms/form-builder";
import { AKKAI_DEFAULT_REGISTRATION_FORM } from "@/lib/forms/akkai-default-form";
import { defaultEventForm } from "@/lib/forms/default-event-form";
import { moveFormFieldToSection, removeFormField, removeFormSection } from "@/lib/forms/form-operations";
import { supportsAkkaiParticipantWorkflow, validateRegistrationFormAnswers, validateRegistrationFormConfig } from "@/lib/forms/form-schema";

describe("event form builder", () => {
  it("only relaxes the draft validator in the new migration, without altering published versions or submissions", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261026100000_unlock_registration_form_builder.sql"), "utf8");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.is_valid_registration_form_config");
    expect(migration).not.toMatch(/(?:UPDATE|DELETE|DROP|ALTER)\s+(?:TABLE\s+)?public\.registration_(?:form_versions|form_submissions)/i);
    expect(migration).not.toContain("'full_name', 'text', true");
  });

  it("edits Nama and KKA labels and other properties without changing answer keys or AKKAI billing mapping", () => {
    const config = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    config.fields = config.fields.map((field) => field.key === "full_name"
      ? { ...field, label: "Nama peserta", placeholder: "Nama pada kartu identitas", instructions: "Tulis lengkap" }
      : field.key === "kka_name" ? { ...field, label: "Organisasi", instructions: "Nama lembaga" } : field);
    expect(validateRegistrationFormConfig(config).success).toBe(true);
    expect(supportsAkkaiParticipantWorkflow(config)).toBe(true);
    const answers = { full_name: "Ayu", kka_name: "KKA Lama" };
    expect(validateRegistrationFormAnswers(config, answers)).toMatchObject({ success: false, errors: { email: expect.any(String) } });
    expect(config.fields.find((field) => field.label === "Organisasi")?.key).toBe("kka_name");

    config.fields = config.fields.map((field) => field.key === "kka_name"
      ? { ...field, type: "select", options: ["Perusahaan A", "Perusahaan B"], required: false } : field);
    expect(validateRegistrationFormConfig(config).success).toBe(true);
    expect(supportsAkkaiParticipantWorkflow(config)).toBe(false);
  });

  it("removes built-in fields and sections, rehomes survivors, and keeps old version answers untouched", () => {
    const published = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    const oldAnswers = {
      full_name: "Ayu", kka_name: "KKA Lama", position: "Konsultan", phone_number: "081234567890",
      email: "ayu@example.com", package_type: "Twin Share", polo_size: "L", polo_model: "Lengan Panjang",
      participation_scope: "Seluruh acara", attends_pai_congress: "false", privacy_consent: true,
    };
    const draft = removeFormSection(removeFormField(published, "kka_name"), "identitas");
    const moved = moveFormFieldToSection(draft, "full_name", "persetujuan");

    expect(validateRegistrationFormConfig(moved).success).toBe(true);
    expect(moved.sections.some((section) => section.id === "identitas")).toBe(false);
    expect(moved.fields.some((field) => field.key === "kka_name")).toBe(false);
    expect(moved.fields.every((field) => moved.sections.some((section) => section.id === field.sectionId))).toBe(true);
    expect(moved.fields.find((field) => field.key === "full_name")?.sectionId).toBe("persetujuan");
    expect(published.fields.find((field) => field.key === "kka_name")?.label).toBe("KKA");
    expect(oldAnswers.kka_name).toBe("KKA Lama");
    expect(validateRegistrationFormAnswers(published, oldAnswers).success).toBe(true);
    expect(validateRegistrationFormAnswers(moved, oldAnswers)).toMatchObject({ success: false, errors: { kka_name: expect.any(String) } });
  });

  it("renders a link for the selected event only when published, separately from registration status", () => {
    const config = defaultEventForm("Konferensi Beta");
    const html = renderToStaticMarkup(<FormBuilder eventName="Konferensi Beta" eventSlug="konferensi-beta" initialConfig={config} publishedVersion={2} registrationOpen={false} />);
    expect(html).toContain("/events/konferensi-beta/register");
    expect(html).not.toContain("/events/akkai-2026/register");
    expect(html).toContain("Buka halaman pendaftaran");
    expect(html).toContain("Salin tautan");
    expect(html).toContain("Pendaftaran masih ditutup");
    expect(renderToStaticMarkup(<FormBuilder eventName="Beta" eventSlug="konferensi-beta" initialConfig={config} publishedVersion={null} registrationOpen={false} />)).not.toContain("Buka halaman pendaftaran");
  });
});

const mocks = vi.hoisted(() => ({
  getAuthorizedProfile: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/server", () => ({ getAuthorizedProfile: mocks.getAuthorizedProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { publishRegistrationFormDraft, saveRegistrationFormDraft } from "@/app/admin/(protected)/(admin-shell)/forms/actions";

describe("form draft actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin-a", activeEventId: "event-a" });
  });

  it("saves edited and deleted built-in fields to the current event draft and reloads them intact", async () => {
    const drafts = new Map<string, unknown>();
    const versions = new Map<string, unknown[]>();
    const oldVersion = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    const oldSubmission = { formVersion: 1, answers: { full_name: "Peserta lama", kka_name: "KKA lama" } };
    versions.set("event-a", [oldVersion]);
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      const eventId = args.p_event_id as string;
      if (name === "save_registration_form_draft") {
        drafts.set(eventId, structuredClone(args.p_config));
        return { data: "form-id", error: null };
      }
      if (name === "publish_registration_form_draft") {
        versions.set(eventId, [...(versions.get(eventId) ?? []), structuredClone(drafts.get(eventId))]);
        return { data: [{ version_id: "version-2", version_number: 2 }], error: null };
      }
      return { data: null, error: new Error("unknown RPC") };
    });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const original = structuredClone(AKKAI_DEFAULT_REGISTRATION_FORM);
    const draft = removeFormSection(removeFormField(structuredClone(original), "kka_name"), "identitas");
    draft.fields.find((field) => field.key === "full_name")!.label = "Nama peserta";

    expect((await saveRegistrationFormDraft(JSON.stringify(draft))).success).toBe(true);
    expect(validateRegistrationFormConfig(drafts.get("event-a"))).toMatchObject({ success: true });
    expect((await publishRegistrationFormDraft()).success).toBe(true);
    expect(versions.get("event-a")?.[0]).toEqual(oldVersion);
    expect(versions.get("event-a")?.[1]).toEqual(draft);
    expect(oldSubmission).toEqual({ formVersion: 1, answers: { full_name: "Peserta lama", kka_name: "KKA lama" } });
    expect(original.fields.find((field) => field.key === "kka_name")?.label).toBe("KKA");

    mocks.getAuthorizedProfile.mockResolvedValue({ id: "admin-b", activeEventId: "event-b" });
    expect((await saveRegistrationFormDraft(JSON.stringify(defaultEventForm("Event B")))).success).toBe(true);
    expect(drafts.get("event-a")).toEqual(draft);
    expect(versions.has("event-b")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("save_registration_form_draft", { p_event_id: "event-b", p_updated_by: "admin-b", p_config: expect.any(Object) });
  });

  it("denies draft saves and publication without forms.manage in the selected tenant", async () => {
    mocks.getAuthorizedProfile.mockResolvedValue(null);
    expect((await saveRegistrationFormDraft(JSON.stringify(defaultEventForm("B")))).success).toBe(false);
    expect((await publishRegistrationFormDraft()).success).toBe(false);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
