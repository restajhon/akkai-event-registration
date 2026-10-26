import { requirePermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/permissions";
import { AKKAI_DEFAULT_REGISTRATION_FORM } from "@/lib/forms/akkai-default-form";
import { defaultEventForm } from "@/lib/forms/default-event-form";
import { validateRegistrationFormConfig } from "@/lib/forms/form-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listAccessibleEvents } from "@/lib/tenant/server-context";
import { selectActiveEvent } from "@/app/admin/tenant-actions";

import { FormBuilder } from "./form-builder";

export default async function RegistrationFormBuilderPage() {
  const profile = await requirePermission("forms.manage");
  const events = (await listAccessibleEvents()).filter((event) => hasPermission(event.role, "forms.manage"));
  const activeEvent = events.find((event) => event.id === profile.activeEventId);
  if (!activeEvent) return null;
  const supabase = createAdminClient();
  const viewer = await createClient();
  const [{ data: form }, { data: forms, error: formsError }] = await Promise.all([
    supabase.from("registration_forms")
      .select("draft_config, published_version_id")
      .eq("event_id", activeEvent.id)
      .maybeSingle(),
    viewer.from("registration_forms")
      .select("event_id, published_version_id")
      .in("event_id", events.map((event) => event.id)),
  ]);

  const draftConfig = form?.draft_config
    ? validateRegistrationFormConfig(form.draft_config)
    : null;
  const { data: version } = form?.published_version_id
    ? await supabase
        .from("registration_form_versions")
        .select("version_number, config")
        .eq("id", form.published_version_id)
        .maybeSingle()
    : { data: null };
  const publishedConfig = version?.config ? validateRegistrationFormConfig(version.config) : null;
  const publishedByEvent = new Map((forms ?? []).map((item) => [item.event_id, Boolean(item.published_version_id)]));

  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-6 sm:px-7 lg:px-9">
      <section className="rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5" aria-label="Daftar event">
        <h2 className="text-lg font-semibold text-[#142842]">Daftar event</h2>
        <p className="mb-3 text-sm text-[#667386]">Pilih event untuk mengelola draft, melihat halaman terbit, atau membuka pendaftaran.</p>
        {formsError ? <p className="mb-3 text-sm text-rose-700" role="alert">Status form event belum dapat dimuat. Coba muat ulang halaman.</p> : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => <form action={selectActiveEvent} className={`rounded-xl border p-3 ${event.id === activeEvent.id ? "border-[#9a7526] bg-[#faf4e7]" : "border-[#eee6d8]"}`} key={event.id}>
            <input name="eventId" type="hidden" value={event.id} />
            <p className="text-xs text-[#667386]">{event.companyName}</p>
            <button className="text-left font-semibold text-[#142842] underline-offset-2 hover:underline" type="submit">{event.eventName}</button>
            <p className="mt-1 text-xs text-[#53657b]">Form: {formsError ? "Tidak tersedia" : publishedByEvent.get(event.id) ? "Terbit" : "Draft"} · Pendaftaran: {event.registrationOpen ? "Buka" : "Tutup"}</p>
            {event.id === activeEvent.id ? <span className="text-xs font-semibold text-[#9a7526]">Event dipilih</span> : null}
          </form>)}
        </div>
      </section>
      <FormBuilder
        key={activeEvent.id}
        eventName={activeEvent.eventName}
        eventSlug={activeEvent.eventSlug}
        initialConfig={draftConfig?.success ? draftConfig.data : publishedConfig?.success ? publishedConfig.data : activeEvent.eventSlug === "akkai-2026" ? AKKAI_DEFAULT_REGISTRATION_FORM : defaultEventForm(activeEvent.eventName)}
        publishedVersion={version?.version_number ?? null}
        registrationOpen={profile.activeEventRegistrationOpen === true}
      />
    </main>
  );
}
