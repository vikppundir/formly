"use client";

/**
 * Create New Account — Complete Australian CA workflow for Trust accounts.
 *
 * Trust wizard:
 *  Step 1: Trust Type (Discretionary / Unit)
 *  Step 2: Trust Info (Name, TFN, ABN) + Trustee (Individual or Corporate)
 *  Step 3: Invite Everyone (Trustee/Directors + Beneficiaries/Unit Holders)
 *  Step 4: Review & Create
 *
 * After creation → redirects to detail page where invites are sent.
 * Non-trust types keep the simple 2-step flow.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, type AccountType } from "@/contexts/account-context";
import type { TrustAddress } from "@/contexts/account-context";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

const cls = {
  input:
    "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]/50 focus:border-[#E91E8C] transition-colors",
  label: "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2",
  card: "rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6",
  pink: "px-6 py-3 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-medium hover:shadow-lg hover:shadow-[#E91E8C]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
  outline:
    "px-6 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors",
};

const ACCOUNT_TYPES: { type: AccountType; label: string; desc: string; icon: string }[] = [
  { type: "INDIVIDUAL", label: "Individual", desc: "Personal tax returns and individual financial services", icon: "👤" },
  { type: "COMPANY", label: "Company", desc: "Company tax, BAS lodgment, and business accounting", icon: "🏢" },
  { type: "TRUST", label: "Trust", desc: "Trust tax returns, SMSF, and trustee services", icon: "🏛️" },
  { type: "PARTNERSHIP", label: "Partnership", desc: "Partnership tax returns and profit distribution", icon: "🤝" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function blank(): TrustAddress {
  return { street: "", suburb: "", state: "", postcode: "", country: "Australia" };
}

function fmtTfn(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REUSABLE SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Addr({ value, onChange, label }: { value: TrustAddress; onChange: (a: TrustAddress) => void; label?: string }) {
  const p = label ? `${label} ` : "";
  return (
    <div className="grid gap-3">
      <div>
        <label className={cls.label}>{p}Street Address <span className="text-red-500">*</span></label>
        <input className={cls.input} placeholder="123 Main Street" value={value.street} onChange={(e) => onChange({ ...value, street: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={cls.label}>{p}Suburb <span className="text-red-500">*</span></label>
          <input className={cls.input} placeholder="Melbourne" value={value.suburb} onChange={(e) => onChange({ ...value, suburb: e.target.value })} />
        </div>
        <div>
          <label className={cls.label}>{p}State <span className="text-red-500">*</span></label>
          <select className={cls.input} value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })}>
            <option value="">Select</option>
            {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label}>{p}Postcode <span className="text-red-500">*</span></label>
          <input className={cls.input} placeholder="3000" maxLength={4} value={value.postcode} onChange={(e) => onChange({ ...value, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
type TrustKind = "DISCRETIONARY" | "UNIT";
type TrusteeType = "INDIVIDUAL" | "COMPANY";
interface InviteEntry {
  name: string;
  email: string;
  role: string;
  directorId?: string;
  isMinor?: boolean;
  dateOfBirth?: string;
  address?: TrustAddress;
  parentName?: string;
  parentRelationship?: string;
}

// Company unit holder — added in the invite step for Unit Trusts
type CompanyUHType = "COMPANY" | "TRUSTEE_COMPANY";
interface CompanyUnitHolder {
  companyName: string;
  companyTfn: string;
  companyAbn: string;
  companyAddress: TrustAddress;
  companyType: CompanyUHType; // "COMPANY" → directors only, "TRUSTEE_COMPANY" → trustees + directors
  directors: InviteEntry[];
  trustees: InviteEntry[];
}

// Company beneficiary — added in beneficiaries section for Discretionary & Company trusts
type CompanyBenType = "COMPANY" | "TRUSTEE_COMPANY";
interface CompanyBeneficiary {
  companyName: string;
  companyAcn: string;
  companyAbn: string;
  companyAddress: TrustAddress;
  companyType: CompanyBenType; // "COMPANY" → only directors, "TRUSTEE_COMPANY" → trustees + directors
  directors: InviteEntry[];
  trustees: InviteEntry[];
}

interface TrustWizardState {
  trustType: TrustKind;
  // Trust entity info
  trustName: string;
  trustTfn: string;
  trustAbn: string;
  // Trustee
  trusteeType: TrusteeType;
  // Individual Trustee (creator fills directly — no invite)
  trusteeName: string;
  trusteeAddress: TrustAddress;
  // Corporate Trustee
  companyName: string;
  companyTfn: string;
  companyAbn: string;
  companyAddress: TrustAddress;
  // Invites — directors, beneficiaries/unit holders (adults)
  invites: InviteEntry[];
  // Company unit holders (for Unit Trust)
  companyUnitHolders: CompanyUnitHolder[];
  // Company beneficiaries (for Discretionary Trust & Company Trustee Beneficiaries)
  companyBeneficiaries: CompanyBeneficiary[];
}

function defaultState(kind: TrustKind): TrustWizardState {
  return {
    trustType: kind,
    trustName: kind === "DISCRETIONARY" ? "Family Trust" : "Unit Trust",
    trustTfn: "",
    trustAbn: "",
    trusteeType: "INDIVIDUAL",
    trusteeName: "",
    trusteeAddress: blank(),
    companyName: "",
    companyTfn: "",
    companyAbn: "",
    companyAddress: blank(),
    invites: [],
    companyUnitHolders: [],
    companyBeneficiaries: [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1: Trust Type
   ═══════════════════════════════════════════════════════════════════════════ */
function StepTrustType({ onSelect }: { onSelect: (t: TrustKind) => void }) {
  const opts: { type: TrustKind; label: string; desc: string; icon: string }[] = [
    { type: "DISCRETIONARY", label: "Family / Discretionary Trust", desc: "Trustees distribute income at their discretion to beneficiaries. Most common for Australian families.", icon: "👨‍👩‍👧‍👦" },
    { type: "UNIT", label: "Unit Trust", desc: "Unit holders own a fixed proportion of the trust. Used for investment and business purposes.", icon: "📊" },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Step 1: Select Trust Type</h2>
      <p className="text-sm text-slate-500 dark:text-white/60">Choose the type of trust you want to create</p>
      {opts.map((o) => (
        <button key={o.type} type="button" onClick={() => onSelect(o.type)} className="w-full p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#E91E8C]/50 hover:shadow-lg hover:shadow-[#E91E8C]/10 transition-all text-left group">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{o.icon}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-[#E91E8C]">{o.label}</h3>
              <p className="text-slate-500 dark:text-white/60 mt-1 text-sm">{o.desc}</p>
            </div>
            <svg className="w-6 h-6 text-slate-300 dark:text-white/30 group-hover:text-[#E91E8C] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2: Trust Info + Trustee Details
   ═══════════════════════════════════════════════════════════════════════════ */
function StepTrustInfo({ state, setState }: { state: TrustWizardState; setState: (s: TrustWizardState) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Step 2: Trust & Trustee Details</h2>
        <p className="text-sm text-slate-500 dark:text-white/60 mt-1">Provide trust information and select the trustee type</p>
      </div>

      {/* Trust Entity Info */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-4">Trust Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={cls.label}>Trust Name <span className="text-red-500">*</span></label>
            <input className={cls.input} placeholder="Smith Family Trust" value={state.trustName} onChange={(e) => setState({ ...state, trustName: e.target.value })} />
          </div>
          <div>
            <label className={cls.label}>Trust TFN <span className="text-red-500">*</span> <span className="ml-1 text-xs text-amber-500 font-normal">Encrypted at rest</span></label>
            <input className={cls.input + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={fmtTfn(state.trustTfn)} onChange={(e) => setState({ ...state, trustTfn: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
          </div>
          <div>
            <label className={cls.label}>Trust ABN</label>
            <input className={cls.input + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={state.trustAbn} onChange={(e) => setState({ ...state, trustAbn: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Trustee Selection */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-4">Trustee</h3>
        <div>
          <label className={cls.label}>Trustee Type <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setState({ ...state, trusteeType: t })} className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${state.trusteeType === t ? "border-[#E91E8C] bg-[#E91E8C]/5 text-[#E91E8C]" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300"}`}>
                {t === "INDIVIDUAL" ? "Individual Trustee" : "Company (Corporate Trustee)"}
              </button>
            ))}
          </div>
        </div>

        {state.trusteeType === "INDIVIDUAL" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs text-blue-700 dark:text-blue-400">Enter the individual trustee&apos;s name and address below. The trustee is responsible for managing the trust assets.</p>
              </div>
            </div>
            <div>
              <label className={cls.label}>Trustee Full Name <span className="text-red-500">*</span></label>
              <input className={cls.input} placeholder="John Smith" value={state.trusteeName} onChange={(e) => setState({ ...state, trusteeName: e.target.value })} />
            </div>
            <Addr label="Trustee" value={state.trusteeAddress} onChange={(a) => setState({ ...state, trusteeAddress: a })} />
          </div>
        )}

        {state.trusteeType === "COMPANY" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={cls.label}>Company Name <span className="text-red-500">*</span></label>
                <input className={cls.input} placeholder="ABC Pty Ltd" value={state.companyName} onChange={(e) => setState({ ...state, companyName: e.target.value })} />
              </div>
              <div>
                <label className={cls.label}>Company ACN <span className="text-red-500">*</span></label>
                <input className={cls.input + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={state.companyTfn} onChange={(e) => setState({ ...state, companyTfn: e.target.value.replace(/[^0-9 ]/g, "").slice(0, 11) })} />
              </div>
              <div>
                <label className={cls.label}>Company ABN</label>
                <input className={cls.input + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={state.companyAbn} onChange={(e) => setState({ ...state, companyAbn: e.target.value })} />
              </div>
            </div>
            <Addr label="Registered" value={state.companyAddress} onChange={(a) => setState({ ...state, companyAddress: a })} />
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs text-blue-700 dark:text-blue-400">Directors will be invited in the next step. Each director will register (if new) and fill their own details — Full Name, TFN, DOB, Address — required for ATO director identification.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3: Invite Everyone
   ═══════════════════════════════════════════════════════════════════════════ */
function StepInviteAll({ state, setState }: { state: TrustWizardState; setState: (s: TrustWizardState) => void }) {
  const isUnit = state.trustType === "UNIT";
  const invites = state.invites;

  function add(role: string, minor = false) { setState({ ...state, invites: [...invites, { name: "", email: "", role, isMinor: minor, dateOfBirth: "", address: blank(), parentName: "", parentRelationship: "" }] }); }
  function upd(i: number, p: Partial<InviteEntry>) { const n = [...invites]; n[i] = { ...n[i], ...p }; setState({ ...state, invites: n }); }
  function rem(i: number) { setState({ ...state, invites: invites.filter((_, x) => x !== i) }); }

  // Company unit holders helpers
  const cuhs = state.companyUnitHolders;
  function addCompanyUH() { setState({ ...state, companyUnitHolders: [...cuhs, { companyName: "", companyTfn: "", companyAbn: "", companyAddress: blank(), companyType: "COMPANY", directors: [], trustees: [] }] }); }
  function updCompanyUH(i: number, p: Partial<CompanyUnitHolder>) { const n = [...cuhs]; n[i] = { ...n[i], ...p }; setState({ ...state, companyUnitHolders: n }); }
  function remCompanyUH(i: number) { setState({ ...state, companyUnitHolders: cuhs.filter((_, x) => x !== i) }); }
  function addDirector(cIdx: number) { const n = [...cuhs]; n[cIdx] = { ...n[cIdx], directors: [...n[cIdx].directors, { name: "", email: "", role: "UH Director" }] }; setState({ ...state, companyUnitHolders: n }); }
  function updDirector(cIdx: number, dIdx: number, p: Partial<InviteEntry>) { const n = [...cuhs]; const dirs = [...n[cIdx].directors]; dirs[dIdx] = { ...dirs[dIdx], ...p }; n[cIdx] = { ...n[cIdx], directors: dirs }; setState({ ...state, companyUnitHolders: n }); }
  function remDirector(cIdx: number, dIdx: number) { const n = [...cuhs]; n[cIdx] = { ...n[cIdx], directors: n[cIdx].directors.filter((_, x) => x !== dIdx) }; setState({ ...state, companyUnitHolders: n }); }
  function addUHTrustee(cIdx: number) { const n = [...cuhs]; n[cIdx] = { ...n[cIdx], trustees: [...n[cIdx].trustees, { name: "", email: "", role: "UH Trustee" }] }; setState({ ...state, companyUnitHolders: n }); }
  function updUHTrustee(cIdx: number, tIdx: number, p: Partial<InviteEntry>) { const n = [...cuhs]; const ts = [...n[cIdx].trustees]; ts[tIdx] = { ...ts[tIdx], ...p }; n[cIdx] = { ...n[cIdx], trustees: ts }; setState({ ...state, companyUnitHolders: n }); }
  function remUHTrustee(cIdx: number, tIdx: number) { const n = [...cuhs]; n[cIdx] = { ...n[cIdx], trustees: n[cIdx].trustees.filter((_, x) => x !== tIdx) }; setState({ ...state, companyUnitHolders: n }); }

  // Company beneficiary helpers
  const cbs = state.companyBeneficiaries;
  function addCompanyBen() {
    setState({ ...state, companyBeneficiaries: [...cbs, { companyName: "", companyAcn: "", companyAbn: "", companyAddress: blank(), companyType: "COMPANY", directors: [], trustees: [] }] });
  }
  function updCompanyBen(i: number, p: Partial<CompanyBeneficiary>) {
    const n = [...cbs]; n[i] = { ...n[i], ...p }; setState({ ...state, companyBeneficiaries: n });
  }
  function remCompanyBen(i: number) {
    setState({ ...state, companyBeneficiaries: cbs.filter((_, x) => x !== i) });
  }
  function addCBDirector(cIdx: number) {
    const n = [...cbs]; n[cIdx] = { ...n[cIdx], directors: [...n[cIdx].directors, { name: "", email: "", role: "Ben Director" }] }; setState({ ...state, companyBeneficiaries: n });
  }
  function updCBDirector(cIdx: number, dIdx: number, p: Partial<InviteEntry>) {
    const n = [...cbs]; const dirs = [...n[cIdx].directors]; dirs[dIdx] = { ...dirs[dIdx], ...p }; n[cIdx] = { ...n[cIdx], directors: dirs }; setState({ ...state, companyBeneficiaries: n });
  }
  function remCBDirector(cIdx: number, dIdx: number) {
    const n = [...cbs]; n[cIdx] = { ...n[cIdx], directors: n[cIdx].directors.filter((_, x) => x !== dIdx) }; setState({ ...state, companyBeneficiaries: n });
  }
  function addCBTrustee(cIdx: number) {
    const n = [...cbs]; n[cIdx] = { ...n[cIdx], trustees: [...n[cIdx].trustees, { name: "", email: "", role: "Ben Trustee" }] }; setState({ ...state, companyBeneficiaries: n });
  }
  function updCBTrustee(cIdx: number, tIdx: number, p: Partial<InviteEntry>) {
    const n = [...cbs]; const ts = [...n[cIdx].trustees]; ts[tIdx] = { ...ts[tIdx], ...p }; n[cIdx] = { ...n[cIdx], trustees: ts }; setState({ ...state, companyBeneficiaries: n });
  }
  function remCBTrustee(cIdx: number, tIdx: number) {
    const n = [...cbs]; n[cIdx] = { ...n[cIdx], trustees: n[cIdx].trustees.filter((_, x) => x !== tIdx) }; setState({ ...state, companyBeneficiaries: n });
  }

  // Group invites by role
  const directorInvites = invites.map((inv, i) => ({ ...inv, idx: i })).filter((inv) => inv.role === "Director");
  const benInvites = invites.map((inv, i) => ({ ...inv, idx: i })).filter((inv) => inv.role === "Beneficiary" || inv.role === "Unit Holder");

  const benLabel = isUnit ? "Unit Holders" : "Beneficiaries";

  function renderPersonCard(inv: InviteEntry & { idx: number }) {
    const isMinor = inv.isMinor || false;
    return (
      <div key={inv.idx} className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E91E8C]/10 text-[#E91E8C] font-medium">{inv.role}</span>
            {isMinor && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">Minor</span>}
            <span className="text-sm font-medium text-slate-900 dark:text-white">{inv.name || "New person"}</span>
          </span>
          <button type="button" onClick={() => rem(inv.idx)} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>

        {/* Minor toggle */}
        {(inv.role === "Beneficiary" || inv.role === "Unit Holder") && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isMinor} onChange={(e) => upd(inv.idx, { isMinor: e.target.checked, email: e.target.checked ? "" : inv.email })} className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]" />
            <span className="text-xs text-slate-600 dark:text-white/70">This is a minor (under 18) &mdash; TFN not required, you&apos;ll fill their details</span>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={cls.label}>Full Name <span className="text-red-500">*</span></label>
            <input type="text" className={cls.input} placeholder="Full name" value={inv.name} onChange={(e) => upd(inv.idx, { name: e.target.value })} />
          </div>
          {!isMinor && (
            <div>
              <label className={cls.label}>Email <span className="text-red-500">*</span></label>
              <input type="email" className={cls.input} placeholder="name@example.com" value={inv.email} onChange={(e) => upd(inv.idx, { email: e.target.value })} />
            </div>
          )}
          {isMinor && (
            <div>
              <label className={cls.label}>Date of Birth</label>
              <input type="date" className={cls.input} value={inv.dateOfBirth || ""} onChange={(e) => upd(inv.idx, { dateOfBirth: e.target.value })} />
            </div>
          )}
        </div>

        {/* Minor: Address + Parent details (creator fills directly) */}
        {isMinor && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/10">
            <Addr label="Minor&apos;s" value={inv.address || blank()} onChange={(a) => upd(inv.idx, { address: a })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={cls.label}>Parent/Guardian Name</label>
                <input type="text" className={cls.input} placeholder="Parent full name" value={inv.parentName || ""} onChange={(e) => upd(inv.idx, { parentName: e.target.value })} />
              </div>
              <div>
                <label className={cls.label}>Relationship</label>
                <select className={cls.input} value={inv.parentRelationship || ""} onChange={(e) => upd(inv.idx, { parentRelationship: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDirectorGroup(title: string, subtitle: string, entries: (InviteEntry & { idx: number })[], addRole: string, addLabel: string) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80">{title}</h3>
            <p className="text-xs text-slate-400 dark:text-white/40">{subtitle}</p>
          </div>
          <button type="button" onClick={() => add(addRole)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {addLabel}
          </button>
        </div>
        {entries.length === 0 ? (
          <div className="text-center py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-400 dark:text-white/40">Click &ldquo;{addLabel}&rdquo; to add</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((inv) => (
              <div key={inv.idx} className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#E91E8C]/10 text-[#E91E8C] font-medium">{inv.role}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{inv.name || "New person"}</span>
                  </span>
                  <button type="button" onClick={() => rem(inv.idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={cls.label}>Name <span className="text-red-500">*</span></label>
                    <input type="text" className={cls.input} placeholder="Full name" value={inv.name} onChange={(e) => upd(inv.idx, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className={cls.label}>Email <span className="text-red-500">*</span></label>
                    <input type="email" className={cls.input} placeholder="name@example.com" value={inv.email} onChange={(e) => upd(inv.idx, { email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={cls.label}>Director ID (DIN) <span className="text-[10px] text-slate-400 italic font-normal">Optional</span></label>
                  <input type="text" className={cls.input + " font-mono tracking-wider w-56"} placeholder="e.g. 036 123 456 789" maxLength={18} value={inv.directorId || ""} onChange={(e) => upd(inv.idx, { directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) })} />
                  <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">
                    Australian Director Identification Number.{" "}
                    <a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline font-medium">
                      Don&apos;t have one? Apply here &rarr;
                    </a>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Step 3: Add {benLabel}</h2>
        <p className="text-sm text-slate-500 dark:text-white/60 mt-1">Add people and companies to invite. Adults receive an invitation email and fill their own details (TFN, DOB, address). For minors, you fill the details directly.</p>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">How it works</p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 mt-1 space-y-0.5 list-disc pl-4">
              <li><strong>Adults</strong>: Receive an invite &rarr; register (if new) &rarr; fill their own details (Name, TFN, DOB, Address)</li>
              <li><strong>Minors</strong>: No TFN needed &mdash; you enter their Name, DOB, Address, and Parent/Guardian details directly</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Directors (Corporate trustee only) */}
      {state.trusteeType === "COMPANY" && (
        <>
          {renderDirectorGroup(
            "Company Directors",
            "Directors of the corporate trustee (ATO director identification required)",
            directorInvites,
            "Director",
            "Add Director",
          )}
          <div className="border-t border-slate-200 dark:border-white/10" />
        </>
      )}

      {/* Beneficiaries / Unit Holders */}
      {isUnit ? (
        <div className="space-y-6">
          {/* Individual Unit Holders (adults + minors) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80">Individual Unit Holders</h3>
                <p className="text-xs text-slate-400 dark:text-white/40">Individual persons holding units in the trust</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => add("Unit Holder")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Adult
                </button>
                <button type="button" onClick={() => add("Unit Holder", true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Minor
                </button>
              </div>
            </div>
            {benInvites.length === 0 ? (
              <div className="text-center py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <p className="text-xs text-slate-400 dark:text-white/40">Click &ldquo;Add Adult&rdquo; or &ldquo;Add Minor&rdquo; to add unit holders</p>
              </div>
            ) : (
              <div className="space-y-2">{benInvites.map(renderPersonCard)}</div>
            )}
          </div>

          {/* Company Unit Holders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80">Company Unit Holders</h3>
                <p className="text-xs text-slate-400 dark:text-white/40">Companies holding units — provide company details and invite directors</p>
              </div>
              <button type="button" onClick={addCompanyUH} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Company
              </button>
            </div>
            {cuhs.length === 0 ? (
              <div className="text-center py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <p className="text-xs text-slate-400 dark:text-white/40">Click &ldquo;Add Company&rdquo; to add</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cuhs.map((c, ci) => (
                  <div key={ci} className="p-5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.companyType === "TRUSTEE_COMPANY" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"}`}>
                          {c.companyType === "TRUSTEE_COMPANY" ? "Trustee Company UH" : "Company Unit Holder"}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{c.companyName || "New company"}</span>
                      </span>
                      <button type="button" onClick={() => remCompanyUH(ci)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>

                    {/* Company Type Selector */}
                    <div>
                      <label className={cls.label}>Company Type <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        {(["COMPANY", "TRUSTEE_COMPANY"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => updCompanyUH(ci, { companyType: t, trustees: t === "COMPANY" ? [] : c.trustees })} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${c.companyType === t ? "border-[#E91E8C] bg-[#E91E8C]/5 text-[#E91E8C]" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300"}`}>
                            {t === "COMPANY" ? "Company" : "Trustee Company"}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
                        {c.companyType === "TRUSTEE_COMPANY" ? "Trustee Company — add trustees and directors" : "Company — add directors only"}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={cls.label}>{c.companyType === "TRUSTEE_COMPANY" ? "Trust Name" : "Company Name"} <span className="text-red-500">*</span></label>
                        <input type="text" className={cls.input} placeholder={c.companyType === "TRUSTEE_COMPANY" ? "Smith Family Trust" : "ABC Pty Ltd"} value={c.companyName} onChange={(e) => updCompanyUH(ci, { companyName: e.target.value })} />
                      </div>
                      <div>
                        <label className={cls.label}>Company TFN <span className="text-red-500">*</span> <span className="ml-1 text-xs text-amber-500 font-normal">Encrypted</span></label>
                        <input className={cls.input + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={fmtTfn(c.companyTfn)} onChange={(e) => updCompanyUH(ci, { companyTfn: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
                      </div>
                      <div>
                        <label className={cls.label}>Company ABN</label>
                        <input className={cls.input + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={c.companyAbn} onChange={(e) => updCompanyUH(ci, { companyAbn: e.target.value })} />
                      </div>
                    </div>
                    <Addr label="Registered" value={c.companyAddress} onChange={(a) => updCompanyUH(ci, { companyAddress: a })} />

                    {/* Trustees (Trustee Company only) */}
                    {c.companyType === "TRUSTEE_COMPANY" && (
                      <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Trustees</h4>
                            <p className="text-[11px] text-slate-400 dark:text-white/40">Trustees of this trustee company (will receive invitation)</p>
                          </div>
                          <button type="button" onClick={() => addUHTrustee(ci)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Add Trustee
                          </button>
                        </div>
                        {c.trustees.length === 0 ? (
                          <div className="text-center py-3 rounded-lg border border-dashed border-slate-200 dark:border-white/10"><p className="text-[11px] text-slate-400 dark:text-white/40">Add at least one trustee</p></div>
                        ) : (
                          <div className="space-y-2">
                            {c.trustees.map((t, ti) => (
                              <div key={ti} className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Trustee {ti + 1}</span>
                                  <button type="button" onClick={() => remUHTrustee(ci, ti)} className="text-[11px] text-red-500 hover:underline">Remove</button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input type="text" className={cls.input} placeholder="Full name" value={t.name} onChange={(e) => updUHTrustee(ci, ti, { name: e.target.value })} />
                                  <input type="email" className={cls.input} placeholder="name@example.com" value={t.email} onChange={(e) => updUHTrustee(ci, ti, { email: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                                  <input type="text" className={cls.input + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={t.directorId || ""} onChange={(e) => updUHTrustee(ci, ti, { directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) })} />
                                  <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Directors (always shown) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 dark:text-white/60 uppercase tracking-wider">Directors</h4>
                          <p className="text-[11px] text-slate-400 dark:text-white/40">Directors of this company (will receive invitation)</p>
                        </div>
                        <button type="button" onClick={() => addDirector(ci)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          Add Director
                        </button>
                      </div>
                      {c.directors.length === 0 ? (
                        <div className="text-center py-3 rounded-lg border border-dashed border-slate-200 dark:border-white/10"><p className="text-[11px] text-slate-400 dark:text-white/40">Add at least one director</p></div>
                      ) : (
                        <div className="space-y-2">
                          {c.directors.map((d, di) => (
                            <div key={di} className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Director {di + 1}</span>
                                <button type="button" onClick={() => remDirector(ci, di)} className="text-[11px] text-red-500 hover:underline">Remove</button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input type="text" className={cls.input} placeholder="Full name" value={d.name} onChange={(e) => updDirector(ci, di, { name: e.target.value })} />
                                <input type="email" className={cls.input} placeholder="name@example.com" value={d.email} onChange={(e) => updDirector(ci, di, { email: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                                <input type="text" className={cls.input + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={d.directorId || ""} onChange={(e) => updDirector(ci, di, { directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) })} />
                                <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Individual Beneficiaries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80">Individual Beneficiaries</h3>
                <p className="text-xs text-slate-400 dark:text-white/40">Individual persons who may receive distributions from the trust</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => add("Beneficiary")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Adult
                </button>
                <button type="button" onClick={() => add("Beneficiary", true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Minor
                </button>
              </div>
            </div>
            {benInvites.length === 0 ? (
              <div className="text-center py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <p className="text-xs text-slate-400 dark:text-white/40">Click &ldquo;Add Adult&rdquo; or &ldquo;Add Minor&rdquo; to add beneficiaries</p>
              </div>
            ) : (
              <div className="space-y-2">{benInvites.map(renderPersonCard)}</div>
            )}
          </div>

          {/* Company Beneficiaries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80">Company Beneficiaries</h3>
                <p className="text-xs text-slate-400 dark:text-white/40">Companies that are beneficiaries — choose Company or Trustee Company</p>
              </div>
              <button type="button" onClick={addCompanyBen} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Company
              </button>
            </div>
            {cbs.length === 0 ? (
              <div className="text-center py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <p className="text-xs text-slate-400 dark:text-white/40">Click &ldquo;Add Company&rdquo; to add a company beneficiary</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cbs.map((cb, ci) => (
                  <div key={ci} className="p-5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cb.companyType === "TRUSTEE_COMPANY" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"}`}>
                          {cb.companyType === "TRUSTEE_COMPANY" ? "Trustee Company" : "Company"}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{cb.companyName || "New company"}</span>
                      </span>
                      <button type="button" onClick={() => remCompanyBen(ci)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>

                    {/* Company Type Selector */}
                    <div>
                      <label className={cls.label}>Company Type <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        {(["COMPANY", "TRUSTEE_COMPANY"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => updCompanyBen(ci, { companyType: t, trustees: t === "COMPANY" ? [] : cb.trustees })} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${cb.companyType === t ? "border-[#E91E8C] bg-[#E91E8C]/5 text-[#E91E8C]" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300"}`}>
                            {t === "COMPANY" ? "Company" : "Trustee Company"}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
                        {cb.companyType === "TRUSTEE_COMPANY" ? "Trustee Company — add trustees and directors" : "Company — add directors only"}
                      </p>
                    </div>

                    {/* Company Details */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={cls.label}>{cb.companyType === "TRUSTEE_COMPANY" ? "Trust Name" : "Company Name"} <span className="text-red-500">*</span></label>
                        <input type="text" className={cls.input} placeholder={cb.companyType === "TRUSTEE_COMPANY" ? "Smith Family Trust" : "ABC Pty Ltd"} value={cb.companyName} onChange={(e) => updCompanyBen(ci, { companyName: e.target.value })} />
                      </div>
                      <div>
                        <label className={cls.label}>Company ACN <span className="text-red-500">*</span></label>
                        <input className={cls.input + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={cb.companyAcn} onChange={(e) => updCompanyBen(ci, { companyAcn: e.target.value.replace(/[^0-9 ]/g, "").slice(0, 11) })} />
                      </div>
                      <div>
                        <label className={cls.label}>Company ABN</label>
                        <input className={cls.input + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={cb.companyAbn} onChange={(e) => updCompanyBen(ci, { companyAbn: e.target.value })} />
                      </div>
                    </div>
                    <Addr label="Registered" value={cb.companyAddress} onChange={(a) => updCompanyBen(ci, { companyAddress: a })} />

                    {/* Trustees (Trustee Company only) */}
                    {cb.companyType === "TRUSTEE_COMPANY" && (
                      <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Trustees</h4>
                            <p className="text-[11px] text-slate-400 dark:text-white/40">Trustees of this trustee company</p>
                          </div>
                          <button type="button" onClick={() => addCBTrustee(ci)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Add Trustee
                          </button>
                        </div>
                        {cb.trustees.length === 0 ? (
                          <div className="text-center py-3 rounded-lg border border-dashed border-slate-200 dark:border-white/10"><p className="text-[11px] text-slate-400 dark:text-white/40">Add at least one trustee</p></div>
                        ) : (
                          <div className="space-y-2">
                            {cb.trustees.map((t, ti) => (
                              <div key={ti} className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Trustee {ti + 1}</span>
                                  <button type="button" onClick={() => remCBTrustee(ci, ti)} className="text-[11px] text-red-500 hover:underline">Remove</button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input type="text" className={cls.input} placeholder="Full name" value={t.name} onChange={(e) => updCBTrustee(ci, ti, { name: e.target.value })} />
                                  <input type="email" className={cls.input} placeholder="name@example.com" value={t.email} onChange={(e) => updCBTrustee(ci, ti, { email: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                                  <input type="text" className={cls.input + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={t.directorId || ""} onChange={(e) => updCBTrustee(ci, ti, { directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) })} />
                                  <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Directors (always shown) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 dark:text-white/60 uppercase tracking-wider">Directors</h4>
                          <p className="text-[11px] text-slate-400 dark:text-white/40">Directors of this company (will receive invitation)</p>
                        </div>
                        <button type="button" onClick={() => addCBDirector(ci)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          Add Director
                        </button>
                      </div>
                      {cb.directors.length === 0 ? (
                        <div className="text-center py-3 rounded-lg border border-dashed border-slate-200 dark:border-white/10"><p className="text-[11px] text-slate-400 dark:text-white/40">Add at least one director</p></div>
                      ) : (
                        <div className="space-y-2">
                          {cb.directors.map((d, di) => (
                            <div key={di} className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Director {di + 1}</span>
                                <button type="button" onClick={() => remCBDirector(ci, di)} className="text-[11px] text-red-500 hover:underline">Remove</button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input type="text" className={cls.input} placeholder="Full name" value={d.name} onChange={(e) => updCBDirector(ci, di, { name: e.target.value })} />
                                <input type="email" className={cls.input} placeholder="name@example.com" value={d.email} onChange={(e) => updCBDirector(ci, di, { email: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                                <input type="text" className={cls.input + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={d.directorId || ""} onChange={(e) => updCBDirector(ci, di, { directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) })} />
                                <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4: Review
   ═══════════════════════════════════════════════════════════════════════════ */
function StepReview({ state }: { state: TrustWizardState }) {
  const addr = (a: TrustAddress) => [a.street, a.suburb, a.state, a.postcode].filter(Boolean).join(", ") || "—";
  const mask = (t: string) => t.length >= 3 ? `*** *** ${t.slice(-3)}` : t ? "***" : "—";
  const lbl = "text-xs text-slate-400 dark:text-white/40";
  const val = "text-sm text-slate-900 dark:text-white";
  const isUnit = state.trustType === "UNIT";

  // Group invites
  const directorInvites = state.invites.filter((i) => i.role === "Director");
  const benInvites = state.invites.filter((i) => i.role === "Beneficiary" || i.role === "Unit Holder");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Step 4: Review & Confirm</h2>
        <p className="text-sm text-slate-500 dark:text-white/60 mt-1">Please review all details before creating</p>
      </div>

      {/* Trust Info */}
      <div className={cls.card}>
        <p className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Trust Information</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><p className={lbl}>Trust Name</p><p className={val + " font-medium"}>{state.trustName || "—"}</p></div>
          <div><p className={lbl}>Trust Type</p><p className={val}>{state.trustType === "DISCRETIONARY" ? "Family / Discretionary" : "Unit Trust"}</p></div>
          <div><p className={lbl}>Trust TFN</p><p className={val + " font-mono"}>{mask(state.trustTfn)}</p></div>
          <div><p className={lbl}>Trust ABN</p><p className={val + " font-mono"}>{state.trustAbn || "—"}</p></div>
        </div>
      </div>

      {/* Trustee */}
      <div className={cls.card}>
        <p className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Trustee</p>
        {state.trusteeType === "INDIVIDUAL" ? (
          <div className="space-y-2">
            <p className={val}>Individual Trustee</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div><p className={lbl}>Name</p><p className={val + " font-medium"}>{state.trusteeName || "—"}</p></div>
              <div><p className={lbl}>Address</p><p className={val}>{addr(state.trusteeAddress)}</p></div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <div><p className={lbl}>Company</p><p className={val + " font-medium"}>{state.companyName || "—"}</p></div>
              <div><p className={lbl}>Company ACN</p><p className={val + " font-mono"}>{state.companyTfn || "—"}</p></div>
              <div><p className={lbl}>Company ABN</p><p className={val + " font-mono"}>{state.companyAbn || "—"}</p></div>
              <div><p className={lbl}>Registered Address</p><p className={val}>{addr(state.companyAddress)}</p></div>
            </div>
            {directorInvites.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Directors to invite ({directorInvites.length})</p>
                {directorInvites.map((inv, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/5 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white text-[10px] font-bold">{inv.name.charAt(0).toUpperCase() || "?"}</div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.name}</p>
                      <p className="text-xs text-slate-500">{inv.email}{inv.directorId ? ` · DIN: ${inv.directorId}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Individual Beneficiaries / Unit Holders to Invite */}
      {benInvites.length > 0 && (
        <div className={cls.card}>
          <p className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">{isUnit ? "Individual Unit Holders" : "Beneficiaries"} ({benInvites.length})</p>
          {benInvites.map((inv, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/5 mb-1 last:mb-0">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white text-[10px] font-bold">{inv.name.charAt(0).toUpperCase() || "?"}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.name}</p>
                <p className="text-xs text-slate-500">{inv.isMinor ? `Minor${inv.parentName ? ` — Parent: ${inv.parentName} (${inv.parentRelationship || ""})` : ""}` : inv.email}</p>
              </div>
              <div className="flex items-center gap-1">
                {inv.isMinor && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Minor</span>}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E91E8C]/10 text-[#E91E8C]">{inv.isMinor ? "Details filled" : "Will be invited"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Company Unit Holders (Unit Trust only) */}
      {isUnit && state.companyUnitHolders.length > 0 && (
        <div className={cls.card}>
          <p className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Company Unit Holders ({state.companyUnitHolders.length})</p>
          {state.companyUnitHolders.map((c, ci) => (
            <div key={ci} className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 mb-2 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.companyType === "TRUSTEE_COMPANY" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                  {c.companyType === "TRUSTEE_COMPANY" ? "Trustee Company" : "Company"}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <div><p className={lbl}>{c.companyType === "TRUSTEE_COMPANY" ? "Trust Name" : "Company Name"}</p><p className={val + " font-medium"}>{c.companyName || "—"}</p></div>
                <div><p className={lbl}>Company TFN</p><p className={val + " font-mono"}>{mask(c.companyTfn)}</p></div>
                <div><p className={lbl}>Company ABN</p><p className={val + " font-mono"}>{c.companyAbn || "—"}</p></div>
                <div><p className={lbl}>Registered Address</p><p className={val}>{addr(c.companyAddress)}</p></div>
              </div>
              {c.companyType === "TRUSTEE_COMPANY" && c.trustees.length > 0 && (
                <div className="pt-2 border-t border-indigo-200 dark:border-indigo-700 mb-2">
                  <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase mb-1">Trustees to invite ({c.trustees.length})</p>
                  {c.trustees.map((t, ti) => (
                    <div key={ti} className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-white/5 mb-1 last:mb-0">
                      <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-bold">{t.name.charAt(0).toUpperCase() || "?"}</div>
                      <div><p className="text-sm text-slate-900 dark:text-white">{t.name}</p><p className="text-[11px] text-slate-500">{t.email}{t.directorId ? ` · DIN: ${t.directorId}` : ""}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {c.directors.length > 0 && (
                <div className="pt-2 border-t border-purple-200 dark:border-purple-700">
                  <p className="text-xs font-semibold text-purple-500 dark:text-purple-400 uppercase mb-1">Directors to invite ({c.directors.length})</p>
                  {c.directors.map((d, di) => (
                    <div key={di} className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-white/5 mb-1 last:mb-0">
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-[9px] font-bold">{d.name.charAt(0).toUpperCase() || "?"}</div>
                      <div><p className="text-sm text-slate-900 dark:text-white">{d.name}</p><p className="text-[11px] text-slate-500">{d.email}{d.directorId ? ` · DIN: ${d.directorId}` : ""}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Company Beneficiaries */}
      {state.companyBeneficiaries.length > 0 && (
        <div className={cls.card}>
          <p className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Company Beneficiaries ({state.companyBeneficiaries.length})</p>
          {state.companyBeneficiaries.map((cb, ci) => (
            <div key={ci} className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 mb-2 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cb.companyType === "TRUSTEE_COMPANY" ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"}`}>
                  {cb.companyType === "TRUSTEE_COMPANY" ? "Trustee Company" : "Company"}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <div><p className={lbl}>{cb.companyType === "TRUSTEE_COMPANY" ? "Trust Name" : "Company Name"}</p><p className={val + " font-medium"}>{cb.companyName || "—"}</p></div>
                <div><p className={lbl}>Company ACN</p><p className={val + " font-mono"}>{cb.companyAcn || "—"}</p></div>
                <div><p className={lbl}>Company ABN</p><p className={val + " font-mono"}>{cb.companyAbn || "—"}</p></div>
                <div><p className={lbl}>Registered Address</p><p className={val}>{addr(cb.companyAddress)}</p></div>
              </div>
              {cb.companyType === "TRUSTEE_COMPANY" && cb.trustees.length > 0 && (
                <div className="pt-2 border-t border-indigo-200 dark:border-indigo-700 mb-2">
                  <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase mb-1">Trustees to invite ({cb.trustees.length})</p>
                  {cb.trustees.map((t, ti) => (
                    <div key={ti} className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-white/5 mb-1 last:mb-0">
                      <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-bold">{t.name.charAt(0).toUpperCase() || "?"}</div>
                      <div><p className="text-sm text-slate-900 dark:text-white">{t.name}</p><p className="text-[11px] text-slate-500">{t.email}{t.directorId ? ` · DIN: ${t.directorId}` : ""}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {cb.directors.length > 0 && (
                <div className="pt-2 border-t border-teal-200 dark:border-teal-700">
                  <p className="text-xs font-semibold text-purple-500 dark:text-purple-400 uppercase mb-1">Directors to invite ({cb.directors.length})</p>
                  {cb.directors.map((d, di) => (
                    <div key={di} className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-white/5 mb-1 last:mb-0">
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-[9px] font-bold">{d.name.charAt(0).toUpperCase() || "?"}</div>
                      <div><p className="text-sm text-slate-900 dark:text-white">{d.name}</p><p className="text-[11px] text-slate-500">{d.email}{d.directorId ? ` · DIN: ${d.directorId}` : ""}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
type Step = "account-type" | "name" | "trust-type" | "trust-info" | "invites" | "review";

export default function NewAccountPage() {
  const router = useRouter();
  const { createAccount, updateProfile } = useAccount();

  const [step, setStep] = useState<Step>("account-type");
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Trust wizard state
  const [trustState, setTrustState] = useState<TrustWizardState>(defaultState("DISCRETIONARY"));

  // Step flow
  const trustSteps: Step[] = ["account-type", "trust-type", "trust-info", "invites", "review"];
  const steps = selectedType === "TRUST" ? trustSteps : ["account-type", "name"] as Step[];
  const idx = steps.indexOf(step);

  function back() {
    if (idx > 0) setStep(steps[idx - 1]);
    else { setStep("account-type"); setSelectedType(null); }
    setError("");
  }
  function next() { if (idx < steps.length - 1) setStep(steps[idx + 1]); setError(""); }

  // Validation
  function valTrustInfo(): string | null {
    if (!trustState.trustName.trim()) return "Trust name is required";
    // Trust TFN is required
    const tTfn = trustState.trustTfn.replace(/\s/g, "");
    if (!tTfn) return "Trust TFN is required";
    if (!/^\d{8,9}$/.test(tTfn)) return "Trust TFN must be 8 or 9 digits";
    if (trustState.trusteeType === "INDIVIDUAL") {
      if (!trustState.trusteeName.trim()) return "Trustee name is required";
      if (!trustState.trusteeAddress.street.trim()) return "Trustee street address is required";
      if (!trustState.trusteeAddress.state) return "Trustee state is required";
      if (!trustState.trusteeAddress.postcode) return "Trustee postcode is required";
    }
    if (trustState.trusteeType === "COMPANY") {
      if (!trustState.companyName.trim()) return "Company name is required";
      // Corporate Trustee ACN is required
      const cAcn = trustState.companyTfn.replace(/\s/g, "");
      if (!cAcn) return "Company ACN is required";
      if (!/^\d{9}$/.test(cAcn)) return "Company ACN must be 9 digits";
      if (!trustState.companyAddress.street.trim()) return "Company registered address is required";
      if (!trustState.companyAddress.state) return "Company state is required";
      if (!trustState.companyAddress.postcode) return "Company postcode is required";
    }
    return null;
  }

  function valInvites(): string | null {
    const hasIndividualInvites = trustState.invites.length > 0;
    const hasCompanyUH = trustState.companyUnitHolders.length > 0;
    const hasCompanyBen = trustState.companyBeneficiaries.length > 0;
    if (!hasIndividualInvites && !hasCompanyUH && !hasCompanyBen) return "Please add at least one person or company";
    for (let i = 0; i < trustState.invites.length; i++) {
      const inv = trustState.invites[i];
      if (!inv.name.trim()) return `${inv.role || "Person"} ${i + 1}: name is required`;
      if (!inv.isMinor && !inv.email.includes("@")) return `${inv.role || "Person"} ${i + 1}: valid email is required`;
      if (inv.isMinor && !inv.address?.street?.trim()) return `Minor "${inv.name}": address is required`;
    }
    // Validate company unit holders
    for (let ci = 0; ci < trustState.companyUnitHolders.length; ci++) {
      const c = trustState.companyUnitHolders[ci];
      if (!c.companyName.trim()) return `Company Unit Holder ${ci + 1}: company name is required`;
      const cuhTfn = c.companyTfn.replace(/\s/g, "");
      if (!cuhTfn) return `Company "${c.companyName}": TFN is required`;
      if (!/^\d{8,9}$/.test(cuhTfn)) return `Company "${c.companyName}": TFN must be 8 or 9 digits`;
      if (!c.companyAddress.street.trim()) return `Company "${c.companyName}": registered address is required`;
      for (let di = 0; di < c.directors.length; di++) {
        const d = c.directors[di];
        if (!d.name.trim()) return `Company "${c.companyName}" — Director ${di + 1}: name is required`;
        if (!d.email.includes("@")) return `Company "${c.companyName}" — Director ${di + 1}: valid email is required`;
      }
      if (c.companyType === "TRUSTEE_COMPANY") {
        for (let ti = 0; ti < c.trustees.length; ti++) {
          const t = c.trustees[ti];
          if (!t.name.trim()) return `Company "${c.companyName}" — Trustee ${ti + 1}: name is required`;
          if (!t.email.includes("@")) return `Company "${c.companyName}" — Trustee ${ti + 1}: valid email is required`;
        }
      }
    }
    // Validate company beneficiaries
    for (let ci = 0; ci < trustState.companyBeneficiaries.length; ci++) {
      const cb = trustState.companyBeneficiaries[ci];
      if (!cb.companyName.trim()) return `Company Beneficiary ${ci + 1}: company name is required`;
      const cbAcn = cb.companyAcn.replace(/\s/g, "");
      if (!cbAcn) return `Company "${cb.companyName}": ACN is required`;
      if (!/^\d{9}$/.test(cbAcn)) return `Company "${cb.companyName}": ACN must be 9 digits`;
      if (!cb.companyAddress.street.trim()) return `Company "${cb.companyName}": registered address is required`;
      for (let di = 0; di < cb.directors.length; di++) {
        const d = cb.directors[di];
        if (!d.name.trim()) return `Company "${cb.companyName}" — Director ${di + 1}: name is required`;
        if (!d.email.includes("@")) return `Company "${cb.companyName}" — Director ${di + 1}: valid email is required`;
      }
      if (cb.companyType === "TRUSTEE_COMPANY") {
        for (let ti = 0; ti < cb.trustees.length; ti++) {
          const t = cb.trustees[ti];
          if (!t.name.trim()) return `Company "${cb.companyName}" — Trustee ${ti + 1}: name is required`;
          if (!t.email.includes("@")) return `Company "${cb.companyName}" — Trustee ${ti + 1}: valid email is required`;
        }
      }
    }
    return null;
  }

  function nextWithValidation(validator: () => string | null) {
    const err = validator();
    if (err) { setError(err); return; }
    next();
  }

  // Account type selection
  function selectType(type: AccountType) {
    setSelectedType(type);
    setError("");
    if (type === "TRUST") { setStep("trust-type"); }
    else {
    setStep("name");
      setAccountName(type === "INDIVIDUAL" ? "My Personal Account" : type === "COMPANY" ? "My Company" : "My Partnership");
    }
  }

  // Non-trust create
  async function createNonTrust() {
    if (!selectedType || !accountName.trim()) { setError("Please provide an account name"); return; }
    setLoading(true); setError("");
    try {
      const acc = await createAccount(selectedType, accountName.trim());
      router.push(`/user-dashboard/accounts/${acc.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create account"); setLoading(false); }
  }

  // Trust create — save profile & send invitations
  async function createTrust() {
    setLoading(true); setError("");
    try {
      const acc = await createAccount("TRUST", trustState.trustName);

      // Build trustee data for JSON storage
      const trusteeData = trustState.trusteeType === "INDIVIDUAL"
        ? { type: "INDIVIDUAL" as const, fullName: trustState.trusteeName, address: trustState.trusteeAddress }
        : {
            type: "COMPANY" as const,
            companyName: trustState.companyName,
            companyTfn: trustState.companyTfn,
            companyAbn: trustState.companyAbn,
            registeredAddress: trustState.companyAddress,
          };

      const profile: Record<string, unknown> = {
        trustName: trustState.trustName,
        trustType: trustState.trustType,
        tfn: trustState.trustTfn || undefined,
        abn: trustState.trustAbn || undefined,
        trusteeDetails: JSON.stringify([trusteeData]),
        beneficiaries: "[]",
      };
      await updateProfile(acc.id, profile);

      // Send invitations / create entries for everyone
      const { apiPost: post } = await import("@/lib/api");
      for (const inv of trustState.invites) {
        try {
          if (inv.isMinor) {
            // Minor — creator fills details directly, no invite
            await post("/trust-partners", {
              accountId: acc.id,
              email: "", // placeholder
              name: inv.name,
              role: inv.role,
              isMinor: true,
              dateOfBirth: inv.dateOfBirth || undefined,
              streetAddress: inv.address?.street || undefined,
              suburb: inv.address?.suburb || undefined,
              state: inv.address?.state || undefined,
              postcode: inv.address?.postcode || undefined,
              parentName: inv.parentName || undefined,
              parentRelationship: inv.parentRelationship || undefined,
            });
          } else {
            // Adult — invite sent
            await post("/trust-partners", {
              accountId: acc.id,
              email: inv.email,
              name: inv.name,
              role: inv.role,
              directorId: inv.directorId || undefined,
            });
          }
        } catch {
          console.warn(`Failed to add ${inv.name}`);
        }
      }

      // Create company unit holders + invite their directors (and trustees if Trustee Company)
      for (const cuh of trustState.companyUnitHolders) {
        try {
          const companyRes = await post<{ partner: { id: string } }>("/trust-partners", {
            accountId: acc.id,
            email: `company-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@placeholder.internal`,
            name: cuh.companyName,
            role: "Unit Holder",
            partnerType: "COMPANY",
            companyName: cuh.companyName,
            companyTfn: cuh.companyTfn || undefined,
            companyAbn: cuh.companyAbn || undefined,
            companyAddress: cuh.companyAddress.street,
            companySuburb: cuh.companyAddress.suburb,
            companyState: cuh.companyAddress.state,
            companyPostcode: cuh.companyAddress.postcode,
          });
          const parentId = companyRes?.partner?.id;
          // Invite trustees (Trustee Company only)
          if (cuh.companyType === "TRUSTEE_COMPANY") {
            for (const trustee of cuh.trustees) {
              try {
                await post("/trust-partners", {
                  accountId: acc.id,
                  email: trustee.email,
                  name: trustee.name,
                  role: "UH Trustee",
                  parentPartnerId: parentId || undefined,
                  directorId: trustee.directorId || undefined,
                });
              } catch {
                console.warn(`Failed to invite trustee ${trustee.email}`);
              }
            }
          }
          // Invite directors
          for (const dir of cuh.directors) {
            try {
              await post("/trust-partners", {
                accountId: acc.id,
                email: dir.email,
                name: dir.name,
                role: "UH Director",
                parentPartnerId: parentId || undefined,
                directorId: dir.directorId || undefined,
              });
            } catch {
              console.warn(`Failed to invite director ${dir.email}`);
            }
          }
        } catch {
          console.warn(`Failed to create company UH ${cuh.companyName}`);
        }
      }

      // Create company beneficiaries + invite their directors (and trustees if Trustee Company)
      for (const cb of trustState.companyBeneficiaries) {
        try {
          const cbRes = await post<{ partner: { id: string } }>("/trust-partners", {
            accountId: acc.id,
            email: `company-ben-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@placeholder.internal`,
            name: cb.companyName,
            role: "Beneficiary",
            partnerType: "COMPANY",
            companyName: cb.companyName,
            companyTfn: cb.companyAcn || undefined,
            companyAbn: cb.companyAbn || undefined,
            companyAddress: cb.companyAddress.street,
            companySuburb: cb.companyAddress.suburb,
            companyState: cb.companyAddress.state,
            companyPostcode: cb.companyAddress.postcode,
          });
          const parentId = cbRes?.partner?.id;
          // Invite trustees (Trustee Company only)
          if (cb.companyType === "TRUSTEE_COMPANY") {
            for (const trustee of cb.trustees) {
              try {
                await post("/trust-partners", {
                  accountId: acc.id,
                  email: trustee.email,
                  name: trustee.name,
                  role: "Ben Trustee",
                  parentPartnerId: parentId || undefined,
                  directorId: trustee.directorId || undefined,
                });
              } catch {
                console.warn(`Failed to invite trustee ${trustee.email}`);
              }
            }
          }
          // Invite directors (non-minors get invited)
          for (const dir of cb.directors) {
            try {
              await post("/trust-partners", {
                accountId: acc.id,
                email: dir.email,
                name: dir.name,
                role: "Ben Director",
                parentPartnerId: parentId || undefined,
                directorId: dir.directorId || undefined,
              });
            } catch {
              console.warn(`Failed to invite director ${dir.email}`);
            }
          }
        } catch {
          console.warn(`Failed to create company beneficiary ${cb.companyName}`);
        }
      }

      router.push(`/user-dashboard/accounts/${acc.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create trust"); setLoading(false); }
  }

  const stepLabels: Record<Step, string> = {
    "account-type": "Account Type",
    name: "Name",
    "trust-type": "Trust Type",
    "trust-info": "Trust & Trustee",
    invites: "Add Beneficiaries",
    review: "Review",
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button type="button" onClick={() => step === "account-type" ? router.back() : back()} className="flex items-center gap-2 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create New Account</h1>
      </div>

      {/* Progress */}
      {steps.length > 1 && (
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-2">
            {steps.map((_, i) => <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= idx ? "bg-[#E91E8C]" : "bg-slate-200 dark:bg-white/10"}`} />)}
          </div>
          <div className="flex justify-between text-xs text-slate-400 dark:text-white/40">
            <span>Step {idx + 1} of {steps.length}</span>
            <span>{stepLabels[step]}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
      )}

      {/* ── Account type selection ──────────────────────────────────────── */}
      {step === "account-type" && (
        <div className="space-y-4">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t.type} type="button" onClick={() => selectType(t.type)} className="w-full p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#E91E8C]/50 hover:shadow-lg hover:shadow-[#E91E8C]/10 transition-all text-left group">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{t.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-[#E91E8C]">{t.label}</h3>
                  <p className="text-slate-500 dark:text-white/60 mt-1">{t.desc}</p>
                </div>
                <svg className="w-6 h-6 text-slate-300 group-hover:text-[#E91E8C] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Non-trust name step ─────────────────────────────────────────── */}
      {step === "name" && selectedType && selectedType !== "TRUST" && (
        <div className={cls.card}>
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
            <span className="text-2xl">{ACCOUNT_TYPES.find((t) => t.type === selectedType)?.icon}</span>
            <div><p className="text-sm text-slate-500 dark:text-white/60">Account Type</p><p className="font-medium text-slate-900 dark:text-white">{ACCOUNT_TYPES.find((t) => t.type === selectedType)?.label}</p></div>
            <button type="button" onClick={() => { setStep("account-type"); setSelectedType(null); }} className="ml-auto text-sm text-[#E91E8C] hover:underline">Change</button>
          </div>
          <div className="space-y-4">
            <div><label className={cls.label}>Account Name</label><input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Enter a name" className={cls.input} /></div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={back} className={cls.outline + " flex-1"}>Back</button>
              <button type="button" onClick={createNonTrust} disabled={loading || !accountName.trim()} className={cls.pink + " flex-1"}>{loading ? "Creating..." : "Create Account"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trust Step 1: Trust Type ────────────────────────────────────── */}
      {step === "trust-type" && (
        <StepTrustType onSelect={(t) => { setTrustState(defaultState(t)); setStep("trust-info"); }} />
      )}

      {/* ── Trust Step 2: Trust Info + Trustee ──────────────────────────── */}
      {step === "trust-info" && (
        <div>
          <StepTrustInfo state={trustState} setState={setTrustState} />
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={back} className={cls.outline + " flex-1"}>Back</button>
            <button type="button" onClick={() => nextWithValidation(valTrustInfo)} className={cls.pink + " flex-1"}>Continue</button>
          </div>
        </div>
      )}

      {/* ── Trust Step 3: Invite Everyone ───────────────────────────────── */}
      {step === "invites" && (
        <div>
          <StepInviteAll state={trustState} setState={setTrustState} />
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={back} className={cls.outline + " flex-1"}>Back</button>
            <button type="button" onClick={() => nextWithValidation(valInvites)} className={cls.pink + " flex-1"}>Continue to Review</button>
          </div>
        </div>
      )}

      {/* ── Trust Step 4: Review & Create ──────────────────────────────── */}
      {step === "review" && (
        <div>
          <StepReview state={trustState} />
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={back} className={cls.outline + " flex-1"}>Back</button>
            <button type="button" onClick={createTrust} disabled={loading} className={cls.pink + " flex-1"}>
              {loading ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</span> : "Create Trust Account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
