import { z } from "zod";

export const participantCheckInEventSchema = z
  .object({
    status: z.enum([
      "success",
      "success-with-warning",
      "already-checked-in",
    ]),
    participant: z
      .object({
        registrationId: z.string().min(1),
        fullName: z.string().min(1),
        institution: z.string().min(1).nullable(),
        participantCategory: z.string().min(1).nullable(),
      })
      .strict(),
    session: z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
      })
      .strict(),
    station: z
      .object({
        name: z.string().min(1),
      })
      .strict(),
    eventAt: z.string().datetime({ offset: true }),
    eventSequence: z.string().regex(/^[1-9][0-9]*$/),
  })
  .strict();

export type ParticipantCheckInEvent = z.infer<
  typeof participantCheckInEventSchema
>;
