/**
 * Seed script: Roles & Permissions (RBAC) + default admin user
 * Run: npm run db:seed (from backend) or npm run db:seed (from root)
 * Migration note: Run db:migrate before seed.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();
const DEFAULT_ADMIN_PASSWORD = "Admin123!";
const ROLES = [
    { name: "Super Admin", description: "Full system access" },
    { name: "Admin", description: "Administrative access" },
    { name: "Manager", description: "Management and reporting" },
    { name: "User", description: "Standard user access" },
];
const PERMISSIONS = [
    { code: "view_dashboard", name: "View Dashboard", description: "Access dashboard overview" },
    { code: "manage_users", name: "Manage Users", description: "Create, edit, deactivate users" },
    { code: "manage_roles", name: "Manage Roles", description: "Assign roles and permissions" },
    { code: "manage_settings", name: "Manage Settings", description: "Configure app settings, email, SMS" },
];
const EMAIL_TEMPLATES = [
    {
        code: "email_verification",
        name: "Email Verification OTP",
        subject: "Verify your email - {{appName}}",
        bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify your email</h2>
      <p>Hi {{name}},</p>
      <p>Your verification code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; background: #f5f5f5; text-align: center; border-radius: 8px;">{{otp}}</div>
      <p>This code expires in {{expiryMinutes}} minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>`,
        bodyText: "Hi {{name}}, Your verification code is: {{otp}}. This code expires in {{expiryMinutes}} minutes.",
        variables: JSON.stringify(["name", "otp", "expiryMinutes", "appName"]),
    },
    {
        code: "phone_verification",
        name: "Phone Verification OTP",
        subject: "Phone Verification",
        bodyHtml: "",
        bodyText: "{{appName}}: Your verification code is {{otp}}. Expires in {{expiryMinutes}} min.",
        variables: JSON.stringify(["otp", "expiryMinutes", "appName"]),
    },
    {
        code: "welcome",
        name: "Welcome Email",
        subject: "Welcome to {{appName}}!",
        bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to {{appName}}!</h2>
      <p>Hi {{name}},</p>
      <p>Thank you for signing up. Your account is now active.</p>
      <p>Get started by exploring your dashboard.</p>
    </div>`,
        bodyText: "Hi {{name}}, Welcome to {{appName}}! Your account is now active.",
        variables: JSON.stringify(["name", "appName"]),
    },
    {
        code: "password_reset",
        name: "Password Reset OTP",
        subject: "Reset your password - {{appName}}",
        bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Hi {{name}},</p>
      <p>Your password reset code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; background: #f5f5f5; text-align: center; border-radius: 8px;">{{otp}}</div>
      <p>This code expires in {{expiryMinutes}} minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>`,
        bodyText: "Hi {{name}}, Your password reset code is: {{otp}}. Expires in {{expiryMinutes}} minutes.",
        variables: JSON.stringify(["name", "otp", "expiryMinutes", "appName"]),
    },
];
// Default accountant services
const DEFAULT_SERVICES = [
    {
        code: "individual_tax_return",
        name: "Individual Tax Return",
        description: "Complete individual tax return preparation and lodgment with the ATO",
        category: "Tax",
        allowedTypes: JSON.stringify(["INDIVIDUAL"]),
        pricing: JSON.stringify({ INDIVIDUAL: 150 }),
        requiresConsent: true,
        sortOrder: 1,
    },
    {
        code: "company_tax_return",
        name: "Company Tax Return",
        description: "Full company tax return including financial statements",
        category: "Tax",
        allowedTypes: JSON.stringify(["COMPANY"]),
        pricing: JSON.stringify({ COMPANY: 800 }),
        requiresConsent: true,
        sortOrder: 2,
    },
    {
        code: "trust_tax_return",
        name: "Trust Tax Return",
        description: "Trust tax return with distribution statements",
        category: "Tax",
        allowedTypes: JSON.stringify(["TRUST"]),
        pricing: JSON.stringify({ TRUST: 600 }),
        requiresConsent: true,
        sortOrder: 3,
    },
    {
        code: "partnership_tax_return",
        name: "Partnership Tax Return",
        description: "Partnership tax return with profit allocation",
        category: "Tax",
        allowedTypes: JSON.stringify(["PARTNERSHIP"]),
        pricing: JSON.stringify({ PARTNERSHIP: 500 }),
        requiresConsent: true,
        sortOrder: 4,
    },
    {
        code: "bas_preparation",
        name: "BAS Preparation & Lodgment",
        description: "Quarterly or monthly Business Activity Statement preparation",
        category: "Compliance",
        allowedTypes: JSON.stringify(["COMPANY", "TRUST", "PARTNERSHIP"]),
        pricing: JSON.stringify({ COMPANY: 200, TRUST: 200, PARTNERSHIP: 180 }),
        requiresConsent: true,
        sortOrder: 5,
    },
    {
        code: "bookkeeping_monthly",
        name: "Monthly Bookkeeping",
        description: "Complete monthly bookkeeping and reconciliation services",
        category: "Accounting",
        allowedTypes: JSON.stringify(["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"]),
        pricing: JSON.stringify({ INDIVIDUAL: 150, COMPANY: 350, TRUST: 300, PARTNERSHIP: 300 }),
        requiresConsent: false,
        sortOrder: 6,
    },
    {
        code: "payroll_service",
        name: "Payroll Processing",
        description: "Weekly/fortnightly payroll processing and STP reporting",
        category: "Payroll",
        allowedTypes: JSON.stringify(["COMPANY", "TRUST", "PARTNERSHIP"]),
        pricing: JSON.stringify({ COMPANY: 100, TRUST: 100, PARTNERSHIP: 100 }),
        requiresConsent: false,
        sortOrder: 7,
    },
    {
        code: "financial_statements",
        name: "Financial Statements",
        description: "Preparation of annual financial statements",
        category: "Accounting",
        allowedTypes: JSON.stringify(["COMPANY", "TRUST", "PARTNERSHIP"]),
        pricing: JSON.stringify({ COMPANY: 500, TRUST: 450, PARTNERSHIP: 400 }),
        requiresConsent: true,
        sortOrder: 8,
    },
    {
        code: "business_advisory",
        name: "Business Advisory Consultation",
        description: "Strategic business advice and planning session (per hour)",
        category: "Advisory",
        allowedTypes: JSON.stringify(["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"]),
        pricing: JSON.stringify({ INDIVIDUAL: 200, COMPANY: 250, TRUST: 250, PARTNERSHIP: 250 }),
        requiresConsent: false,
        sortOrder: 9,
    },
    {
        code: "company_setup",
        name: "Company Registration & Setup",
        description: "New company registration with ASIC and ATO",
        category: "Setup",
        allowedTypes: JSON.stringify(["COMPANY"]),
        pricing: JSON.stringify({ COMPANY: 650 }),
        requiresConsent: true,
        sortOrder: 10,
    },
    {
        code: "trust_setup",
        name: "Trust Establishment",
        description: "New trust deed preparation and registration",
        category: "Setup",
        allowedTypes: JSON.stringify(["TRUST"]),
        pricing: JSON.stringify({ TRUST: 800 }),
        requiresConsent: true,
        sortOrder: 11,
    },
    {
        code: "smsf_setup",
        name: "SMSF Establishment",
        description: "Self-Managed Super Fund setup and registration",
        category: "Setup",
        allowedTypes: JSON.stringify(["TRUST"]),
        pricing: JSON.stringify({ TRUST: 1500 }),
        requiresConsent: true,
        sortOrder: 12,
    },
    {
        code: "smsf_annual",
        name: "SMSF Annual Compliance",
        description: "Annual SMSF audit, accounts and tax return",
        category: "Compliance",
        allowedTypes: JSON.stringify(["TRUST"]),
        pricing: JSON.stringify({ TRUST: 2000 }),
        requiresConsent: true,
        sortOrder: 13,
    },
];
const DEFAULT_SETTINGS = [
    // Email provider config
    { key: "email_provider", value: "smtp", category: "email" }, // smtp or sendgrid
    { key: "smtp_host", value: "", category: "email" },
    { key: "smtp_port", value: "587", category: "email" },
    { key: "smtp_user", value: "", category: "email" },
    { key: "smtp_pass", value: "", category: "email" },
    { key: "smtp_from_email", value: "", category: "email" },
    { key: "smtp_from_name", value: "Jab Admin", category: "email" },
    { key: "sendgrid_api_key", value: "", category: "email" },
    { key: "sendgrid_from_email", value: "", category: "email" },
    { key: "sendgrid_from_name", value: "Jab Admin", category: "email" },
    // SMS provider config (Twilio)
    { key: "sms_provider", value: "twilio", category: "sms" },
    { key: "twilio_account_sid", value: "", category: "sms" },
    { key: "twilio_auth_token", value: "", category: "sms" },
    { key: "twilio_phone_number", value: "", category: "sms" },
    // Verification settings
    { key: "email_verification_enabled", value: "true", category: "verification" },
    { key: "phone_verification_enabled", value: "false", category: "verification" },
    { key: "otp_expiry_minutes", value: "10", category: "verification" },
    { key: "otp_length", value: "6", category: "verification" },
    // App settings
    { key: "app_name", value: "JAP Accountants", category: "app" },
    // Website settings
    { key: "website_logo", value: "", category: "website" },
    { key: "website_tagline", value: "In-depth Perfect Analysis", category: "website" },
    { key: "contact_email", value: "", category: "website" },
    { key: "contact_phone", value: "", category: "website" },
    { key: "contact_address", value: "", category: "website" },
    { key: "social_facebook", value: "", category: "website" },
    { key: "social_twitter", value: "", category: "website" },
    { key: "social_linkedin", value: "", category: "website" },
    { key: "social_instagram", value: "", category: "website" },
    { key: "social_youtube", value: "", category: "website" },
    // Support settings
    { key: "support_enabled", value: "true", category: "support" },
    { key: "support_type", value: "24/7", category: "support" }, // "working_hours" or "24/7"
    { key: "support_hours_start", value: "09:00", category: "support" },
    { key: "support_hours_end", value: "18:00", category: "support" },
    { key: "support_timezone", value: "Asia/Kolkata", category: "support" },
    { key: "support_days", value: "Mon,Tue,Wed,Thu,Fri", category: "support" }, // comma-separated
    { key: "support_email", value: "", category: "support" },
    { key: "support_phone", value: "", category: "support" },
];
async function main() {
    console.log("Seeding roles and permissions...");
    for (const r of ROLES) {
        await prisma.role.upsert({
            where: { name: r.name },
            update: {},
            create: r,
        });
    }
    for (const p of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { code: p.code },
            update: {},
            create: p,
        });
    }
    const superAdmin = await prisma.role.findUnique({ where: { name: "Super Admin" } });
    const admin = await prisma.role.findUnique({ where: { name: "Admin" } });
    const manager = await prisma.role.findUnique({ where: { name: "Manager" } });
    const userRole = await prisma.role.findUnique({ where: { name: "User" } });
    const allPerms = await prisma.permission.findMany();
    const superAdminPermIds = allPerms.map((p) => p.id);
    const adminPermIds = allPerms.filter((p) => p.code !== "manage_roles").map((p) => p.id);
    const managerPermIds = allPerms.filter((p) => p.code === "view_dashboard").map((p) => p.id);
    const userPermIds = allPerms.filter((p) => p.code === "view_dashboard").map((p) => p.id);
    if (superAdmin) {
        for (const permId of superAdminPermIds) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: permId } },
                update: {},
                create: { roleId: superAdmin.id, permissionId: permId },
            });
        }
    }
    if (admin) {
        for (const permId of adminPermIds) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: admin.id, permissionId: permId } },
                update: {},
                create: { roleId: admin.id, permissionId: permId },
            });
        }
    }
    if (manager) {
        for (const permId of managerPermIds) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: manager.id, permissionId: permId } },
                update: {},
                create: { roleId: manager.id, permissionId: permId },
            });
        }
    }
    if (userRole) {
        for (const permId of userPermIds) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: userRole.id, permissionId: permId } },
                update: {},
                create: { roleId: userRole.id, permissionId: permId },
            });
        }
    }
    // Default admin user (change password in production)
    const existingAdmin = await prisma.user.findFirst({
        where: { email: "admin@example.com", deletedAt: null },
    });
    if (!existingAdmin && superAdmin) {
        const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
        const newAdmin = await prisma.user.create({
            data: {
                name: "Super Admin",
                email: "admin@example.com",
                password: passwordHash,
                emailVerified: true,
                status: "ACTIVE",
            },
        });
        await prisma.userRole.create({
            data: { userId: newAdmin.id, roleId: superAdmin.id },
        });
        console.log("Created admin user: admin@example.com /", DEFAULT_ADMIN_PASSWORD);
    }
    // Seed email templates
    console.log("Seeding email templates...");
    for (const t of EMAIL_TEMPLATES) {
        await prisma.emailTemplate.upsert({
            where: { code: t.code },
            update: {},
            create: t,
        });
    }
    // Seed app settings
    console.log("Seeding app settings...");
    for (const s of DEFAULT_SETTINGS) {
        await prisma.appSettings.upsert({
            where: { key: s.key },
            update: {},
            create: s,
        });
    }
    // Seed default accountant services
    console.log("Seeding default services...");
    for (const svc of DEFAULT_SERVICES) {
        await prisma.service.upsert({
            where: { code: svc.code },
            update: {},
            create: svc,
        });
    }
    console.log("Seed complete: roles, permissions, admin user, templates, settings, services ready.");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
