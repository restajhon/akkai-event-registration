import { requirePermission } from "@/lib/auth/server";
import { AKKAI_DEFAULT_REGISTRATION_FORM } from "@/lib/forms/akkai-default-form";
import { validateRegistrationFormConfig } from "@/lib/forms/form-schema";
import { createAdminClient } from "@/lib/supabase/admin";

import { FormBuilder } from "./form-builder";

export default async function RegistrationFormBuilderPage() {
  const profile = await requirePermission("forms.manage");
  const supabase = createAdminClient();
  const { data: form } = await supabase
    .from("registration_forms")
    .select("draft_config, published_version_id")
    .eq("event_id", profile.activeEventId!)
    .maybeSingle();

  const draftConfig = form?.draft_config
    ? validateRegistrationFormConfig(form.draft_config)
    : null;
  const { data: version } = form?.published_version_id
    ? await supabase
        .from("registration_form_versions")
        .select("version_number")
        .eq("id", form.published_version_id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-6 sm:px-7 lg:px-9">
      <FormBuilder
        initialConfig={draftConfig?.success ? draftConfig.data : AKKAI_DEFAULT_REGISTRATION_FORM}
        publishedVersion={version?.version_number ?? null}
        registrationOpen={profile.activeEventRegistrationOpen === true}
      />
    </main>
  );
}
