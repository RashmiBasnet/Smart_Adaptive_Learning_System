import { z } from "zod";

export const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int(),
        selectedOptionId: z.number().int().nullable().optional(),
        timeTakenSeconds: z.number().int().nonnegative().optional(),
      })
    )
    .min(1),
});

export type SubmitInput = z.infer<typeof submitSchema>;
