import type { AccountType } from "@prisma/client";

type SettingsRepo = {
  getValue: (key: string, defaultValue?: string) => Promise<string>;
};

type ServiceLike = {
  pricing: Record<string, number>;
};

type AccountLike = {
  accountType: AccountType;
  individualProfile?: {
    hasAbn?: boolean | null;
    abn?: string | null;
    gstRegistered?: boolean | null;
    rentalProperties?: unknown[];
  } | null;
  companyProfile?: {
    abn?: string | null;
    gstRegistered?: boolean | null;
  } | null;
  trustProfile?: {
    abn?: string | null;
  } | null;
  partnershipProfile?: {
    abn?: string | null;
  } | null;
};

export interface ServicePriceBreakdown {
  basePrice: number;
  hasAbn: boolean;
  abnBasePrice: number | null;
  effectiveBasePrice: number;
  rentalProperties: number;
  perPropertyFee: number;
  propertyFeeTotal: number;
  subtotal: number;
  gstRegistered: boolean;
  gstFilingFee: number;
  total: number;
}

function toAmount(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseFloat(value || "");
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function computeServicePriceBreakdown(
  service: ServiceLike,
  account: AccountLike,
  settingsRepo: SettingsRepo
): Promise<ServicePriceBreakdown> {
  const basePrice = Number(service.pricing[account.accountType] ?? 0);
  const hasAbn =
    Boolean(account.individualProfile?.hasAbn) ||
    Boolean(account.individualProfile?.abn) ||
    Boolean(account.companyProfile?.abn) ||
    Boolean(account.trustProfile?.abn) ||
    Boolean(account.partnershipProfile?.abn);

  const gstRegistered = Boolean(account.individualProfile?.gstRegistered) || Boolean(account.companyProfile?.gstRegistered);
  const rentalProperties = account.accountType === "INDIVIDUAL" ? account.individualProfile?.rentalProperties?.length ?? 0 : 0;

  const [perPropertyFeeRaw, gstFilingFeeRaw] = await Promise.all([
    settingsRepo.getValue("payment_per_property_fee", "0"),
    settingsRepo.getValue("payment_gst_filing_fee", "0"),
  ]);

  const perPropertyFee = toAmount(perPropertyFeeRaw, 0);
  const gstFilingFee = gstRegistered ? toAmount(gstFilingFeeRaw, 0) : 0;
  const propertyFeeTotal = rentalProperties * perPropertyFee;
  const subtotal = basePrice + propertyFeeTotal;
  const total = subtotal + gstFilingFee;

  return {
    basePrice,
    hasAbn,
    abnBasePrice: hasAbn ? basePrice : null,
    effectiveBasePrice: basePrice,
    rentalProperties,
    perPropertyFee,
    propertyFeeTotal,
    subtotal,
    gstRegistered,
    gstFilingFee,
    total,
  };
}
