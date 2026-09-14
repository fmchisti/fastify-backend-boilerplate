import { getAuthUser } from "../../middleware/authorize";
import type { ZodRouteHandler } from "../../types/fastify";
import type { MeSchema } from "./schema";

export const meHandler: ZodRouteHandler<typeof MeSchema> = async (request) => {
  return getAuthUser(request);
};
