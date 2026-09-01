import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const requestSchema = z
  .object({
    stationId: z.string().uuid(),
    qrValue: z.string().trim().min(1).max(512),
  })
  .strict();

const rpcResultSchema = z.object({
  status_code: z.string(),
  result_status: z.string(),
  registration_id: z.string().nullable(),
  full_name: z.string().nullable(),
  institution: z.string().nullable(),
  participant_category: z.string().nullable(),
  session_code: z.string().nullable(),
  session_name: z.string().nullable(),
  checked_at: z.string().nullable(),
  is_duplicate: z.boolean(),
});

type RpcResult = z.infer<typeof rpcResultSchema>;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

function jsonResponse(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

function invalidRequestResponse(message: string) {
  return jsonResponse(
    {
      status: "invalid-request",
      message,
    },
    400,
  );
}

function forbiddenResponse() {
  return jsonResponse(
    {
      status: "forbidden",
      message: "Anda tidak memiliki akses untuk melakukan scan.",
    },
    403,
  );
}

function internalErrorResponse() {
  return jsonResponse(
    {
      status: "internal-error",
      message: "Terjadi kendala saat memproses scan. Silakan coba kembali.",
    },
    500,
  );
}

function participantResponse(row: RpcResult) {
  if (
    row.registration_id === null ||
    row.full_name === null ||
    row.participant_category === null ||
    row.session_code === null ||
    row.session_name === null ||
    row.checked_at === null
  ) {
    return null;
  }

  return {
    participant: {
      registrationId: row.registration_id,
      fullName: row.full_name,
      institution: row.institution,
      participantCategory: row.participant_category,
    },
    session: {
      code: row.session_code,
      name: row.session_name,
    },
    checkedAt: row.checked_at,
  };
}

function mapRpcResult(row: RpcResult) {
  switch (row.status_code) {
    case "success": {
      const response = participantResponse(row);

      return response
        ? jsonResponse(
            {
              status: "success",
              ...response,
            },
            200,
          )
        : internalErrorResponse();
    }
    case "success-with-warning": {
      const response = participantResponse(row);

      return response
        ? jsonResponse(
            {
              status: "success-with-warning",
              message:
                "Check-in berhasil, tetapi peserta belum tercatat pada sesi kedatangan.",
              ...response,
            },
            200,
          )
        : internalErrorResponse();
    }
    case "already-checked-in": {
      const response = participantResponse(row);

      return response
        ? jsonResponse(
            {
              status: "already-checked-in",
              message: "Peserta sudah check-in pada sesi ini.",
              ...response,
            },
            200,
          )
        : internalErrorResponse();
    }
    case "invalid-qr":
      return jsonResponse(
        {
          status: "invalid-qr",
          message: "QR tidak valid.",
        },
        200,
      );
    case "cancelled-participant":
      return jsonResponse(
        {
          status: "cancelled-participant",
          message: "Pendaftaran peserta telah dibatalkan.",
        },
        200,
      );
    case "unauthorized-operator":
      return forbiddenResponse();
    case "invalid-station":
      return jsonResponse(
        {
          status: "invalid-station",
          message: "Station tidak ditemukan.",
        },
        404,
      );
    case "station-not-paired":
      return jsonResponse(
        {
          status: "station-not-paired",
          message: "Station belum siap digunakan.",
        },
        409,
      );
    case "station-owned-by-other-operator":
      return jsonResponse(
        {
          status: "station-owned-by-other-operator",
          message: "Station terikat ke operator lain.",
        },
        403,
      );
    case "closed-session":
      return jsonResponse(
        {
          status: "closed-session",
          message: "Sesi check-in belum dibuka atau telah ditutup.",
        },
        409,
      );
    default:
      return internalErrorResponse();
  }
}

export async function POST(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return invalidRequestResponse("Request tidak valid.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidRequestResponse("Request tidak valid.");
  }

  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return invalidRequestResponse("Data scan tidak valid.");
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || typeof userId !== "string") {
      return jsonResponse(
        {
          status: "unauthorized",
          message: "Authentication diperlukan.",
        },
        401,
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, is_active, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to validate scanner operator profile");
      return internalErrorResponse();
    }

    if (
      !profile ||
      profile.is_active !== true ||
      (profile.role !== "ADMIN" && profile.role !== "OPERATOR")
    ) {
      return forbiddenResponse();
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc("process_qr_scan", {
      p_qr_token: parsedRequest.data.qrValue,
      p_station_id: parsedRequest.data.stationId,
      p_operator_profile_id: profile.id,
    });

    if (error) {
      console.error("QR scan processing failed");
      return internalErrorResponse();
    }

    const rpcRow = Array.isArray(data) ? data[0] : data;
    const parsedResult = rpcResultSchema.safeParse(rpcRow);

    if (!parsedResult.success) {
      console.error("QR scan returned an invalid result");
      return internalErrorResponse();
    }

    return mapRpcResult(parsedResult.data);
  } catch {
    console.error("QR scan processing failed");
    return internalErrorResponse();
  }
}
