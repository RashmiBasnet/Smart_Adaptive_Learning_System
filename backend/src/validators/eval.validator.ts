import { z } from "zod";

// A held-out submission is just picked options per question. No timing or other
// adaptive metadata — the eval instrument only produces a score.
export const evalSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int(),
        selectedOptionId: z.number().int().nullable().optional(),
      })
    )
    .min(1),
});

export type EvalSubmitInput = z.infer<typeof evalSubmitSchema>;
