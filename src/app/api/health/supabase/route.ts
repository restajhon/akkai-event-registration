import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // This verifies that the Supabase URL and publishable key
    // can reach the authentication service.
    const { error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          service: "supabase",
          message: "Supabase connection failed.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      service: "supabase",
      message: "Supabase connection is available.",
    });
  } catch (error) {
    console.error("Supabase health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        service: "supabase",
        message: "Supabase configuration is invalid.",
      },
      { status: 500 },
    );
  }
}