import { RegistrationPage } from "@/components/public/registration/registration-page";

export default async function EventRegistrationPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  return <RegistrationPage eventSlug={eventSlug} />;
}
