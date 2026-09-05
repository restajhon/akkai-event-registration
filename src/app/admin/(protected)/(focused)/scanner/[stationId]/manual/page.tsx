import Link from "next/link";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/server";
import { loadAuthorizedManualStationContext } from "@/lib/manual-check-in/server";

import { ManualCheckInClient } from "./manual-check-in-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const stationIdSchema = z.string().uuid();

function ManualPageError({
  title,
  message,
  stationId,
}: {
  title: string;
  message: string;
  stationId?: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142842]">{title}</h1>
        <p
          className="mt-6 rounded-xl border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]"
          role="alert"
        >
          {message}
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          {stationId ? (
            <Link
              className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
              href={`/admin/scanner/${stationId}`}
            >
              Kembali ke Scanner
            </Link>
          ) : null}
          <Link
            className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
            href="/admin/scanner/pair"
          >
            Kembali ke Pairing
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function ManualCheckInPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const profile = await requirePermission("scanner.checkin");
  const { stationId: rawStationId } = await params;
  const parsedStationId = stationIdSchema.safeParse(rawStationId);

  if (!parsedStationId.success) {
    return (
      <ManualPageError
        title="Check-in Manual Tidak Tersedia"
        message="Station scanner tidak ditemukan. Buka kembali halaman pairing scanner."
      />
    );
  }

  const stationId = parsedStationId.data;
  const contextResult = await loadAuthorizedManualStationContext(
    profile,
    stationId,
  );

  if (contextResult.error) {
    return (
      <ManualPageError
        message={contextResult.error.message}
        stationId={stationId}
        title="Check-in Manual Tidak Tersedia"
      />
    );
  }

  const context = contextResult.context;

  return (
    <ManualCheckInClient
      sessionCode={context.sessionCode}
      sessionName={context.sessionName}
      stationId={context.stationId}
      stationName={context.stationName}
    />
  );
}
