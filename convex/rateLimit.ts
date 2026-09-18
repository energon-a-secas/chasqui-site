import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Records one send attempt and reports whether the caller is over budget.
 *
 * The send action is public (the deployment URL ships in js/data.js), so
 * without this anyone could burn the AiSensy credits or spam a number. Actions
 * cannot see the caller's IP, so the keys are the destination number and a
 * global bucket. Returns rather than throws so the action words the message.
 */
export const recordAndCheck = internalMutation({
  args: { caller: v.string(), max: v.number(), windowMs: v.number() },
  handler: async (ctx, { caller, max, windowMs }) => {
    const cutoff = Date.now() - windowMs;
    const recent = await ctx.db
      .query("sendEvents")
      .withIndex("by_caller_at", (q) => q.eq("caller", caller).gte("at", cutoff))
      .collect();
    const stale = await ctx.db
      .query("sendEvents")
      .withIndex("by_caller_at", (q) => q.eq("caller", caller).lt("at", cutoff))
      .collect();
    for (const row of stale) await ctx.db.delete(row._id);
    if (recent.length >= max) {
      return { allowed: false, used: recent.length, max, windowMs };
    }
    await ctx.db.insert("sendEvents", { caller, at: Date.now() });
    return { allowed: true, used: recent.length + 1, max, windowMs };
  },
});
