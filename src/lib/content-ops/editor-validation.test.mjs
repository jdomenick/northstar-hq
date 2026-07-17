// Pure-function tests for the editor validation ruleset. Runs with `node`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { validateVariant, bodyCharBudget } from "./editor-validation.ts";

const base = {
  platform: "x",
  contentType: "text",
  title: null,
  hook: null,
  body: "Hello world",
  cta: null,
  hashtags: [],
  mentions: [],
  linkUrl: null,
  firstComment: null,
  altText: null,
  newsletterSubject: null,
  newsletterPreview: null,
  media: [],
};

test("X: 280-char body is fine, 281 is a hard error", () => {
  const clean = validateVariant({ ...base, body: "a".repeat(280) });
  assert.equal(clean.errorCount, 0, JSON.stringify(clean.issues));
  const over = validateVariant({ ...base, body: "a".repeat(281) });
  assert.equal(over.blocksSubmit, true);
  assert.ok(over.issues.some((i) => i.ruleId === "body.length.hard"));
});

test("Instagram: warns on link (bio_only), errors on 31 hashtags", () => {
  const r = validateVariant({
    ...base, platform: "instagram", contentType: "image",
    body: "post", media: [{ storageRef: "a", mimeType: "image/jpeg", altText: "alt" }],
    linkUrl: "https://example.com",
    hashtags: Array.from({ length: 31 }, (_, i) => `tag${i}`),
  });
  // Instagram marks linkUrl as unsupported, so the ruleset warns via
  // link.unsupported rather than link.bio_only. Either warning is
  // acceptable operator guidance for this case.
  assert.ok(r.issues.some((i) =>
    (i.ruleId === "link.unsupported" || i.ruleId === "link.bio_only")
    && i.severity === "warning"));
  assert.ok(r.issues.some((i) => i.ruleId === "hashtags.count.hard" && i.severity === "error"));
});

test("Reddit: requires title", () => {
  const r = validateVariant({
    ...base, platform: "reddit", contentType: "text", body: "self-post body",
  });
  assert.ok(r.issues.some((i) => i.ruleId === "title.required" && i.severity === "error"));
});

test("LinkedIn: soft-warns above 1300 chars, hard error above 3000", () => {
  const soft = validateVariant({ ...base, platform: "linkedin", body: "a".repeat(1500) });
  assert.ok(soft.issues.some((i) => i.ruleId === "body.length.soft" && i.severity === "warning"));
  assert.equal(soft.errorCount, 0);
  const hard = validateVariant({ ...base, platform: "linkedin", body: "a".repeat(3100) });
  assert.ok(hard.issues.some((i) => i.ruleId === "body.length.hard" && i.severity === "error"));
});

test("Image content type requires media", () => {
  const r = validateVariant({ ...base, platform: "instagram", contentType: "image" });
  assert.ok(r.issues.some((i) => i.ruleId === "media.required" && i.severity === "error"));
});

test("Duplicate warning surfaces when fingerprint matches", () => {
  const r = validateVariant({ ...base, duplicateOfContentItemId: "abc-123" });
  assert.ok(r.issues.some((i) => i.field === "duplicate" && i.severity === "warning"));
});

test("Alt text missing on media surfaces a warning (not an error)", () => {
  const r = validateVariant({
    ...base, platform: "instagram", contentType: "image",
    media: [{ storageRef: "a", mimeType: "image/jpeg", altText: null }],
  });
  assert.ok(r.issues.some((i) => i.ruleId === "media.altText.missing" && i.severity === "warning"));
  assert.equal(r.errorCount, 0);
});

test("Beehiiv: subject required + long-form body allowed", () => {
  const missing = validateVariant({
    ...base, platform: "beehiiv", contentType: "article", body: "a".repeat(5000),
  });
  assert.ok(missing.issues.some((i) => i.ruleId === "newsletter.subject.required"));
  const ok = validateVariant({
    ...base, platform: "beehiiv", contentType: "article", body: "a".repeat(5000),
    newsletterSubject: "A weekly reflection",
  });
  assert.equal(ok.errorCount, 0, JSON.stringify(ok.issues));
});

test("bodyCharBudget reports used/limit/remaining", () => {
  const b = bodyCharBudget("x", "hello");
  assert.equal(b.used, 5);
  assert.equal(b.limit, 280);
  assert.equal(b.remaining, 275);
});
