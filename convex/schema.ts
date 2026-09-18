import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Three tables. `contacts` is the people the relay has talked to, `messages` is
// the thread the window shows (outbound sends, inbound webhook events, status
// updates), and `sendEvents` exists only so the public send action can be
// rate limited, which cannot be done statelessly.
export default defineSchema({
  contacts: defineTable({
    phone: v.string(),            // E.164 with the leading +
    name: v.string(),
    source: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_phone", ["phone"]),

  messages: defineTable({
    phone: v.string(),            // E.164, or "unknown" for a webhook body with no sender
    direction: v.union(v.literal("out"), v.literal("in"), v.literal("status")),
    campaign: v.optional(v.string()),
    params: v.optional(v.array(v.string())),
    text: v.string(),             // the one line the window shows
    status: v.string(),           // queued | accepted | rejected | received
    detail: v.optional(v.string()), // provider response or raw webhook body, truncated
    at: v.number(),
  }).index("by_phone_at", ["phone", "at"]),

  sendEvents: defineTable({
    caller: v.string(),           // "phone:+1555..." or "global"
    at: v.number(),
  }).index("by_caller_at", ["caller", "at"]),
});
