import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applyRenewalPaid,
  hashLicenseValue,
  mapStatusToEnforcement,
  normalizeDomain,
  runLicenseTransitions,
  validateLicense,
  type LicenseConfig,
} from "./license.service.js";

const config: LicenseConfig = {
  signingSecret: "test-signing-secret",
  defaultValidityDays: 365,
  graceDays: 7,
  buildSignaturePolicy: false,
  enforcementMap: {
    ACTIVE: "OK",
    GRACE: "WARN_GRACE",
    SUSPENDED: "SUSPEND_ADMIN",
    EXPIRED: "LOCKOUT",
    REVOKED: "LOCKOUT",
  },
};

function createMockPrisma(seed: any) {
  const state = structuredClone(seed);
  return {
    state,
    license: {
      async findUnique({ where }: any) {
        const key = where.keyHash;
        const id = where.id;
        if (key) {
          const license = state.licenses.find((l: any) => l.keyHash === key);
          if (!license) return null;
          return { ...license, activations: state.activations.filter((a: any) => a.licenseId === license.id) };
        }
        if (id) return state.licenses.find((l: any) => l.id === id) || null;
        return null;
      },
      async findMany({ where }: any) {
        if (!where?.status?.in) return state.licenses;
        return state.licenses.filter((l: any) => where.status.in.includes(l.status));
      },
      async update({ where, data }: any) {
        const index = state.licenses.findIndex((l: any) => l.id === where.id);
        state.licenses[index] = { ...state.licenses[index], ...data };
        return state.licenses[index];
      },
    },
    licenseActivation: {
      async update({ where, data }: any) {
        const idx = state.activations.findIndex((a: any) => a.id === where.id);
        state.activations[idx] = { ...state.activations[idx], ...data };
        return state.activations[idx];
      },
    },
    licenseValidationAudit: {
      async create({ data }: any) {
        state.audits.push(data);
        return data;
      },
    },
    licenseRenewal: {
      async findUnique({ where }: any) {
        const renewal = state.renewals.find((r: any) => r.id === where.id);
        if (!renewal) return null;
        const license = state.licenses.find((l: any) => l.id === renewal.licenseId);
        return { ...renewal, license };
      },
      async update({ where, data }: any) {
        const idx = state.renewals.findIndex((r: any) => r.id === where.id);
        state.renewals[idx] = { ...state.renewals[idx], ...data };
        return state.renewals[idx];
      },
    },
    $transaction: async (ops: Promise<any>[]) => Promise.all(ops),
  } as any;
}

test("maps enforcement mode from status", () => {
  assert.equal(mapStatusToEnforcement("ACTIVE", config), "OK");
  assert.equal(mapStatusToEnforcement("GRACE", config), "WARN_GRACE");
  assert.equal(mapStatusToEnforcement("SUSPENDED", config), "SUSPEND_ADMIN");
  assert.equal(mapStatusToEnforcement("EXPIRED", config), "LOCKOUT");
  assert.equal(mapStatusToEnforcement("REVOKED", config), "LOCKOUT");
});

test("normalizes domain values", () => {
  assert.equal(normalizeDomain("https://www.Example.com/path"), "www.example.com");
  assert.equal(normalizeDomain("sub.example.com"), "sub.example.com");
});

test("transitions ACTIVE into GRACE after expiry", async () => {
  const now = new Date();
  const prisma = createMockPrisma({
    licenses: [
      {
        id: "lic_1",
        keyHash: "h1",
        status: "ACTIVE",
        expiresAt: addDays(now, -1),
        graceEndsAt: null,
      },
    ],
    activations: [],
    audits: [],
    renewals: [],
  });

  const changed = await runLicenseTransitions(prisma, config);
  assert.equal(changed, 1);
  assert.equal(prisma.state.licenses[0].status, "GRACE");
  assert.ok(prisma.state.licenses[0].graceEndsAt);
});

test("transitions GRACE into SUSPENDED after grace window", async () => {
  const now = new Date();
  const prisma = createMockPrisma({
    licenses: [
      {
        id: "lic_2",
        keyHash: "h2",
        status: "GRACE",
        expiresAt: addDays(now, -8),
        graceEndsAt: addDays(now, -1),
      },
    ],
    activations: [],
    audits: [],
    renewals: [],
  });

  const changed = await runLicenseTransitions(prisma, config);
  assert.equal(changed, 1);
  assert.equal(prisma.state.licenses[0].status, "SUSPENDED");
});

test("domain binding blocks mismatched domain", async () => {
  const licenseKey = "LIC-TEST-1234";
  const prisma = createMockPrisma({
    licenses: [
      {
        id: "lic_1",
        keyHash: hashLicenseValue(licenseKey),
        status: "ACTIVE",
        expiresAt: addDays(new Date(), 30),
        graceEndsAt: addDays(new Date(), 37),
        boundDomain: "tenant.example.com",
        allowedDomains: JSON.stringify(["tenant.example.com"]),
        revokedAt: null,
      },
    ],
    activations: [],
    audits: [],
    renewals: [],
  });

  const result = await validateLicense(prisma, config, {
    licenceKey: licenseKey,
    instanceId: "inst_1",
    fingerprint: "fp_1",
    domain: "other.example.com",
  });

  assert.equal(result.enforcementMode, "LOCKOUT");
  assert.equal(result.reasonCode, "DOMAIN_NOT_ALLOWED");
});

test("expired license returns lockout enforcement", async () => {
  const licenseKey = "LIC-EXP-1234";
  const prisma = createMockPrisma({
    licenses: [
      {
        id: "lic_exp",
        keyHash: hashLicenseValue(licenseKey),
        status: "EXPIRED",
        expiresAt: addDays(new Date(), -1),
        graceEndsAt: addDays(new Date(), -1),
        boundDomain: "tenant.example.com",
        allowedDomains: null,
        revokedAt: null,
      },
    ],
    activations: [],
    audits: [],
    renewals: [],
  });

  const result = await validateLicense(prisma, config, {
    licenceKey: licenseKey,
    instanceId: "inst_exp",
    fingerprint: "fp_exp",
    domain: "tenant.example.com",
  });

  assert.equal(result.status, "EXPIRED");
  assert.equal(result.enforcementMode, "LOCKOUT");
});

test("renewal reactivates expired licence and extends expiry", async () => {
  const expiredAt = addDays(new Date(), -2);
  const prisma = createMockPrisma({
    licenses: [
      {
        id: "lic_1",
        keyHash: "h1",
        keyLast4: "1234",
        status: "EXPIRED",
        expiresAt: expiredAt,
        graceEndsAt: addDays(expiredAt, 7),
        latestRenewalFailedAt: new Date(),
      },
    ],
    renewals: [
      {
        id: "ren_1",
        licenseId: "lic_1",
        paymentStatus: "PENDING",
        periodMonths: 12,
      },
    ],
    activations: [],
    audits: [],
  });

  await applyRenewalPaid(prisma, { renewalId: "ren_1", transactionId: "pi_1" }, config);
  assert.equal(prisma.state.licenses[0].status, "ACTIVE");
  assert.equal(prisma.state.renewals[0].paymentStatus, "PAID");
  assert.ok(new Date(prisma.state.licenses[0].expiresAt).getTime() > Date.now());
});
