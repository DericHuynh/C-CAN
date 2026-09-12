/**
 * Eval: the agent imports a CYOA document and reports its structure.
 */
import { defineEval, contains, usesTool } from "@agent-native/core/eval";

const SAMPLE_DOC = {
  pointTypes: [
    { id: "gold", name: "Gold", startingSum: 100, initValue: 0, beforeText: "", afterText: " gold" },
  ],
  rows: [
    {
      id: "row-1",
      index: 0,
      title: "The Crossing",
      titleText: "A river blocks your path.",
      objects: [
        {
          id: "choice-1",
          index: 0,
          title: "Pay the ferry",
          text: "The ferryman wants 10 gold.",
          scores: [{ id: "gold", value: -10 }],
        },
        {
          id: "choice-2",
          index: 1,
          title: "Swim across",
          text: "Free, but cold.",
          scores: [],
        },
      ],
    },
  ],
};

export default defineEval({
  name: "imports a CYOA document and reports its structure",
  input: {
    prompt: `Import this CYOA document via import-project-json with title "Ferry Crossing", then tell me how many rows it has and the name of the point type. Document: ${JSON.stringify(SAMPLE_DOC)}`,
  },
  threshold: 0.7,
  scorers: [usesTool("import-project-json"), contains(["1", "Gold"])],
});
