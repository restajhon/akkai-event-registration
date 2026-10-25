import { requirePermission } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  createCompanyWithEvent,
  createEventForCompany,
  upsertCompanyMembership,
} from "./actions";

export const dynamic = "force-dynamic";

type CompanyRow = { id: string; slug: string; name: string };
type EventRow = {
  id: string;
  company_id: string;
  slug: string;
  event_code: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  registration_open: boolean;
};
type ProfileRow = { id: string; full_name: string; email: string; is_active: boolean };
type MembershipRow = {
  id: string;
  company_id: string;
  profile_id: string;
  role: string;
  is_active: boolean;
  profiles: { full_name: string; email: string };
  companies: { name: string; slug: string };
};

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5 shadow-[0_1px_2px_rgba(20,40,66,0.025)]">
      <h2 className="text-lg font-semibold text-[#142842]">{title}</h2>
      {children}
    </section>
  );
}

function TextInput({ label, name, required = true, type = "text" }: { label: string; name: string; required?: boolean; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-[#344d68]">
      {label}
      <input className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" name={name} required={required} type={type} />
    </label>
  );
}

export default async function TenantManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requirePermission("access.manage");
  const params = await searchParams;
  const supabase = createAdminClient({ scope: "global" });
  const [companiesResult, eventsResult, profilesResult, membershipsResult] = await Promise.all([
    supabase.from("companies").select("id, slug, name").order("name"),
    supabase.from("events").select("id, company_id, slug, event_code, name, starts_on, ends_on, registration_open").order("starts_on", { ascending: false, nullsFirst: false }),
    supabase.from("profiles").select("id, full_name, email, is_active").order("full_name"),
    supabase.from("company_memberships").select("id, company_id, profile_id, role, is_active, profiles!inner(full_name, email), companies!inner(name, slug)").order("created_at", { ascending: false }),
  ]);

  const loadError = companiesResult.error || eventsResult.error || profilesResult.error || membershipsResult.error;
  const companies = (companiesResult.data ?? []) as CompanyRow[];
  const events = (eventsResult.data ?? []) as EventRow[];
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const memberships = (membershipsResult.data ?? []) as unknown as MembershipRow[];
  const eventsByCompany = new Map<string, EventRow[]>();
  for (const event of events) eventsByCompany.set(event.company_id, [...(eventsByCompany.get(event.company_id) ?? []), event]);

  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-7 lg:px-9">
      <header className="rounded-2xl border border-[#e3d8c6] bg-[#fffdf8] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7526]">Super Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#142842]">Perusahaan, Event & Membership</h1>
        <p className="mt-2 text-sm text-[#667386]">Atur perusahaan dan event. Role membership berlaku untuk seluruh event dalam perusahaan.</p>
      </header>

      {params.success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{params.success}</p> : null}
      {params.error ? <p className="rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]" role="alert">{params.error}</p> : null}
      {loadError ? <p className="rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]" role="alert">Data tenant belum dapat dimuat.</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Buat perusahaan dan event pertama">
          <form action={createCompanyWithEvent} className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Nama perusahaan" name="companyName" />
            <TextInput label="Slug perusahaan" name="companySlug" />
            <TextInput label="Nama event" name="eventName" />
            <TextInput label="Slug event" name="eventSlug" />
            <TextInput label="Kode event" name="eventCode" />
            <TextInput label="Mulai" name="startsOn" required={false} type="date" />
            <TextInput label="Selesai" name="endsOn" required={false} type="date" />
            <div className="flex items-end sm:col-span-2">
              <button className="min-h-10 rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white hover:bg-[#203d5d]" type="submit">Buat perusahaan & event</button>
            </div>
          </form>
        </Panel>

        <Panel title="Tambah event ke perusahaan">
          <form action={createEventForCompany} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-[#344d68]">Perusahaan
              <select className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" name="companyId" required>
                <option value="">Pilih perusahaan</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <TextInput label="Nama event" name="eventName" />
            <TextInput label="Slug event" name="eventSlug" />
            <TextInput label="Kode event" name="eventCode" />
            <TextInput label="Mulai" name="startsOn" required={false} type="date" />
            <TextInput label="Selesai" name="endsOn" required={false} type="date" />
            <div className="flex items-end sm:col-span-2">
              <button className="min-h-10 rounded-lg border border-[#c8b58d] px-4 text-sm font-semibold text-[#725a27] hover:bg-[#faf4e7]" type="submit">Tambahkan event</button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Membership perusahaan">
        <form action={upsertCompanyMembership} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-sm font-medium text-[#344d68]">Pengguna
            <select className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" name="profileId" required>
              <option value="">Pilih pengguna</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} · {profile.email}{profile.is_active ? "" : " · nonaktif"}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-[#344d68]">Perusahaan
            <select className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" name="companyId" required>
              <option value="">Pilih perusahaan</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-[#344d68]">Role
            <select className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" name="role" required>
              {(["ADMIN", "OPERATIONAL", "REGISTRATION", "OPERATOR", "SCANNER"] as const).map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-[#344d68]">Status
            <select className="min-h-10 rounded-lg border border-[#d8cfbf] bg-white px-3 font-normal" defaultValue="true" name="isActive">
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="min-h-10 rounded-lg bg-[#142842] px-4 text-sm font-semibold text-white hover:bg-[#203d5d]" type="submit">Simpan membership</button>
          </div>
        </form>
        <div className="overflow-x-auto rounded-xl border border-[#eee6d8]">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[#f7f3ea] text-xs uppercase tracking-wide text-[#6c6251]"><tr><th className="px-3 py-3">Perusahaan</th><th className="px-3 py-3">Pengguna</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th></tr></thead>
            <tbody>
              {memberships.map((membership) => (
                <tr className="border-t border-[#eee6d8]" key={membership.id}>
                  <td className="px-3 py-3">{membership.companies.name}</td>
                  <td className="px-3 py-3">{membership.profiles.full_name}<span className="block text-xs text-[#77808a]">{membership.profiles.email}</span></td>
                  <td className="px-3 py-3">{membership.role}</td>
                  <td className="px-3 py-3">{membership.is_active ? "Aktif" : "Nonaktif"}</td>
                </tr>
              ))}
              {memberships.length === 0 ? <tr><td className="px-3 py-4 text-[#77808a]" colSpan={4}>Belum ada membership.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Event terdaftar">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <article className="rounded-xl border border-[#eee6d8] bg-white p-4" key={company.id}>
              <h3 className="font-semibold text-[#142842]">{company.name}</h3>
              <p className="text-xs text-[#77808a]">{company.slug}</p>
              <ul className="mt-3 grid gap-2">
                {(eventsByCompany.get(company.id) ?? []).map((event) => (
                  <li className="border-t border-[#eee6d8] pt-2 text-sm" key={event.id}>
                    <span className="font-medium text-[#344d68]">{event.name}</span>
                    <span className="block text-xs text-[#77808a]">{event.event_code} · {event.slug} · {event.registration_open ? "Registrasi buka" : "Registrasi tutup"}</span>
                  </li>
                ))}
                {(eventsByCompany.get(company.id) ?? []).length === 0 ? <li className="text-xs text-[#77808a]">Belum ada event.</li> : null}
              </ul>
            </article>
          ))}
        </div>
      </Panel>
    </main>
  );
}
