import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractInbound } from "./lib/phone";

// Inbound side of the relay. Point AiSensy's webhook at
//   https://<deployment>.convex.site/aisensy/webhook?token=<AISENSY_WEBHOOK_TOKEN>
// (.site, not .cloud). The token is the only authentication: AiSensy does not
// document a signature, so a body arriving with the right token is trusted as
// far as "log it and show it in the thread", and no further.

const http = httpRouter();

function tokenOk(request: Request): number {
  const expected = process.env.AISENSY_WEBHOOK_TOKEN;
  if (!expected) return 503;
  const got = new URL(request.url).searchParams.get("token") ?? "";
  return got.length > 0 && got === expected ? 200 : 401;
}

http.route({
  path: "/aisensy/webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const code = tokenOk(request);
    return new Response(code === 200 ? "chasqui webhook ready" : code === 503 ? "webhook token not configured" : "bad token", { status: code });
  }),
});

http.route({
  path: "/aisensy/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const code = tokenOk(request);
    if (code !== 200) {
      return new Response(code === 503 ? "webhook token not configured" : "bad token", { status: code });
    }
    const raw = (await request.text()).slice(0, 20000);
    let parsed: unknown = null;
    try { parsed = JSON.parse(raw); } catch { parsed = { body: raw }; }
    const { phone, text } = extractInbound(parsed);
    await ctx.runMutation(internal.messages.log, {
      phone: phone ?? "unknown",
      direction: "in",
      text,
      status: "received",
      detail: raw,
    });
    return new Response("ok", { status: 200 });
  }),
});

export default http;
