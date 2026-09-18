/**
 * Phone normalisation, pure so it can be unit tested without a deployment.
 *
 * AiSensy resolves a number with no country code to India (+91) by default,
 * which is exactly the kind of silent default a relay must not inherit, so the
 * server refuses anything that does not carry an explicit country code.
 */
export function normalizeE164(input: string): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[\s().-]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) return null;
  const digits = s.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return "+" + digits;
}

/** Parse a comma separated env var into trimmed, non-empty entries. */
export function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** Best effort sender and text extraction from a webhook body of unknown shape. */
export function extractInbound(body: unknown): { phone: string | null; text: string } {
  const b = (body ?? {}) as Record<string, any>;
  const candidates = [
    b.from, b.sender, b.waId, b.wa_id, b.phone, b.mobile, b.destination,
    b.contact?.phone, b.contact?.wa_id, b.data?.from, b.data?.phone,
    b.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
    b.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.recipient_id,
  ];
  let phone: string | null = null;
  for (const c of candidates) {
    if (typeof c === "string" || typeof c === "number") {
      const raw = String(c);
      phone = normalizeE164(raw.startsWith("+") ? raw : "+" + raw);
      if (phone) break;
    }
  }
  const textCandidates = [
    b.text, b.message?.text, b.message?.body, b.body, b.data?.text,
    b.message, b.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body,
    b.status, b.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.status,
  ];
  let text = "";
  for (const t of textCandidates) {
    if (typeof t === "string" && t.trim()) { text = t.trim(); break; }
  }
  return { phone, text: text || "(event with no text)" };
}
