import test from "node:test";
import assert from "node:assert/strict";
import { toConversationalText, humanizeStructuredValue } from "./humanize.ts";

const LEAK = JSON.stringify([
  {
    executive_summary: "Revenue should come from the businesses closest to cash.",
    strategic_recommendations: [
      { title: "NorthStar Labs", description: "Shift from building to selling." },
      { title: "Elite Fleet Rides", description: "Increase profitable bookings." },
    ],
    relevant_context: {
      ventures: ["6f1c2f9e-9a1b-4f3c-8b21-2b6d7c1a0e55"],
      goals: ["1f1c2f9e-9a1b-4f3c-8b21-2b6d7c1a0e55"],
      projects: [],
    },
    clarifying_questions: ["What is the current EFR booking volume?"],
  },
]);

test("structured payload becomes prose with no JSON or ids", () => {
  const out = toConversationalText(LEAK);
  assert.match(out, /Revenue should come from/);
  assert.match(out, /1\. NorthStar Labs: Shift from building to selling\./);
  assert.ok(!out.includes("{"));
  assert.ok(!out.includes("relevant_context"));
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}/i.test(out));
});

test("fenced JSON is unwrapped", () => {
  const out = toConversationalText("```json\n{\"answer\":\"Focus on cash today.\"}\n```");
  assert.equal(out, "Focus on cash today.");
});

test("malformed structured output never leaks the payload", () => {
  const out = toConversationalText('{"executive_summary": "broken, ');
  assert.ok(!out.includes("executive_summary"));
  assert.match(out, /formatting problem/i);
});

test("unusable structured output falls back safely", () => {
  const out = toConversationalText('{"relevant_context":{"ventures":["a"]}}');
  assert.ok(!out.includes("relevant_context"));
  assert.match(out, /formatting problem/i);
});

test("plain prose passes through with ids stripped", () => {
  const out = toConversationalText(
    "Close the NorthStar deal (6f1c2f9e-9a1b-4f3c-8b21-2b6d7c1a0e55) this week.",
  );
  assert.equal(out, "Close the NorthStar deal this week.");
});

test("non-revenue structured payload renders sections", () => {
  const out = humanizeStructuredValue({
    answer: "Delivery is on track.",
    risks: ["One milestone is late."],
    citations: [{ entity_id: "x" }],
  });
  assert.match(out, /Risks:\n- One milestone is late\./);
  assert.ok(!out.includes("entity_id"));
});
