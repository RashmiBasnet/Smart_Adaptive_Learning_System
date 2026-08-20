import { z } from "zod";

// A held-out submission: which phase (pre/post), the study condition the
// surrounding learning session ran in (optional research metadata), and the
// picked options per question. No timing or other adaptive metadata — the eval
// instrument only produces a score.
export const evalSubmitSchema = z.object({
  phase: z.enum(["PRE", "POST"]),
  studyMode: z.enum(["transparent", "opaque"]).optional(),
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
