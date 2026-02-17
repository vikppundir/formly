/**
 * Seed script: Roles & Permissions (RBAC) + default admin user
 * Run: npm run db:seed (from backend) or npm run db:seed (from root)
 * Migration note: Run db:migrate before seed.
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const prisma = new PrismaClient();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || (() => {
  console.warn("⚠ WARNING: ADMIN_SEED_PASSWORD not set. Using random password. Set ADMIN_SEED_PASSWORD env var for a known password.");
  return crypto.randomBytes(16).toString("hex") + "!A1";
})();

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
  { key: "smtp_from_name", value: "Onboard", category: "email" },
  { key: "sendgrid_api_key", value: "", category: "email" },
  { key: "sendgrid_from_email", value: "", category: "email" },
  { key: "sendgrid_from_name", value: "Onboard", category: "email" },
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
  { key: "app_name", value: "Onboard", category: "app" },
  // Website settings
  { key: "website_logo", value: "", category: "website" },
  { key: "website_tagline", value: "Protect. Optimise. Grow.", category: "website" },
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
  { key: "support_timezone", value: "Australia/Melbourne", category: "support" },
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

  // Seed legal / policy pages (Terms, Privacy, DPA)
  console.log("Seeding legal pages...");
  const LEGAL_PAGES = [
    {
      slug: "terms-of-service",
      title: "Terms of Service",
      description: "Terms and conditions for using Onboard services.",
      content: `<h2>1. Acceptance of Terms</h2>
<p>By accessing and using the Onboard platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>

<h2>2. Services Provided</h2>
<p>Onboard provides accounting, taxation, and advisory services through a secure online platform. Service scope is defined in the relevant Engagement Letter.</p>

<h2>3. User Responsibilities</h2>
<ul>
<li>Provide accurate and complete information</li>
<li>Maintain the confidentiality of your login credentials</li>
<li>Notify us immediately of any unauthorised access</li>
<li>Comply with all applicable Australian laws and regulations</li>
</ul>

<h2>4. Privacy &amp; Data</h2>
<p>Your use of the Service is also governed by our <a href="/p/privacy-policy">Privacy Policy</a> and <a href="/p/data-processing-agreement">Data Processing Agreement</a>.</p>

<h2>5. Limitation of Liability</h2>
<p>Onboard will exercise reasonable care and skill. Our liability is limited to the extent permitted by Australian law.</p>

<h2>6. Termination</h2>
<p>Either party may terminate the engagement by providing written notice. Termination does not affect obligations already incurred.</p>

<h2>7. Governing Law</h2>
<p>These Terms are governed by the laws of Australia.</p>`,
      isPublished: true,
      showInNav: false,
    },
    {
      slug: "privacy-policy",
      title: "Privacy Policy",
      description: "How Onboard collects, uses, and protects your personal information.",
      content: `<h2>1. Information We Collect</h2>
<p>We collect personal information including your name, email address, phone number, Tax File Number (TFN), financial records, and other details necessary for providing accounting services.</p>

<h2>2. How We Use Your Information</h2>
<ul>
<li>To provide accounting, taxation, and advisory services</li>
<li>To communicate with the Australian Taxation Office (ATO) on your behalf</li>
<li>To comply with legal and regulatory obligations</li>
<li>To improve our services and user experience</li>
</ul>

<h2>3. Data Security</h2>
<p>We implement industry-standard security measures including:</p>
<ul>
<li>AES-256-GCM encryption for sensitive data (e.g., TFN)</li>
<li>Secure password hashing using bcrypt</li>
<li>HTTPS encryption for all data in transit</li>
<li>Role-based access control (RBAC)</li>
<li>Regular security audits</li>
</ul>

<h2>4. Data Retention</h2>
<p>We retain your data for the minimum period required by law, typically 5–7 years for financial records as required by the ATO.</p>

<h2>5. Your Rights</h2>
<p>Under the Australian Privacy Act 1988, you have the right to access, correct, and request deletion of your personal information.</p>

<h2>6. Third Parties</h2>
<p>We do not sell your personal information. Data may be shared with the ATO or other government bodies as required by law.</p>

<h2>7. Contact</h2>
<p>For privacy-related inquiries, contact our Privacy Officer at privacy@bhalekar.com.au.</p>`,
      isPublished: true,
      showInNav: false,
    },
    {
      slug: "data-processing-agreement",
      title: "Data Processing Agreement",
      description: "How Onboard processes your personal and financial data.",
      content: `<h2>1. Purpose</h2>
<p>This Data Processing Agreement ("DPA") outlines how Onboard processes personal and financial data on your behalf for the provision of accounting services.</p>

<h2>2. Data Processed</h2>
<p>Categories of data processed include:</p>
<ul>
<li>Identity data (name, date of birth, TFN)</li>
<li>Contact data (email, phone, address)</li>
<li>Financial data (income, expenses, tax records)</li>
<li>Business data (ABN, ACN, business records)</li>
</ul>

<h2>3. Processing Activities</h2>
<ul>
<li>Preparation and lodgement of tax returns</li>
<li>Financial statement preparation</li>
<li>BAS and GST reporting</li>
<li>Communication with the ATO</li>
<li>Advisory and compliance services</li>
</ul>

<h2>4. Security Measures</h2>
<p>Onboard implements appropriate technical and organisational measures to protect your data, including encryption at rest and in transit, access controls, and audit logging.</p>

<h2>5. Sub-processors</h2>
<p>We may engage authorised sub-processors. A current list is available upon request.</p>

<h2>6. Data Breach Notification</h2>
<p>In the event of a data breach, we will notify affected individuals and the Office of the Australian Information Commissioner (OAIC) as required by the Notifiable Data Breaches scheme.</p>

<h2>7. Duration</h2>
<p>This DPA remains in effect for the duration of the service relationship and for any period required by law afterwards.</p>`,
      isPublished: true,
      showInNav: false,
    },
  ];

  for (const pg of LEGAL_PAGES) {
    await prisma.page.upsert({
      where: { slug: pg.slug },
      update: {},
      create: pg,
    });
  }

  console.log("Seed complete: roles, permissions, admin user, templates, settings, services, legal pages ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
