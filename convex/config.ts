import { query } from "./_generated/server";
import { csv } from "./lib/phone";

/**
 * What the window needs to know about the deployment, none of it secret:
 * whether the key and the webhook token are set (booleans only), the campaign
 * names the relay will accept, and the bot's own number for the chat link.
 */
export const status = query({
  args: {},
  handler: async () => ({
    keyConfigured: Boolean(process.env.AISENSY_API_KEY),
    webhookConfigured: Boolean(process.env.AISENSY_WEBHOOK_TOKEN),
    campaigns: csv(process.env.AISENSY_CAMPAIGNS),
    allowlistSize: csv(process.env.AISENSY_ALLOWED_DESTINATIONS).length,
    botNumber: process.env.AISENSY_BOT_NUMBER ?? "",
  }),
});
