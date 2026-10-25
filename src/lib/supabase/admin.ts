import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { hasPermission, type Permission } from "@/lib/auth/permissions";
import {
  resolveActiveTenantContext,
  resolveGlobalAdminProfileId,
  type ActiveTenantContext,
} from "@/lib/tenant/server-context";
import { isPublishedRegistrationEvent } from "@/lib/tenant/public-events";

export type AdminClientOptions =
  | { scope?: "tenant" }
  | { scope: "global" }
  | { scope: "public-event"; eventId: string }
  | { scope: "public-event-cleanup"; eventId: string };

type ClientScope =
  | { kind: "tenant"; tenant: ActiveTenantContext }
  | { kind: "global"; profileId: string }
  | { kind: "public-event"; eventId: string }
  | { kind: "public-event-cleanup"; eventId: string };

type RpcTarget = {
  permission?: Permission;
  table?: string;
  column?: string;
  parameter?: string;
  additionalTargets?: Array<{
    table: string;
    column: string;
    parameter: string;
    optional?: boolean;
  }>;
  actorParameter?: string;
  eventParameter?: string;
  superAdminOnly?: boolean;
  public?: boolean;
  publicOnly?: boolean;
};

const tenantReadPermissions: Record<string, Permission[]> = {
  participants: ["participants.view"],
  registration_batches: ["participants.view"],
  registration_billings: ["participants.view"],
  registration_billing_email_logs: ["participants.view"],
  registration_documents: ["participants.view"],
  registration_certificate_upload_intents: ["participants.view", "participants.email"],
  registration_submission_idempotency_keys: ["participants.view"],
  registration_form_submissions: ["participants.view"],
  registration_forms: ["forms.manage"],
  registration_form_versions: ["forms.manage", "participants.view"],
  attendance: ["attendance.view", "attendance.export", "scanner.checkin", "display.view", "dashboard.view"],
  sessions: ["sessions.view", "sessions.manage", "participants.view", "attendance.view", "scanner.pair", "scanner.checkin", "display.view", "dashboard.view"],
  scanner_stations: ["display.view", "display.manage", "scanner.pair", "scanner.checkin"],
  scan_events: ["display.view", "scanner.checkin"],
  email_logs: ["participants.view", "participants.email"],
  participant_email_changes: ["participants.view", "participants.email"],
  participant_travel: ["participants.view", "participants.manage"],
  participant_room_assignments: ["rooms.view", "rooms.manage", "rooms.export"],
  participant_pickup_assignments: ["pickup.view", "pickup.manage", "pickup.export"],
  participant_registration_status_changes: ["participants.view", "participants.cancel", "participants.restore"],
  member_meeting_participants: ["member_meetings.view", "member_meetings.manage"],
  member_meeting_submissions: ["member_meetings.view", "member_meetings.manage", "dashboard.view"],
  member_meeting_upload_intents: ["member_meetings.view", "member_meetings.manage"],
};

const tenantWritePermissions: Record<string, Permission[]> = {
  participants: ["participants.manage"],
  registration_batches: ["participants.manage"],
  registration_billings: ["participants.manage"],
  registration_billing_email_logs: ["participants.manage"],
  registration_documents: ["participants.manage"],
  registration_certificate_upload_intents: ["participants.manage", "participants.email"],
  registration_submission_idempotency_keys: ["participants.manage"],
  sessions: ["sessions.manage"],
  scanner_stations: ["display.manage", "scanner.pair"],
  attendance: ["scanner.checkin"],
  scan_events: ["scanner.checkin"],
  email_logs: ["participants.email"],
  participant_email_changes: ["participants.email"],
  participant_travel: ["participants.manage"],
  participant_room_assignments: ["rooms.manage"],
  participant_pickup_assignments: ["pickup.manage"],
  participant_registration_status_changes: ["participants.cancel", "participants.restore"],
  member_meeting_participants: ["member_meetings.manage"],
  member_meeting_submissions: ["member_meetings.manage"],
  member_meeting_upload_intents: ["member_meetings.manage"],
};

const rpcTargets: Record<string, RpcTarget> = {
  set_participant_registration_status: {
    permission: "participants.cancel",
    table: "participants",
    column: "registration_id",
    parameter: "p_registration_id",
    actorParameter: "p_changed_by",
  },
  finalize_participant_email_attempt: {
    permission: "participants.email",
    public: true,
    table: "participants",
    column: "id",
    parameter: "p_participant_id",
  },
  finalize_registration_billing_email: {
    permission: "participants.email",
    public: true,
    table: "registration_billings",
    column: "id",
    parameter: "p_billing_id",
  },
  correct_participant_email: {
    permission: "participants.email",
    table: "participants",
    column: "id",
    parameter: "p_participant_id",
    actorParameter: "p_changed_by",
  },
  reserve_participant_email_resend: {
    permission: "participants.email",
    table: "participants",
    column: "id",
    parameter: "p_participant_id",
    actorParameter: "p_sent_by",
  },
  update_participant_data: {
    permission: "participants.manage",
    table: "participants",
    column: "id",
    parameter: "p_participant_id",
    actorParameter: "p_actor_id",
  },
  set_registration_billing_payment_status: {
    permission: "participants.manage",
    table: "registration_billings",
    column: "id",
    parameter: "p_billing_id",
    actorParameter: "p_paid_by",
  },
  upsert_participant_room_assignment: {
    permission: "rooms.manage",
    table: "participants",
    column: "registration_id",
    parameter: "p_registration_id",
    actorParameter: "p_updated_by",
  },
  upsert_participant_pickup_assignment: {
    permission: "pickup.manage",
    table: "participants",
    column: "registration_id",
    parameter: "p_registration_id",
    actorParameter: "p_updated_by",
  },
  upsert_participant_travel: {
    table: "participants",
    column: "registration_id",
    parameter: "p_registration_id",
    public: true,
    publicOnly: true,
  },
  pair_scanner_station: {
    permission: "scanner.pair",
    table: "scanner_stations",
    column: "id",
    parameter: "p_station_id",
    actorParameter: "p_operator_profile_id",
  },
  create_scanner_station: {
    permission: "display.manage",
    table: "sessions",
    column: "id",
    parameter: "p_session_id",
    actorParameter: "p_created_by",
  },
  reset_scanner_station_pairing: {
    permission: "display.manage",
    table: "scanner_stations",
    column: "id",
    parameter: "p_station_id",
  },
  close_scanner_station: {
    permission: "display.manage",
    table: "scanner_stations",
    column: "id",
    parameter: "p_station_id",
  },
  process_qr_scan: {
    permission: "scanner.checkin",
    table: "scanner_stations",
    column: "id",
    parameter: "p_station_id",
    actorParameter: "p_operator_profile_id",
  },
  process_manual_check_in: {
    permission: "scanner.checkin",
    table: "scanner_stations",
    column: "id",
    parameter: "p_station_id",
    actorParameter: "p_operator_profile_id",
  },
  link_member_meeting_submission: {
    permission: "member_meetings.manage",
    table: "member_meeting_submissions",
    column: "id",
    parameter: "p_submission_id",
    actorParameter: "p_changed_by",
  },
  cancel_member_meeting_participant: {
    permission: "member_meetings.manage",
    table: "participants",
    column: "registration_id",
    parameter: "p_registration_id",
    actorParameter: "p_changed_by",
  },
  update_profile_access: { superAdminOnly: true, actorParameter: "p_actor_id" },
  create_company_with_event: { superAdminOnly: true, actorParameter: "p_actor_id" },
  create_event_for_company: { superAdminOnly: true, actorParameter: "p_actor_id" },
  upsert_company_membership: { superAdminOnly: true, actorParameter: "p_actor_id" },
  create_participant_with_registration_reservation_v7: {
    public: true,
    publicOnly: true,
    eventParameter: "p_event_id",
    additionalTargets: [{
      table: "registration_certificate_upload_intents",
      column: "id",
      parameter: "p_certificate_upload_intent_id",
      optional: true,
    }],
  },
  create_participant_with_registration_reservation_v8: {
    public: true,
    publicOnly: true,
    eventParameter: "p_event_id",
    additionalTargets: [{
      table: "registration_certificate_upload_intents",
      column: "id",
      parameter: "p_certificate_upload_intent_id",
      optional: true,
    }],
  },
  claim_registration_certificate_upload_cleanup: {
    public: true,
    publicOnly: true,
    eventParameter: "p_event_id",
    additionalTargets: [{
      table: "registration_certificate_upload_intents",
      column: "id",
      parameter: "p_intent_id",
    }],
  },
  submit_public_registration_form: { public: true, publicOnly: true, eventParameter: "p_event_id" },
  consume_participant_travel_rate_limit: { public: true, publicOnly: true },
  consume_member_meeting_rate_limit: { public: true, publicOnly: true },
  save_registration_form_draft: {
    permission: "forms.manage",
    table: "events",
    column: "id",
    parameter: "p_event_id",
    actorParameter: "p_updated_by",
  },
  publish_registration_form_draft: {
    permission: "forms.manage",
    table: "events",
    column: "id",
    parameter: "p_event_id",
    actorParameter: "p_published_by",
  },
  set_event_registration_open: {
    permission: "forms.manage",
    table: "events",
    column: "id",
    parameter: "p_event_id",
    actorParameter: "p_updated_by",
  },
};

const publicEventTables = new Set([
  "events",
  "registration_forms",
  "registration_form_versions",
  "registration_certificate_upload_intents",
  "registration_batches",
  "email_logs",
  "registration_billing_email_logs",
  "member_meeting_upload_intents",
  "member_meeting_submissions",
]);

const globalTables = new Set(["profiles", "companies", "events", "company_memberships"]);
const tenantTables = new Set(Object.keys(tenantReadPermissions));
const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return new URL(input.url);
  return new URL(input.toString());
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  return input instanceof Request ? input.method.toUpperCase() : "GET";
}

function tableNameFromUrl(url: URL) {
  const marker = "/rest/v1/";
  const index = url.pathname.indexOf(marker);
  if (index < 0) return null;
  if (url.pathname.slice(index + marker.length).startsWith("rpc/")) return null;
  return decodeURIComponent(url.pathname.slice(index + marker.length).split("/")[0]);
}

function rpcNameFromUrl(url: URL) {
  const match = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function allowedForRole(role: ActiveTenantContext["role"], permissions: Permission[]) {
  return role === "SUPER_ADMIN" || permissions.some((permission) => hasPermission(role, permission));
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function withEventId(value: unknown, eventId: string) {
  const setRow = (row: unknown) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error("Tenant-scoped inserts require JSON object rows.");
    }
    const record = row as Record<string, unknown>;
    if (record.event_id !== undefined && record.event_id !== eventId) {
      throw new Error("Cross-event write rejected.");
    }
    return { ...record, event_id: eventId };
  };

  return Array.isArray(value) ? value.map(setRow) : setRow(value);
}

function resolveRequestBody(input: RequestInfo | URL, init?: RequestInit) {
  return init?.body ?? (input instanceof Request ? input.clone().text() : null);
}

async function rowBelongsToEvent(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  column: string,
  value: unknown,
  eventId: string,
  requiredStatus?: string,
) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (table === "events") {
    return value === eventId;
  }
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("select", requiredStatus ? "event_id,status" : "event_id");
  url.searchParams.set(column, `eq.${value}`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("event_id", `eq.${eventId}`);
  if (requiredStatus) url.searchParams.set("status", `eq.${requiredStatus}`);
  const response = await nativeFetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ event_id?: string; status?: string }>;
  return rows.some((row) => row.event_id === eventId && (!requiredStatus || row.status === requiredStatus));
}

async function assertRpcScope(
  url: URL,
  body: unknown,
  scope: ClientScope,
  supabaseUrl: string,
  serviceKey: string,
) {
  const name = rpcNameFromUrl(url);
  const rule = name ? rpcTargets[name] : undefined;
  if (!name || !rule) {
    throw new Error("RPC is not in the tenant authorization allowlist.");
  }

  if (rule.superAdminOnly) {
    if (scope.kind !== "global") throw new Error("Global Super Admin access is required.");
    const globalArgs = typeof body === "object" && body !== null
      ? body as Record<string, unknown>
      : null;
    if (!globalArgs) throw new Error("RPC arguments must be a JSON object.");
    if (rule.actorParameter && globalArgs[rule.actorParameter] !== scope.profileId) {
      throw new Error("RPC actor does not match the authenticated Super Admin.");
    }
    return;
  }

  if (scope.kind === "global") {
    throw new Error("Event RPCs require an active event scope.");
  }

  const args = typeof body === "object" && body !== null
    ? body as Record<string, unknown>
    : null;
  if (!args) throw new Error("RPC arguments must be a JSON object.");

  const rpcRowTargets = [
    ...(rule.table && rule.column && rule.parameter
      ? [{ table: rule.table, column: rule.column, parameter: rule.parameter }]
      : []),
    ...(rule.additionalTargets ?? []),
  ];

  if (scope.kind === "public-event-cleanup") {
    if (name !== "claim_registration_certificate_upload_cleanup"
        || !rule.eventParameter
        || args[rule.eventParameter] !== scope.eventId) {
      throw new Error("Upload-cleanup RPC is outside the event cleanup scope.");
    }
    for (const target of rpcRowTargets) {
      const belongs = await rowBelongsToEvent(
        supabaseUrl,
        serviceKey,
        target.table,
        target.column,
        args[target.parameter],
        scope.eventId,
      );
      if (!belongs) throw new Error("Upload cleanup target is outside the event.");
    }
    return;
  }

  if (scope.kind === "public-event") {
    if (!rule.public) throw new Error("RPC is not available to public event submissions.");
    if (rule.eventParameter && args[rule.eventParameter] !== scope.eventId) {
      throw new Error("Cross-event RPC rejected.");
    }
    for (const target of rpcRowTargets) {
      const targetValue = args[target.parameter];
      if ("optional" in target && target.optional && (targetValue === null || targetValue === undefined)) {
        continue;
      }
      const belongs = await rowBelongsToEvent(
        supabaseUrl,
        serviceKey,
        target.table,
        target.column,
        targetValue,
        scope.eventId,
      );
      if (!belongs) throw new Error("Public RPC target is outside the event.");
    }
    return;
  }

  if (rule.publicOnly) throw new Error("Public registration RPC cannot be called with an admin scope.");
  if (rule.permission && !hasPermission(scope.tenant.role, rule.permission)) {
    throw new Error("Tenant role does not have permission for this RPC.");
  }
  if (rule.actorParameter && args[rule.actorParameter] !== scope.tenant.profileId) {
    throw new Error("RPC actor does not match the authenticated tenant member.");
  }
  for (const target of rpcRowTargets) {
    const targetValue = args[target.parameter];
    if ("optional" in target && target.optional && (targetValue === null || targetValue === undefined)) {
      continue;
    }
    const belongs = await rowBelongsToEvent(
      supabaseUrl,
      serviceKey,
      target.table,
      target.column,
      targetValue,
      scope.tenant.id,
    );
    if (!belongs) throw new Error("RPC target is outside the active event.");
  }
}

function storageObjectParts(url: URL, method: string, body: unknown) {
  const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|upload\/sign|authenticated|public)\/([^/]+)\/(.+)$/);
  if (match) {
    return [{ bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) }];
  }

  const deleteMatch = url.pathname.match(/\/storage\/v1\/object\/([^/]+)$/);
  if (deleteMatch && method === "DELETE") {
    const payload = parseJsonBody(typeof body === "string" ? body : null);
    const prefixes = typeof payload === "object" && payload !== null
      ? (payload as { prefixes?: unknown }).prefixes
      : null;
    if (!Array.isArray(prefixes) || prefixes.length === 0 || prefixes.some((path) => typeof path !== "string" || path.length === 0)) {
      throw new Error("Storage deletion requires explicit object paths.");
    }
    return prefixes.map((path) => ({ bucket: decodeURIComponent(deleteMatch[1]), path: path as string }));
  }

  return null;
}

async function assertStorageObjectScope(
  url: URL,
  scope: ClientScope,
  supabaseUrl: string,
  serviceKey: string,
  method: string,
  body: unknown,
) {
  const objects = storageObjectParts(url, method, body);
  if (!objects) throw new Error("Storage operation is not in the tenant allowlist.");
  const eventId = scope.kind === "tenant" ? scope.tenant.id
    : scope.kind === "public-event" || scope.kind === "public-event-cleanup" ? scope.eventId
      : null;
  if (!eventId) throw new Error("A tenant event is required for storage access.");
  for (const object of objects) {
    if (scope.kind === "public-event-cleanup" && (
      method !== "DELETE" || object.bucket !== "registration-certificates"
    )) {
      throw new Error("Upload-cleanup scope only removes certificate objects.");
    }
    const intent = object.bucket === "registration-certificates"
      ? { table: "registration_certificate_upload_intents", column: "storage_path" }
      : object.bucket === "member-meeting-authorizations"
        ? { table: "member_meeting_upload_intents", column: "storage_path" }
        : null;
    if (!intent) throw new Error("Storage operation is not in the tenant allowlist.");
    const belongs = await rowBelongsToEvent(
      supabaseUrl,
      serviceKey,
      intent.table,
      intent.column,
      object.path,
      eventId,
      scope.kind === "public-event-cleanup" ? "CLEANING" : undefined,
    );
    if (!belongs) throw new Error("Storage object is outside the active event.");
  }
}

function isPublicFormRead(url: URL, method: string, table: string) {
  if (method !== "GET" && method !== "HEAD") return false;
  const columns = url.searchParams.get("select") ?? "";
  if (table === "registration_forms") {
    return Boolean(columns) && columns !== "*" && columns.split(",").every((column) => column.trim() !== "draft_config");
  }
  if (table === "registration_form_versions") return true;
  if (table === "events") return true;
  if (table === "registration_certificate_upload_intents" || table === "member_meeting_upload_intents") return true;
  if (table === "email_logs") return url.searchParams.has("id");
  if (table === "registration_billing_email_logs") return url.searchParams.has("billing_id");
  return false;
}

function inheritedFetchInit(input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined {
  if (!(input instanceof Request)) return init;
  return { method: input.method, headers: input.headers, ...init };
}

async function getCompanyProfileIds(supabaseUrl: string, serviceKey: string, companyId: string) {
  const url = new URL("/rest/v1/company_memberships", supabaseUrl);
  url.searchParams.set("select", "profile_id");
  url.searchParams.set("company_id", `eq.${companyId}`);
  url.searchParams.set("is_active", "eq.true");
  const response = await nativeFetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  if (!response.ok) return [] as string[];
  const rows = (await response.json()) as Array<{ profile_id?: string }>;
  return rows.flatMap((row) => typeof row.profile_id === "string" ? [row.profile_id] : []);
}

async function buildScopedFetch(
  scopePromise: Promise<ClientScope>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<typeof fetch> {
  let companyProfileIdsPromise: Promise<string[]> | null = null;
  return async (input, init) => {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    const table = tableNameFromUrl(url);

    if (table) {
      const scope = await scopePromise;
      if (scope.kind === "global") {
        if (!globalTables.has(table)) throw new Error("Global scope cannot access tenant event data.");
        return nativeFetch(input, init);
      }

      if (scope.kind === "public-event-cleanup") {
        if (table !== "registration_certificate_upload_intents") {
          throw new Error("Upload-cleanup scope cannot access this table.");
        }
        const safeDelete = method === "DELETE"
          && url.searchParams.has("id")
          && url.searchParams.get("status") === "eq.CLEANING";
        if (!safeDelete) {
          throw new Error("Upload-cleanup scope only deletes claimed CLEANING rows.");
        }
        url.searchParams.set("event_id", `eq.${scope.eventId}`);
        return nativeFetch(url, inheritedFetchInit(input, init));
      }

      if (scope.kind === "public-event") {
        if (!publicEventTables.has(table)) throw new Error("Table is not available to public event submissions.");
        if ((method === "GET" || method === "HEAD") && !isPublicFormRead(url, method, table)) {
          throw new Error("Public event scope cannot read private registration rows.");
        }
        if (method !== "GET" && method !== "HEAD") {
          const allowedWrite = table === "registration_certificate_upload_intents"
            ? method === "POST" || method === "DELETE"
            : table === "member_meeting_upload_intents"
              ? method === "POST" || method === "PATCH" || method === "DELETE"
              : table === "member_meeting_submissions"
                ? method === "POST" || method === "DELETE"
                : table === "registration_batches" && method === "POST";
          if (!allowedWrite) throw new Error("Public event scope cannot write this registration table.");
        }
      } else {
        if (table === "profiles") {
          if (method !== "GET" && method !== "HEAD") {
            throw new Error("Tenant scope cannot modify global profiles.");
          }
          if (!allowedForRole(scope.tenant.role, ["participants.view", "display.view", "dashboard.view"])) {
            throw new Error("Tenant role does not have permission to read company profiles.");
          }
          if (!url.searchParams.has("id")) {
            throw new Error("Tenant-scoped profile reads must identify referenced profile IDs.");
          }
          companyProfileIdsPromise ??= getCompanyProfileIds(supabaseUrl, serviceKey, scope.tenant.companyId);
          const profileIds = await companyProfileIdsPromise;
          if (profileIds.length === 0) {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }
          url.searchParams.set("id", `in.(${profileIds.join(",")})`);
          return nativeFetch(url, inheritedFetchInit(input, init));
        }
        if (table === "companies" || table === "events" || table === "company_memberships") {
          throw new Error("Use authenticated tenant context to read company metadata.");
        }
        if (!tenantTables.has(table)) throw new Error("Table is not in the tenant data allowlist.");
        const allowed = method === "GET" || method === "HEAD"
          ? allowedForRole(scope.tenant.role, tenantReadPermissions[table])
          : allowedForRole(scope.tenant.role, tenantWritePermissions[table] ?? []);
        if (!allowed) throw new Error("Tenant role does not have permission for this table operation.");
      }

      url.searchParams.set("event_id", `eq.${scope.kind === "tenant" ? scope.tenant.id : scope.eventId}`);
      let nextInit = init;
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const rawBody = await resolveRequestBody(input, init);
        const body = typeof rawBody === "string" ? parseJsonBody(rawBody) : null;
        if (body === null) throw new Error("Tenant-scoped writes require JSON request bodies.");
        const nextBody = withEventId(body, scope.kind === "tenant" ? scope.tenant.id : scope.eventId);
        nextInit = { ...init, body: JSON.stringify(nextBody) };
      }
      return nativeFetch(url, inheritedFetchInit(input, nextInit));
    }

    if (url.pathname.includes("/rest/v1/rpc/")) {
      const scope = await scopePromise;
      const rawBody = await resolveRequestBody(input, init);
      const body = typeof rawBody === "string" ? parseJsonBody(rawBody) : null;
      await assertRpcScope(url, body, scope, supabaseUrl, serviceKey);
      return nativeFetch(input, init);
    }

    if (url.pathname.includes("/storage/v1/")) {
      const scope = await scopePromise;
      const rawBody = await resolveRequestBody(input, init);
      await assertStorageObjectScope(url, scope, supabaseUrl, serviceKey, method, rawBody);
    }

    return nativeFetch(input, init);
  };
}

async function resolveClientScope(options: AdminClientOptions): Promise<ClientScope> {
  if (options.scope === "global") {
    const profileId = await resolveGlobalAdminProfileId();
    if (!profileId) throw new Error("Super Admin scope is required for global data.");
    return { kind: "global", profileId };
  }
  if (options.scope === "public-event") {
    if (!/^[0-9a-f-]{36}$/i.test(options.eventId)) throw new Error("A valid event ID is required.");
    if (!(await isPublishedRegistrationEvent(options.eventId))) {
      throw new Error("Public event scope requires an open event with a published form.");
    }
    return { kind: "public-event", eventId: options.eventId };
  }
  if (options.scope === "public-event-cleanup") {
    if (!/^[0-9a-f-]{36}$/i.test(options.eventId)) throw new Error("A valid event ID is required.");
    return { kind: "public-event-cleanup", eventId: options.eventId };
  }
  const tenant = await resolveActiveTenantContext();
  if (!tenant) throw new Error("No accessible event is selected for this request.");
  return { kind: "tenant", tenant };
}

/**
 * Server-only Supabase client. Event table calls are fenced in fetch so an
 * accidentally missing query filter cannot cross event membership boundaries.
 */
export function createAdminClient(options: AdminClientOptions = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase admin environment variables are not configured.");
  }

  const scopePromise = resolveClientScope(options);
  const scopedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const fetcher = await buildScopedFetch(scopePromise, supabaseUrl, supabaseSecretKey);
    return fetcher(input, init);
  };

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: scopedFetch },
  });
}
