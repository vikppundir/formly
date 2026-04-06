import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import type { PrismaClient } from "@prisma/client";

type MailAgentProvider = "gmail" | "outlook" | "yahoo" | "custom";

interface MailAgentConfig {
  enabled: boolean;
  provider: MailAgentProvider;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

interface MailMessageItem {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  unread: boolean;
  folder: string;
  snippet: string;
}

interface MailMessagePageResult {
  items: MailMessageItem[];
  hasMore: boolean;
  page: number;
  total: number;
}

interface MailFolderItem {
  key: string;
  label: string;
  path: string;
  count: number;
  unread: number;
}

interface MailMessageDetail {
  id: string;
  folder: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  date: string;
  unread: boolean;
  text: string;
  html: string;
  attachments: Array<{
    index: number;
    fileName: string;
    mimeType: string;
    size: number;
  }>;
}

function providerDefaults(provider: MailAgentProvider) {
  switch (provider) {
    case "outlook":
      return { smtpHost: "smtp.office365.com", smtpPort: 587, imapHost: "outlook.office365.com", imapPort: 993 };
    case "yahoo":
      return { smtpHost: "smtp.mail.yahoo.com", smtpPort: 587, imapHost: "imap.mail.yahoo.com", imapPort: 993 };
    case "custom":
      return { smtpHost: "", smtpPort: 587, imapHost: "", imapPort: 993 };
    case "gmail":
    default:
      return { smtpHost: "smtp.gmail.com", smtpPort: 587, imapHost: "imap.gmail.com", imapPort: 993 };
  }
}

function toNum(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value || "", 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function folderLabel(path: string): string {
  const base = path.split("/").pop() || path.split(".").pop() || path;
  if (base.toUpperCase() === "INBOX") return "Inbox";
  return base.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function envelopeToString(addresses: any[] | undefined): string {
  if (!addresses?.length) return "-";
  return addresses
    .map((p) => (p.name ? `${p.name} <${p.address || ""}>` : p.address || ""))
    .filter(Boolean)
    .join(", ");
}

function addressObjectToString(addresses: { value: Array<{ name?: string; address?: string }> } | null | undefined): string {
  if (!addresses?.value?.length) return "-";
  return addresses.value
    .map((a) => (a.name ? `${a.name} <${a.address || ""}>` : a.address || ""))
    .filter(Boolean)
    .join(", ");
}

export function createMailAgentService(prisma: PrismaClient) {
  const settingsRepo = createSettingsRepository(prisma);

  async function loadConfig(): Promise<MailAgentConfig> {
    const [
      enabledRaw,
      providerRaw,
      user,
      pass,
      fromEmail,
      fromName,
      smtpHostRaw,
      smtpPortRaw,
      imapHostRaw,
      imapPortRaw,
    ] = await Promise.all([
      settingsRepo.getValue("mail_agent_enabled", "false"),
      settingsRepo.getValue("mail_agent_provider", "gmail"),
      settingsRepo.getValue("mail_agent_user", ""),
      settingsRepo.getValue("mail_agent_pass", ""),
      settingsRepo.getValue("mail_agent_from_email", ""),
      settingsRepo.getValue("mail_agent_from_name", "Mail Agent"),
      settingsRepo.getValue("mail_agent_smtp_host", ""),
      settingsRepo.getValue("mail_agent_smtp_port", ""),
      settingsRepo.getValue("mail_agent_imap_host", ""),
      settingsRepo.getValue("mail_agent_imap_port", ""),
    ]);

    const provider = (providerRaw || "gmail") as MailAgentProvider;
    const defaults = providerDefaults(provider);
    const smtpHost = smtpHostRaw || defaults.smtpHost;
    const smtpPort = toNum(smtpPortRaw, defaults.smtpPort);
    const imapHost = imapHostRaw || defaults.imapHost || smtpHost;
    const imapPort = toNum(imapPortRaw, defaults.imapPort);

    return {
      enabled: enabledRaw === "true",
      provider,
      user,
      pass,
      fromEmail: fromEmail || user,
      fromName: fromName || "Mail Agent",
      smtpHost,
      smtpPort,
      imapHost,
      imapPort,
    };
  }

  async function ensureReady() {
    const config = await loadConfig();
    if (!config.enabled) throw new Error("Mail Agent is disabled");
    if (!config.user || !config.pass) throw new Error("Mail Agent credentials are not configured");
    if (!config.smtpHost || !config.imapHost) throw new Error("Mail Agent host configuration is incomplete");
    return config;
  }

  async function withImap<T>(task: (client: ImapFlow, config: MailAgentConfig) => Promise<T>): Promise<T> {
    const config = await ensureReady();
    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: true,
      auth: { user: config.user, pass: config.pass },
      logger: false,
    });
    try {
      await client.connect();
      return await task(client, config);
    } finally {
      try {
        await client.logout();
      } catch {
        // noop
      }
    }
  }

  async function resolveMailboxPath(client: ImapFlow, requested: string): Promise<string> {
    const clean = (requested || "").trim();
    if (!clean || clean.toLowerCase() === "inbox") return "INBOX";
    const boxes = await client.list();
    const direct = boxes.find((b) => b.path.toLowerCase() === clean.toLowerCase());
    if (direct) return direct.path;
    return clean;
  }

  async function parseSourceByUid(client: ImapFlow, mailboxPath: string, uid: number) {
    const lock = await client.getMailboxLock(mailboxPath);
    try {
      const one = await client.fetchOne(uid, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: true,
      }, {
        uid: true,
      });
      if (!one) return null;
      const sourceBuffer = Buffer.isBuffer(one.source) ? one.source : Buffer.from(one.source || "");
      const parsed = await simpleParser(sourceBuffer);
      return { one, parsed };
    } finally {
      lock.release();
    }
  }

  return {
    async getRuntimeConfig() {
      const cfg = await loadConfig();
      return {
        enabled: cfg.enabled,
        provider: cfg.provider,
        smtp: { host: cfg.smtpHost, port: cfg.smtpPort },
        imap: { host: cfg.imapHost, port: cfg.imapPort },
        fromEmail: cfg.fromEmail,
      };
    },

    async listMailboxes() {
      const cfg = await loadConfig();
      return [
        { id: "personal", label: "My Login Mailbox", email: cfg.fromEmail || cfg.user || "mailbox@local", kind: "personal" },
        { id: "assigned-support", label: "Support Shared Mailbox", email: "support@yourfirm.com", kind: "assigned" },
      ];
    },

    async listFoldersWithCounts(): Promise<MailFolderItem[]> {
      return withImap(async (client) => {
        const boxes = await client.list();
        const items: MailFolderItem[] = [];
        for (const box of boxes) {
          try {
            const status = await client.status(box.path, { messages: true, unseen: true });
            items.push({
              key: box.path,
              path: box.path,
              label: folderLabel(box.path),
              count: status.messages || 0,
              unread: status.unseen || 0,
            });
          } catch {
            // skip folder without access
          }
        }
        items.sort((a, b) => {
          if (a.path.toUpperCase() === "INBOX") return -1;
          if (b.path.toUpperCase() === "INBOX") return 1;
          return a.label.localeCompare(b.label);
        });
        return items;
      });
    },

    async listMessages(folderInput: string, search = "", limit = 25, page = 1): Promise<MailMessagePageResult> {
      return withImap(async (client) => {
        const mailboxPath = await resolveMailboxPath(client, folderInput || "INBOX");
        const lock = await client.getMailboxLock(mailboxPath);
        try {
          const mailbox = client.mailbox;
          const exists = mailbox && typeof mailbox === "object" ? mailbox.exists || 0 : 0;
          if (exists === 0) return { items: [], hasMore: false, page: 1, total: 0 };

          const safeLimit = Math.max(1, Math.min(limit, 100));
          const safePage = Math.max(1, page);
          const endSeq = exists - (safePage - 1) * safeLimit;
          if (endSeq <= 0) return { items: [], hasMore: false, page: safePage, total: exists };
          const fromSeq = Math.max(1, endSeq - safeLimit + 1);
          const range = `${fromSeq}:${endSeq}`;

          const items: MailMessageItem[] = [];
          for await (const msg of client.fetch(range, {
            uid: true,
            envelope: true,
            flags: true,
            internalDate: true,
          })) {
            const subject = msg.envelope?.subject || "(No subject)";
            const from = envelopeToString(msg.envelope?.from);
            const to = envelopeToString(msg.envelope?.to);
            const normalized = `${subject} ${from} ${to}`.toLowerCase();
            if (search && !normalized.includes(search.toLowerCase())) continue;
            items.push({
              id: String(msg.uid || msg.seq),
              from,
              to,
              subject,
              snippet: subject,
              date: new Date(msg.internalDate || Date.now()).toISOString(),
              unread: !msg.flags?.has("\\Seen"),
              folder: mailboxPath,
            });
          }

          return {
            items: items.reverse(),
            hasMore: fromSeq > 1,
            page: safePage,
            total: exists,
          };
        } finally {
          lock.release();
        }
      });
    },

    async getMessageDetail(folderInput: string, id: string): Promise<MailMessageDetail> {
      const uid = Number.parseInt(id, 10);
      if (!Number.isFinite(uid)) throw new Error("Invalid message id");
      return withImap(async (client) => {
        const mailboxPath = await resolveMailboxPath(client, folderInput || "INBOX");
        const parsedSource = await parseSourceByUid(client, mailboxPath, uid);
        if (!parsedSource) throw new Error("Message not found");
        const { one, parsed } = parsedSource;
        const attachments = (parsed.attachments || []).map((a, index) => ({
          index,
          fileName: a.filename || `attachment-${index + 1}`,
          mimeType: a.contentType || "application/octet-stream",
          size: a.size || 0,
        }));
        return {
          id: String(uid),
          folder: mailboxPath,
          from: addressObjectToString(parsed.from),
          to: addressObjectToString(parsed.to),
          cc: addressObjectToString(parsed.cc),
          bcc: addressObjectToString(parsed.bcc),
          subject: parsed.subject || one.envelope?.subject || "(No subject)",
          date: new Date(one.internalDate || Date.now()).toISOString(),
          unread: !one.flags?.has("\\Seen"),
          text: parsed.text || "",
          html: typeof parsed.html === "string" ? parsed.html : "",
          attachments,
        };
      });
    },

    async getAttachment(folderInput: string, id: string, index: number) {
      const uid = Number.parseInt(id, 10);
      if (!Number.isFinite(uid)) throw new Error("Invalid message id");
      return withImap(async (client) => {
        const mailboxPath = await resolveMailboxPath(client, folderInput || "INBOX");
        const parsedSource = await parseSourceByUid(client, mailboxPath, uid);
        if (!parsedSource) throw new Error("Message not found");
        const attachment = (parsedSource.parsed.attachments || [])[index];
        if (!attachment) throw new Error("Attachment not found");
        return {
          fileName: attachment.filename || `attachment-${index + 1}`,
          mimeType: attachment.contentType || "application/octet-stream",
          content: Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content || ""),
        };
      });
    },

    async deleteMessage(folderInput: string, id: string) {
      const uid = Number.parseInt(id, 10);
      if (!Number.isFinite(uid)) throw new Error("Invalid message id");
      return withImap(async (client) => {
        const mailboxPath = await resolveMailboxPath(client, folderInput || "INBOX");
        const boxes = await client.list();
        const trash =
          boxes.find((b) => b.specialUse === "\\Trash")?.path ||
          boxes.find((b) => /trash|bin|deleted/i.test(b.path))?.path;

        if (trash && trash !== mailboxPath) {
          await client.messageMove(uid, trash, { uid: true });
        } else {
          await client.messageDelete(uid, { uid: true });
          try {
            await client.mailboxClose({ expunge: true });
          } catch {
            // ignore expunge close errors
          }
        }
        return { ok: true };
      });
    },

    async sendMail(params: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      html?: string;
      text?: string;
      attachments?: Array<{ fileName: string; mimeType?: string; contentBase64: string }>;
    }) {
      const config = await ensureReady();
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: { user: config.user, pass: config.pass },
      });
      const attachments = (params.attachments || [])
        .map((a) => {
          try {
            return {
              filename: a.fileName,
              contentType: a.mimeType || "application/octet-stream",
              content: Buffer.from(a.contentBase64, "base64"),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: params.to,
        cc: params.cc || undefined,
        bcc: params.bcc || undefined,
        subject: params.subject,
        html: params.html || undefined,
        text: params.text || undefined,
        attachments: attachments as any,
      });
      return { ok: true };
    },
  };
}
