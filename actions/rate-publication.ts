import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { ballotSchema } from "../shared/publications.js";
import { ratePublication } from "../server/publishing/repository.js";
export default defineAction({
  description:
    "Save the caller's one editable ICYOA rating, or remove it with ballot=null. Scores are integers 0–5; overall is explicitly chosen, never computed from optional writing/gameplay/presentation scores. Cannot rate your own release.",
  schema: z.object({ id: z.string().min(1), ballot: ballotSchema.nullable() }),
  audit: { recordInputs: false },
  run: async ({ id, ballot }, ctx) => ratePublication(id, ballot, ctx),
});
