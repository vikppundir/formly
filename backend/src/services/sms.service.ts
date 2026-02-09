import Twilio from "twilio";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { createEmailTemplateRepository } from "../repositories/email-template.repository.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

interface SendSmsParams {
  to: string;
  templateCode?: string;
  message?: string;
  variables?: Record<string, string>;
}

export function createSmsService(prisma: PrismaClient) {
  const settingsRepo = createSettingsRepository(prisma);
  const templateRepo = createEmailTemplateRepository(prisma);

  // Replace template variables
  function replaceVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
  }

  // Get Twilio client
  async function getTwilioClient() {
    const [accountSid, authToken] = await Promise.all([
      settingsRepo.getValue("twilio_account_sid"),
      settingsRepo.getValue("twilio_auth_token"),
    ]);

    if (!accountSid || !authToken) {
      throw new Error("Twilio configuration incomplete");
    }

    return Twilio(accountSid, authToken);
  }

  return {
    // Send SMS
    async send(params: SendSmsParams): Promise<{ success: boolean; error?: string; sid?: string }> {
      try {
        const [appName, fromNumber] = await Promise.all([
          settingsRepo.getValue("app_name", "Formly"),
          settingsRepo.getValue("twilio_phone_number"),
        ]);

        if (!fromNumber) {
          return { success: false, error: "Twilio phone number not configured" };
        }

        let message = params.message || "";

        // If using template
        if (params.templateCode) {
          const template = await templateRepo.findByCode(params.templateCode);
          if (!template || !template.isActive) {
            return { success: false, error: `Template "${params.templateCode}" not found or inactive` };
          }
          // SMS uses bodyText field
          message = template.bodyText || "";
        }

        if (!message) {
          return { success: false, error: "No message content" };
        }

        // Replace variables
        const variables = { ...params.variables, appName };
        const body = replaceVariables(message, variables);

        // Normalize phone number (add + if missing for international)
        let toNumber = params.to;
        if (!toNumber.startsWith("+")) {
          // Assume India (+91) if no country code - adjust as needed
          toNumber = toNumber.startsWith("91") ? `+${toNumber}` : `+91${toNumber}`;
        }

        const client = await getTwilioClient();
        const result = await client.messages.create({
          to: toNumber,
          from: fromNumber,
          body,
        });

        logger.info("SMS sent via Twilio", { phone: toNumber, sid: result.sid });
        return { success: true, sid: result.sid };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        logger.error("SMS send failed", { error: msg, phone: params.to });
        return { success: false, error: msg };
      }
    },

    // Send OTP SMS
    async sendOtp(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
      const expiryMinutes = await settingsRepo.getValue("otp_expiry_minutes", "10");
      return this.send({
        to,
        templateCode: "phone_verification",
        variables: { otp, expiryMinutes },
      });
    },

    // Test Twilio configuration
    async testConnection(): Promise<{ success: boolean; error?: string }> {
      try {
        const client = await getTwilioClient();
        // Verify credentials by fetching account info
        await client.api.accounts.list({ limit: 1 });
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Connection failed";
        return { success: false, error: msg };
      }
    },
  };
}
