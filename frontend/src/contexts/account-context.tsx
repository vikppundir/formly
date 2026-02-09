"use client";

/**
 * Account Context - Manages user's multiple accounts with type-specific profiles.
 * Provides account switching, default account, and account CRUD operations.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiGet, apiPost, apiPatch, apiDelete as apiDel } from "@/lib/api";
import { useAuth } from "./auth-context";

export type AccountType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";
export type AccountStatus = "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface LegalConsent {
  id: string;
  consentType: string;
  acceptedAt: string;
  ipAddress?: string;
  documentVersion?: string;
}

export interface Account {
  id: string;
  userId: string;
  accountType: AccountType;
  name: string;
  status: AccountStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  individualProfile?: IndividualProfile;
  companyProfile?: CompanyProfile;
  trustProfile?: TrustProfile;
  partnershipProfile?: PartnershipProfile;
  legalConsents?: LegalConsent[];
}

export interface IndividualProfile {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  tfn?: string;
  dateOfBirth?: string;
  streetAddress?: string;
  address?: string; // DB field name (mapped to streetAddress in forms)
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  occupation?: string;
  employerName?: string;
  // ABN fields
  hasAbn?: boolean;
  abn?: string;
  abnRegisteredName?: string;
  abnStatus?: string;
  // GST
  gstRegistered?: boolean;
  // Medical card
  hasMedicalCard?: boolean;
  // Marital status & spouse
  maritalStatus?: string;
  spouseInAustralia?: boolean;
  spouseName?: string;
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseEmail?: string;
  spouseDob?: string;
  spouseIncome?: string;
  spouseUserId?: string;
  spouseStatus?: string;
  // Rental income
  hasRentalIncome?: boolean;
  rentalProperties?: RentalProperty[];
}

export interface RentalProperty {
  id: string;
  individualProfileId: string;
  address: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  ownershipPercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyProfile {
  id: string;
  companyName?: string;
  tradingName?: string;
  abn?: string;
  acn?: string;
  tfn?: string;
  // Registered Business Address
  businessAddress?: string;
  businessSuburb?: string;
  businessState?: string;
  businessPostcode?: string;
  // Postal Address
  postalSameAsBusiness?: boolean;
  postalAddress?: string;
  postalSuburb?: string;
  postalState?: string;
  postalPostcode?: string;
  // Industry
  industry?: string;
  industrySector?: string;
  businessDescription?: string;
  // Director count
  directorCount?: number;
  // Self (account owner) director/shareholder
  selfIsDirector?: boolean;
  selfIsShareholder?: boolean;
  selfShareCount?: number;
  // Other
  financialYearEnd?: string;
  gstRegistered?: boolean;
  // Legacy
  registeredAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}

export interface TrustProfile {
  id: string;
  trustName?: string;
  trustType?: "DISCRETIONARY" | "UNIT" | "HYBRID" | "SMSF" | "OTHER";
  trusteeDetails?: { name: string; type: string }[];
  beneficiaries?: { name: string; allocation?: number }[];
}

export interface PartnershipProfile {
  id: string;
  partnershipName?: string;
  tradingName?: string;
  abn?: string;
  tfn?: string;
  businessAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  industry?: string;
  selfRole?: string;
  selfOwnershipPercent?: number;
  partners?: { name: string; email: string; ownership: number }[];
}

interface AccountContextType {
  accounts: Account[];
  currentAccount: Account | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchAccount: (accountId: string) => void;
  setDefaultAccount: (accountId: string) => Promise<void>;
  createAccount: (type: AccountType, name: string) => Promise<Account>;
  updateProfile: (accountId: string, profile: Record<string, unknown>) => Promise<void>;
  submitAccount: (accountId: string) => Promise<void>;
  closeAccount: (accountId: string) => Promise<void>;
  reopenAccount: (accountId: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setCurrentAccount(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<{ accounts: Account[] }>("/accounts");
      setAccounts(res.accounts);

      // Set current account: prefer previously selected, then default, then first
      const storedId = localStorage.getItem("currentAccountId");
      let selected = res.accounts.find((a) => a.id === storedId);
      if (!selected) {
        selected = res.accounts.find((a) => a.isDefault) || res.accounts[0];
      }
      setCurrentAccount(selected || null);
      if (selected) {
        localStorage.setItem("currentAccountId", selected.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [authLoading, user, refresh]);

  function switchAccount(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    if (account) {
      setCurrentAccount(account);
      localStorage.setItem("currentAccountId", accountId);
    }
  }

  async function setDefaultAccount(accountId: string) {
    try {
      await apiPost(`/accounts/${accountId}/set-default`, {});
      await refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to set default account");
    }
  }

  async function createAccount(type: AccountType, name: string): Promise<Account> {
    try {
      const res = await apiPost<{ account: Account }>("/accounts", {
        accountType: type,
        name,
      });
      await refresh();
      switchAccount(res.account.id);
      return res.account;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to create account");
    }
  }

  async function updateProfile(accountId: string, profile: Record<string, unknown>) {
    try {
      await apiPatch(`/accounts/${accountId}/profile`, { profile });
      await refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to update profile");
    }
  }

  async function submitAccount(accountId: string) {
    try {
      await apiPost(`/accounts/${accountId}/submit`, {});
      await refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to submit account");
    }
  }

  async function closeAccount(accountId: string) {
    try {
      await apiPost(`/accounts/${accountId}/close`, {});
      if (currentAccount?.id === accountId) {
        localStorage.removeItem("currentAccountId");
      }
      await refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to close account");
    }
  }

  async function reopenAccount(accountId: string) {
    try {
      await apiPost(`/accounts/${accountId}/reopen`, {});
      await refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to reopen account");
    }
  }

  async function deleteAccount(accountId: string) {
    try {
      await apiDel(`/accounts/${accountId}`);
      if (currentAccount?.id === accountId) {
        localStorage.removeItem("currentAccountId");
      }
      await refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Failed to delete account");
    }
  }

  return (
    <AccountContext.Provider
      value={{
        accounts,
        currentAccount,
        loading,
        error,
        refresh,
        switchAccount,
        setDefaultAccount,
        createAccount,
        updateProfile,
        submitAccount,
        closeAccount,
        reopenAccount,
        deleteAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}
