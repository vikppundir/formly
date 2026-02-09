import { z } from "zod";

// Update settings (bulk)
export const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    })
  ),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Email template create/update
export const emailTemplateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Code must be lowercase with underscores only"),
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  variables: z.string().optional(), // JSON array of variable names
  isActive: z.boolean().optional(),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

// Email template update (partial)
export const emailTemplateUpdateSchema = emailTemplateSchema.partial().omit({ code: true });
export type EmailTemplateUpdateInput = z.infer<typeof emailTemplateUpdateSchema>;

// Test email
export const testEmailSchema = z.object({
  to: z.string().email(),
});

// Test SMS
export const testSmsSchema = z.object({
  to: z.string().regex(/^\+?[1-9]\d{6,14}$/),
});

// Query params for template list
export const templateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});
