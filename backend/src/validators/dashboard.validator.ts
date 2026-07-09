import { z } from "zod";

// :conceptId route param — numeric id, consistent with the quiz routes.
export const conceptIdParamSchema = z.object({
  conceptId: z.coerce.number().int().positive(),
});
