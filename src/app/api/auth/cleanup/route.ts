import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}
