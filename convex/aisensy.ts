import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { csv, normalizeE164 } from "./lib/phone";

/** AiSensy Direct API campaign endpoint (wiki.aisensy.com, API reference docs). */
const ENDPOINT = "https://backend.aisensy.com/campaign/t1/api/v2";

/** Sends allowed per destination number, and for the whole relay. */
const PER_PHONE = { max: 5, windowMs: 60 * 60 * 1000 };
const GLOBAL = { max: 40, windowMs: 24 * 60 * 60 * 1000 };

/**
 * Trigger one AiSensy API campaign for one number.
 *
 * The API key is read from the deployment (`npx convex env set AISENSY_API_KEY`)
 * and never leaves it: the browser calls this action, the action calls AiSensy.
 * Every refusal is also written to the thread so the window shows what
 * happened instead of a silent failure.
 */
export const send = action({
  args: {
    phone: v.string(),
    name: v.string(),
    campaignName: v.string(),
    templateParams: v.array(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const phone = normalizeE164(args.phone);
    if (!phone) {
      throw new ConvexError("Number must carry a country code, like +54 9 11 1234 5678.");
    }
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new ConvexError("A name is required; AiSensy stores it on the contact.");
    const campaignName = args.campaignName.trim().slice(0, 120);
    if (!campaignName) throw new ConvexError("Type the API campaign name exactly as it reads in AiSensy.");
    const templateParams = args.templateParams.map((p) => p.trim().slice(0, 500)).filter((p) => p.length > 0);

    const allowed = csv(process.env.AISENSY_ALLOWED_DESTINATIONS);
    if (allowed.length > 0 && !allowed.includes(phone)) {
      throw new ConvexError("This relay only sends to its allowlisted numbers while it is a proof of concept.");
    }
    const campaigns = csv(process.env.AISENSY_CAMPAIGNS);
    if (campaigns.length > 0 && !campaigns.includes(campaignName)) {
      throw new ConvexError(`Unknown campaign. This relay knows: ${campaigns.join(", ")}.`);
    }

    for (const [caller, limit] of [[`phone:${phone}`, PER_PHONE], ["global", GLOBAL]] as const) {
      const verdict = await ctx.runMutation(internal.rateLimit.recordAndCheck, { caller, ...limit });
      if (!verdict.allowed) {
        const scope = caller === "global" ? "the relay" : "this number";
        throw new ConvexError(
          `Rate limit for ${scope}: ${verdict.max} sends per ${Math.round(verdict.windowMs / 3600000)} h. Try later.`,
        );
      }
    }

    await ctx.runMutation(internal.messages.touchContact, { phone, name, source: args.source });
    const id = await ctx.runMutation(internal.messages.log, {
      phone, direction: "out", campaign: campaignName, params: templateParams,
      text: `Sending "${campaignName}"`, status: "queued",
    });

    const apiKey = process.env.AISENSY_API_KEY;
    if (!apiKey) {
      const text = "Not sent: AISENSY_API_KEY is not set on this deployment";
      await ctx.runMutation(internal.messages.setResult, { id, status: "rejected", text });
      return { ok: false, status: 0, text, detail: null };
    }

    const body = {
      apiKey,
      campaignName,
      destination: phone,
      userName: name,
      templateParams,
      source: args.source?.slice(0, 80) || "chasqui.neorgon.com",
    };

    let status = 0;
    let raw = "";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = res.status;
      raw = await res.text();
    } catch (err) {
      raw = err instanceof Error ? err.message : String(err);
    }

    // Never echo our own key back into the log, whatever the provider returned.
    const detail = raw.split(apiKey).join("[api key]").slice(0, 1200);
    const ok = status >= 200 && status < 300;
    const text = ok
      ? `AiSensy accepted "${campaignName}" for delivery`
      : status === 0
        ? "AiSensy unreachable"
        : `AiSensy refused (${status}): ${summarize(detail)}`;
    await ctx.runMutation(internal.messages.setResult, { id, status: ok ? "accepted" : "rejected", text, detail });
    return { ok, status, text, detail };
  },
});

/** One line out of a provider body, for the thread. */
function summarize(detail: string): string {
  try {
    const j = JSON.parse(detail);
    const msg = j?.errorMessage ?? j?.message ?? j?.error ?? j?.status;
    if (typeof msg === "string") return msg.slice(0, 200);
  } catch { /* not JSON */ }
  return detail.replace(/\s+/g, " ").slice(0, 200) || "no body";
}
