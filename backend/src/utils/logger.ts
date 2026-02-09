/**
 * Structured logging with audit trail support (SOC 2).
 * - PII masking for emails, phones, TFNs, ABNs
 * - Audit event logging for compliance
 * - Correlation support via requestId/userId
 * Future: send to centralized logging (e.g. Datadog, CloudWatch).
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

// PII patterns to mask in log output
const PII_PATTERNS: { key: string; mask: (val: string) => string }[] = [
  { key: "email", mask: (v) => v.replace(/^(.{2})(.*)(@.*)$/, "$1***$3") },
  { key: "phone", mask: (v) => v.replace(/.(?=.{4})/g, "*") },
  { key: "tfn", mask: () => "***-***-***" },
  { key: "abn", mask: (v) => v.replace(/.(?=.{3})/g, "*") },
  { key: "password", mask: () => "[REDACTED]" },
  { key: "token", mask: () => "[REDACTED]" },
  { key: "secret", mask: () => "[REDACTED]" },
  { key: "apiKey", mask: () => "[REDACTED]" },
  { key: "api_key", mask: () => "[REDACTED]" },
];

function maskPII(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const masked = { ...meta };
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value !== "string") continue;
    const pattern = PII_PATTERNS.find((p) =>
      key.toLowerCase().includes(p.key.toLowerCase())
    );
    if (pattern) {
      masked[key] = pattern.mask(value);
    }
  }
  return masked;
}

function formatPayload(p: LogPayload): string {
  const out = {
    ...p,
    meta: maskPII(p.meta as Record<string, unknown> | undefined),
    timestamp: new Date().toISOString(),
  };
  return JSON.stringify(out);
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(formatPayload({ level: "info", message, meta }));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(formatPayload({ level: "warn", message, meta }));
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(formatPayload({ level: "error", message, meta }));
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatPayload({ level: "debug", message, meta }));
    }
  },
};

// =============================================================================
// Audit Logging - SOC 2 compliance
// =============================================================================

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "PERMISSION_CHANGED"
  | "ACCOUNT_STATUS_CHANGED"
  | "SETTINGS_UPDATED"
  | "SERVICE_PURCHASED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "CONSENT_ACCEPTED"
  | "PARTNER_INVITED"
  | "PARTNER_ACCEPTED"
  | "PARTNER_REJECTED"
  | "ACCESS_DENIED"
  | "ADMIN_ACTION";

export interface AuditEvent {
  action: AuditAction;
  userId?: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

/**
 * Write an audit log entry. Currently logs to structured stdout.
 * Future: persist to audit_events table or external audit service.
 */
export function writeAuditLog(event: AuditEvent): void {
  const entry = {
    level: "audit" as const,
    timestamp: new Date().toISOString(),
    action: event.action,
    userId: event.userId,
    targetId: event.targetId,
    targetType: event.targetType,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent ? event.userAgent.substring(0, 200) : undefined,
    details: event.details ? maskPII(event.details as Record<string, unknown>) : undefined,
  };
  // Audit logs always go to stdout regardless of log level
  console.log(JSON.stringify(entry));
}
