import { z } from "zod";
import { ErrorResponseSchema } from "../../lib/errors";

export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.email().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const MeSchema = {
  response: {
    200: MeResponseSchema,
    401: ErrorResponseSchema,
  },
};
