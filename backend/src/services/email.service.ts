import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { createEmailTemplateRepository } from "../repositories/email-template.repository.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

interface SendEmailParams {
  to: string;
  templateCode: string;
  variables: Record<string, string>;
}

export function createEmailService(prisma: PrismaClient) {
  const settingsRepo = createSettingsRepository(prisma);
  const templateRepo = createEmailTemplateRepository(prisma);

  // Replace template variables like {{name}} with actual values
  function replaceVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
  }

  // Get SMTP transporter based on settings
  async function getSmtpTransporter() {
    const [host, port, user, pass] = await Promise.all([
      settingsRepo.getValue("smtp_host"),
      settingsRepo.getValue("smtp_port", "587"),
      settingsRepo.getValue("smtp_user"),
      settingsRepo.getValue("smtp_pass"),
    ]);

    if (!host || !user || !pass) {
      throw new Error("SMTP configuration incomplete");
    }

    return nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: { user, pass },
    });
  }

  // Send via SMTP
  async function sendSmtp(params: {
    to: string;
    from: string;
    fromName: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    const transporter = await getSmtpTransporter();
    await transporter.sendMail({
      from: `"${params.fromName}" <${params.from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    logger.info({ to: params.to, subject: params.subject }, "Email sent via SMTP");
  }

  // Send via SendGrid
  async function sendSendGrid(params: {
    to: string;
    from: string;
    fromName: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    const apiKey = await settingsRepo.getValue("sendgrid_api_key");
    if (!apiKey) throw new Error("SendGrid API key not configured");

    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: params.to,
      from: { email: params.from, name: params.fromName },
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ""),
    });
    logger.info({ to: params.to, subject: params.subject }, "Email sent via SendGrid");
  }

  return {
    // Send email using template
    async send(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
      try {
        // Get template
        const template = await templateRepo.findByCode(params.templateCode);
        if (!template || !template.isActive) {
          return { success: false, error: `Template "${params.templateCode}" not found or inactive` };
        }

        // Get email provider settings
        const [provider, appName] = await Promise.all([
          settingsRepo.getValue("email_provider", "smtp"),
          settingsRepo.getValue("app_name", "Formly"),
        ]);

        // Add app name to variables
        const variables = { ...params.variables, appName };

        // Process template
        const subject = replaceVariables(template.subject, variables);
        const html = replaceVariables(template.bodyHtml, variables);
        const text = template.bodyText ? replaceVariables(template.bodyText, variables) : undefined;

        // Get from settings
        const fromKey = provider === "sendgrid" ? "sendgrid_from_email" : "smtp_from_email";
        const fromNameKey = provider === "sendgrid" ? "sendgrid_from_name" : "smtp_from_name";
        const [from, fromName] = await Promise.all([
          settingsRepo.getValue(fromKey),
          settingsRepo.getValue(fromNameKey, "Formly"),
        ]);

        if (!from) {
          return { success: false, error: "From email not configured" };
        }

        const emailParams = { to: params.to, from, fromName, subject, html, text };

        // Send based on provider
        if (provider === "sendgrid") {
          await sendSendGrid(emailParams);
        } else {
          await sendSmtp(emailParams);
        }

        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        logger.error({ error: msg, to: params.to, templateCode: params.templateCode }, "Email send failed");
        return { success: false, error: msg };
      }
    },

    // Send raw email (without template)
    async sendRaw(params: {
      to: string;
      subject: string;
      html: string;
      text?: string;
    }): Promise<{ success: boolean; error?: string }> {
      try {
        const [provider, from, fromName] = await Promise.all([
          settingsRepo.getValue("email_provider", "smtp"),
          settingsRepo.getValue(
            await settingsRepo.getValue("email_provider") === "sendgrid"
              ? "sendgrid_from_email"
              : "smtp_from_email"
          ),
          settingsRepo.getValue(
            await settingsRepo.getValue("email_provider") === "sendgrid"
              ? "sendgrid_from_name"
              : "smtp_from_name",
            "Formly"
          ),
        ]);

        if (!from) {
          return { success: false, error: "From email not configured" };
        }

        const emailParams = { ...params, from, fromName };

        if (provider === "sendgrid") {
          await sendSendGrid(emailParams);
        } else {
          await sendSmtp(emailParams);
        }

        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        logger.error({ error: msg }, "Raw email send failed");
        return { success: false, error: msg };
      }
    },

    // Test email configuration
    async testConnection(): Promise<{ success: boolean; error?: string }> {
      try {
        const provider = await settingsRepo.getValue("email_provider", "smtp");

        if (provider === "sendgrid") {
          const apiKey = await settingsRepo.getValue("sendgrid_api_key");
          if (!apiKey) return { success: false, error: "SendGrid API key not configured" };
          // SendGrid doesn't have a direct test method; we just validate key exists
          return { success: true };
        } else {
          const transporter = await getSmtpTransporter();
          await transporter.verify();
          return { success: true };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Connection failed";
        return { success: false, error: msg };
      }
    },
  };
}
