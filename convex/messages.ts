import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeE164 } from "./lib/phone";

/** Rows the window shows per thread. */
const THREAD_LIMIT = 60;

/** How much of a provider response or webhook body is kept. */
export const DETAIL_LIMIT = 1200;

/**
 * The thread for one number, oldest first. Scoped by the number the visitor
 * typed, so anyone who knows a number can read its relay history; that is the
 * known exposure of this proof of concept and is recorded in CLAUDE.md.
 */
export const thread = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const key = normalizeE164(phone);
    if (!key) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_phone_at", (q) => q.eq("phone", key))
      .order("desc")
      .take(THREAD_LIMIT);
    return rows.reverse().map((m) => ({
      id: m._id,
      direction: m.direction,
      campaign: m.campaign ?? null,
      params: m.params ?? [],
      text: m.text,
      status: m.status,
      detail: m.detail ?? null,
      at: m.at,
    }));
  },
});

/** Counts only: no numbers leave the deployment through this query. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db.query("contacts").collect();
    const messages = await ctx.db.query("messages").collect();
    let out = 0, inbound = 0, accepted = 0;
    for (const m of messages) {
      if (m.direction === "out") { out++; if (m.status === "accepted") accepted++; }
      if (m.direction === "in") inbound++;
    }
    return { contacts: contacts.length, out, inbound, accepted };
  },
});

export const touchContact = internalMutation({
  args: { phone: v.string(), name: v.string(), source: v.optional(v.string()) },
  handler: async (ctx, { phone, name, source }) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { name, lastSeenAt: now, ...(source ? { source } : {}) });
      return existing._id;
    }
    return await ctx.db.insert("contacts", { phone, name, source, createdAt: now, lastSeenAt: now });
  },
});

export const log = internalMutation({
  args: {
    phone: v.string(),
    direction: v.union(v.literal("out"), v.literal("in"), v.literal("status")),
    campaign: v.optional(v.string()),
    params: v.optional(v.array(v.string())),
    text: v.string(),
    status: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      detail: args.detail?.slice(0, DETAIL_LIMIT),
      at: Date.now(),
    });
  },
});

export const setResult = internalMutation({
  args: { id: v.id("messages"), status: v.string(), text: v.string(), detail: v.optional(v.string()) },
  handler: async (ctx, { id, status, text, detail }) => {
    await ctx.db.patch(id, { status, text, detail: detail?.slice(0, DETAIL_LIMIT) });
  },
});
