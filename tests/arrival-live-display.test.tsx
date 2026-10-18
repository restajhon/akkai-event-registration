import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import { EventDetails } from "@/app/admin/(protected)/(focused)/display/[stationId]/live-display-client";
import { ARRIVAL_SESSION_CODE } from "@/lib/admin/attendance-sessions";
import { participantCheckInEventSchema } from "@/lib/realtime/participant-check-in-event";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261018100000_add_arrival_polo_to_live_display.sql"),
  "utf8",
);

const arrivalEvent = {
  status: "success",
  participant: {
    registrationId: "AKKAI26-000001",
    fullName: "Peserta Arrival",
    institution: "AKKAI",
    participantCategory: "Anggota",
    poloModel: "Lengan Pendek",
    poloSize: "L",
  },
  session: { code: ARRIVAL_SESSION_CODE, name: "Registrasi Kedatangan" },
  station: { name: "Station Arrival" },
  eventAt: "2026-10-18T01:00:00.000Z",
  eventSequence: "1",
};

describe("Arrival Live Display polo details", () => {
  it("parses and displays saved polo model and size from a realtime Arrival event", () => {
    const parsedEvent = participantCheckInEventSchema.safeParse(arrivalEvent);

    expect(parsedEvent.success).toBe(true);
    if (!parsedEvent.success) return;

    const markup = renderToStaticMarkup(<EventDetails event={parsedEvent.data} />);

    expect(markup).toContain("Informasi polo peserta");
    expect(markup).toContain("Model polo");
    expect(markup).toContain("Lengan Pendek");
    expect(markup).toContain("Ukuran polo");
    expect(markup).toContain(">L</dd>");
  });

  it("does not display polo information for non-Arrival sessions", () => {
    const parsedEvent = participantCheckInEventSchema.parse({
      ...arrivalEvent,
      session: { code: "SEMINAR", name: "Seminar" },
    });
    const markup = renderToStaticMarkup(<EventDetails event={parsedEvent} />);

    expect(markup).not.toContain("Informasi polo peserta");
    expect(markup).not.toContain("Model polo");
    expect(markup).not.toContain("Ukuran polo");
    expect(markup).not.toContain("Lengan Pendek");
    expect(markup).not.toContain(">L</dd>");
  });

  it("omits blank polo values and their labels on Arrival", () => {
    const partialEvent = participantCheckInEventSchema.parse({
      ...arrivalEvent,
      participant: { ...arrivalEvent.participant, poloSize: "   " },
    });
    const partialMarkup = renderToStaticMarkup(<EventDetails event={partialEvent} />);

    expect(partialMarkup).toContain("Model polo");
    expect(partialMarkup).toContain("Lengan Pendek");
    expect(partialMarkup).not.toContain("Ukuran polo");
    expect(partialMarkup).not.toContain("undefined");
    expect(partialMarkup).not.toContain("null");

    const emptyEvent = participantCheckInEventSchema.parse({
      ...arrivalEvent,
      participant: { ...arrivalEvent.participant, poloModel: " ", poloSize: null },
    });
    const emptyMarkup = renderToStaticMarkup(<EventDetails event={emptyEvent} />);

    expect(emptyMarkup).not.toContain("Informasi polo peserta");
    expect(emptyMarkup).not.toContain("Model polo");
    expect(emptyMarkup).not.toContain("Ukuran polo");
  });

  it("adds saved polo values to the station-scoped realtime payload only for Arrival", () => {
    expect(migration).toContain("p.polo_model");
    expect(migration).toContain("p.polo_size");
    expect(migration).toContain("WHEN v_session_code = 'ARRIVAL'");
    expect(migration).toContain("'poloModel', NULLIF(btrim(v_polo_model), '')");
    expect(migration).toContain("'poloSize', NULLIF(btrim(v_polo_size), '')");
    expect(migration).toContain("jsonb_strip_nulls");
    expect(migration).toContain("'akkai:display:station:' || NEW.station_id::text");
    expect(migration).toContain("'eventSequence', NEW.event_sequence::text");
    expect(migration).toContain("ELSE '{}'::jsonb");
  });
});
