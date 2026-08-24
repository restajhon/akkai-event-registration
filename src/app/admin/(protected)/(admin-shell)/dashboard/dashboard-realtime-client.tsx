"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  participantCheckInEventSchema,
} from "@/lib/realtime/participant-check-in-event";
import { getDashboardRealtimeTopic } from "@/lib/realtime/topics";
import { createClient } from "@/lib/supabase/client";

const REFRESH_WINDOW_MS = 300;

type DashboardRealtimeClientProps = {
  sessionIds: string[];
};

export function DashboardRealtimeClient({
  sessionIds,
}: DashboardRealtimeClientProps) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const sessionKey = sessionIds.join(",");

  useEffect(() => {
    if (!sessionKey) {
      return;
    }

    let isMounted = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const channels: Array<ReturnType<typeof supabase.channel>> = [];
    const activeSessionIds = sessionKey.split(",");

    function scheduleRefresh() {
      if (!isMounted || refreshTimer !== null) {
        return;
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;

        if (isMounted) {
          router.refresh();
        }
      }, REFRESH_WINDOW_MS);
    }

    async function subscribeToAttendance() {
      try {
        await supabase.realtime.setAuth();

        if (!isMounted) {
          return;
        }

        for (const sessionId of activeSessionIds) {
          const channel = supabase.channel(getDashboardRealtimeTopic(sessionId), {
            config: {
              private: true,
              broadcast: {
                replication_ready: true,
              },
            },
          });

          channel
            .on("broadcast", { event: "participant-check-in" }, (message) => {
              if (!isMounted) {
                return;
              }

              const candidate = {
                status: message.payload?.status,
                participant: message.payload?.participant,
                session: message.payload?.session,
                station: message.payload?.station,
                eventAt: message.payload?.eventAt,
                eventSequence: message.payload?.eventSequence,
              };
              const parsedEvent = participantCheckInEventSchema.safeParse(candidate);

              if (
                parsedEvent.success &&
                (parsedEvent.data.status === "success" ||
                  parsedEvent.data.status === "success-with-warning")
              ) {
                scheduleRefresh();
              }
            })
            .subscribe((status) => {
              if (isMounted && status === "SUBSCRIBED") {
                scheduleRefresh();
              }
            });

          channels.push(channel);
        }
      } catch {
        // The dashboard remains usable through its server-rendered data.
      }
    }

    void subscribeToAttendance();

    return () => {
      isMounted = false;

      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }

      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [router, sessionKey, supabase]);

  return null;
}
