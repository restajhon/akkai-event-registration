import type { NextConfig } from "next";

function getSupabaseOrigins() {
  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!rawSupabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required for Vercel deployments.",
    );
  }

  let supabaseUrl: URL;

  try {
    supabaseUrl = new URL(rawSupabaseUrl);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL for Vercel deployments.",
    );
  }

  if (
    supabaseUrl.protocol !== "https:" ||
    !supabaseUrl.hostname ||
    supabaseUrl.username ||
    supabaseUrl.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL without credentials for Vercel deployments.",
    );
  }

  return {
    httpsOrigin: supabaseUrl.origin,
    websocketOrigin: `wss://${supabaseUrl.host}`,
  };
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    const vercelEnvironment = process.env.VERCEL_ENV;
    const isPreview = vercelEnvironment === "preview";
    const isVercelDeployment =
      isPreview || vercelEnvironment === "production";

    if (isVercelDeployment) {
      const { httpsOrigin, websocketOrigin } = getSupabaseOrigins();

      if (!isPreview) {
        return [];
      }

      const contentSecurityPolicy = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self'",
        "font-src 'self'",
        `connect-src 'self' ${httpsOrigin} ${websocketOrigin}`,
        "media-src 'self'",
        "worker-src 'self'",
      ].join("; ");

      return [
        {
          source: "/(.*)",
          headers: [
            {
              key: "Content-Security-Policy-Report-Only",
              value: contentSecurityPolicy,
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value:
                "camera=(self), microphone=(), geolocation=(), usb=(), payment=()",
            },
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
          ],
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
