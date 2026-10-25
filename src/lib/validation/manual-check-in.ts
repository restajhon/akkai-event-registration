import { z } from "zod";

export const manualStationIdSchema = z.string().uuid();

export const manualRegistrationIdSchema = z
  .string()
  .regex(/^[A-Z0-9]{2,16}-[0-9]{6}$/);

export const manualSearchInputSchema = z.object({
  stationId: manualStationIdSchema,
  query: z.string().trim().max(100),
});

export const manualCheckInInputSchema = z.object({
  stationId: manualStationIdSchema,
  registrationId: manualRegistrationIdSchema,
});
