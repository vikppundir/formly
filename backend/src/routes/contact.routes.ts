/**
 * Contact / Demo Request Routes (public — no auth required)
 * Sends notification emails to Bhalekar team on form submission.
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createEmailService } from "../services/email.service.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";

const DEMO_RECIPIENTS = [
  "sandeep@bhalekar.ai",
  "vikas.pundir@bhalekar.com.au",
];

const demoRequestSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Valid email is required"),
  phone: z.string().max(30).optional().default(""),
  practiceSize: z.string().max(50).optional().default(""),
  message: z.string().max(2000).optional().default(""),
});

export async function registerContactRoutes(
  app: FastifyInstance,
  prisma: PrismaClient
): Promise<void> {
  const emailService = createEmailService(prisma);

  app.post("/contact/demo-request", async (request, reply) => {
    const parsed = demoRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { firstName, lastName, email, phone, practiceSize, message } =
      parsed.data;

    const now = new Date().toLocaleString("en-AU", {
      timeZone: "Australia/Melbourne",
    });

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#10172a;border-bottom:2px solid #4ec9fa;padding-bottom:10px;">
          New Demo Request — Onboard
        </h2>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 12px;font-weight:bold;color:#555;width:140px;">Name</td><td style="padding:8px 12px;">${firstName} ${lastName}</td></tr>
          <tr style="background:#f8fcff;"><td style="padding:8px 12px;font-weight:bold;color:#555;">Email</td><td style="padding:8px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;color:#555;">Phone</td><td style="padding:8px 12px;">${phone || "—"}</td></tr>
          <tr style="background:#f8fcff;"><td style="padding:8px 12px;font-weight:bold;color:#555;">Practice Size</td><td style="padding:8px 12px;">${practiceSize || "—"}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;color:#555;">Message</td><td style="padding:8px 12px;">${message || "—"}</td></tr>
          <tr style="background:#f8fcff;"><td style="padding:8px 12px;font-weight:bold;color:#555;">Submitted</td><td style="padding:8px 12px;">${now} (AEST)</td></tr>
        </table>
        <p style="color:#888;font-size:12px;">This is an automated notification from the Onboard website.</p>
      </div>
    `;

    const textBody = `New Demo Request — Onboard\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone || "—"}\nPractice Size: ${practiceSize || "—"}\nMessage: ${message || "—"}\nSubmitted: ${now} (AEST)`;

    // Log every request regardless of email outcome
    logger.info(
      { firstName, lastName, email, phone, practiceSize },
      "Demo request received"
    );

    // Attempt to send emails to all recipients
    const results = await Promise.allSettled(
      DEMO_RECIPIENTS.map((to) =>
        emailService.sendRaw({
          to,
          subject: `[Onboard Demo] New request from ${firstName} ${lastName}`,
          html: htmlBody,
          text: textBody,
        })
      )
    );

    const anySuccess = results.some(
      (r) => r.status === "fulfilled" && r.value.success
    );

    if (!anySuccess) {
      // Email delivery failed, but the lead is logged
      logger.warn(
        { results: results.map((r) => (r.status === "fulfilled" ? r.value : r.reason)) },
        "Demo request emails could not be sent (lead is logged)"
      );
    }

    return reply.send({
      success: true,
      message: "Demo request submitted successfully. We will be in touch soon!",
    });
  });
}
