import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeE164, csv, extractInbound } from "../convex/lib/phone.ts";

test("normalizeE164 accepts an explicit country code in any common spelling", () => {
  assert.equal(normalizeE164("+1 555 331 0925"), "+15553310925");
  assert.equal(normalizeE164("+54 (9) 11-1234-5678"), "+5491112345678");
  assert.equal(normalizeE164("0015553310925"), "+15553310925");
});

test("normalizeE164 refuses a number with no country code (AiSensy would default it to +91)", () => {
  assert.equal(normalizeE164("5553310925"), null);
  assert.equal(normalizeE164("15553310925"), null);
});

test("normalizeE164 refuses garbage and out-of-range lengths", () => {
  assert.equal(normalizeE164(""), null);
  assert.equal(normalizeE164("+0123456789"), null);
  assert.equal(normalizeE164("+1234567"), null);
  assert.equal(normalizeE164("+1234567890123456"), null);
  assert.equal(normalizeE164("+1 555 hello"), null);
});

test("csv trims and drops empties", () => {
  assert.deepEqual(csv(" a, b ,,c "), ["a", "b", "c"]);
  assert.deepEqual(csv(undefined), []);
});

test("extractInbound reads a flat AiSensy-style body", () => {
  const r = extractInbound({ from: "15553310925", text: "hola" });
  assert.equal(r.phone, "+15553310925");
  assert.equal(r.text, "hola");
});

test("extractInbound reads a Meta Cloud API shaped body", () => {
  const body = { entry: [{ changes: [{ value: { messages: [{ from: "5491112345678", text: { body: "hi" } }] } }] }] };
  const r = extractInbound(body);
  assert.equal(r.phone, "+5491112345678");
  assert.equal(r.text, "hi");
});

test("extractInbound survives an empty or unknown body", () => {
  assert.deepEqual(extractInbound(null), { phone: null, text: "(event with no text)" });
  assert.equal(extractInbound({ weird: 1 }).phone, null);
});
