import type { ReactNode } from "react";

import { TenantEventSwitcher } from "@/components/admin/tenant-event-switcher";
import { AdminShell } from "@/components/admin/admin-shell";
import { listAccessibleEvents, resolveActiveTenantContext } from "@/lib/tenant/server-context";

export default async function AdminShellLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [events, activeEvent] = await Promise.all([
    listAccessibleEvents(),
    resolveActiveTenantContext(),
  ]);

  return (
    <AdminShell
      tenantSwitcher={activeEvent ? <TenantEventSwitcher activeEventId={activeEvent.id} events={events} /> : null}
    >
      {children}
    </AdminShell>
  );
}
