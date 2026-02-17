"use client";

/**
 * User Consents - Digital contract signing and consent management.
 * Users must sign required consents before services can be activated.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useAccount } from "@/contexts/account-context";
import { apiGet, apiPost } from "@/lib/api";

type ConsentType = 
  | "TAX_AGENT_AUTHORITY" 
  | "ENGAGEMENT_LETTER";

interface Consent {
  id: string;
  accountId: string;
  consentType: ConsentType;
  acceptedBy: string;
  acceptedAt: string;
  ipAddress: string | null;
}

interface ConsentCheck {
  hasRequired: boolean;
  missing: ConsentType[];
  accepted: ConsentType[];
  accountType?: string;
}

const CONSENT_INFO: Record<ConsentType, { title: string; description: string }> = {
  TAX_AGENT_AUTHORITY: {
    title: "Tax Agent Authority",
    description: "I authorise Onboard to act as my registered tax agent and to communicate with the Australian Taxation Office (ATO) on my behalf.",
  },
  ENGAGEMENT_LETTER: {
    title: "Engagement Letter",
    description: "I accept the terms of engagement as outlined in the engagement letter for accounting services.",
  },
};

const ALL_CONSENTS: ConsentType[] = [
  "TAX_AGENT_AUTHORITY",
  "ENGAGEMENT_LETTER",
];

// TAX_AGENT_AUTHORITY is always required.
// ENGAGEMENT_LETTER is required for Company, Trust, Partnership — optional for Individual.
function getRequiredConsents(accountType?: string): ConsentType[] {
  const required: ConsentType[] = ["TAX_AGENT_AUTHORITY"];
  if (accountType && accountType !== "INDIVIDUAL") {
    required.push("ENGAGEMENT_LETTER");
  }
  return required;
}

export default function ConsentsPage() {
  const { currentAccount, loading: accountLoading } = useAccount();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [consentCheck, setConsentCheck] = useState<ConsentCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<ConsentType | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [signatureModal, setSignatureModal] = useState<ConsentType | null>(null);
  const [signature, setSignature] = useState("");
  const [signatureData, setSignatureData] = useState<string>("");
  const [signatureMode, setSignatureMode] = useState<"type" | "draw">("draw");

  useEffect(() => {
    if (currentAccount) {
      loadConsents();
    }
  }, [currentAccount]);

  async function loadConsents() {
    if (!currentAccount) return;
    setLoading(true);
    try {
      const [consentsRes, checkRes] = await Promise.all([
        apiGet<{ consents: Consent[] }>(`/consents/account/${currentAccount.id}`),
        apiGet<ConsentCheck>(`/consents/check/${currentAccount.id}`),
      ]);
      setConsents(consentsRes.consents || []);
      setConsentCheck(checkRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load consents");
    } finally {
      setLoading(false);
    }
  }

  function isConsentSigned(type: ConsentType): boolean {
    return consents.some((c) => c.consentType === type);
  }

  function getConsentDate(type: ConsentType): string | null {
    const consent = consents.find((c) => c.consentType === type);
    return consent ? new Date(consent.acceptedAt).toLocaleDateString() : null;
  }

  async function handleSign(type: ConsentType) {
    const hasSignature = signatureMode === "type" ? signature.trim() : signatureData;
    if (!currentAccount || !hasSignature) {
      setError(signatureMode === "type" ? "Please enter your full name as signature" : "Please draw your signature");
      return;
    }

    setSigning(type);
    setError("");
    setSuccess("");

    try {
      await apiPost("/consents/accept", {
        accountId: currentAccount.id,
        consentTypes: [type],
        documentVersion: "1.0",
        signatureData: signatureMode === "draw" ? signatureData : undefined,
        signatureType: signatureMode,
        signedName: signatureMode === "type" ? signature.trim() : undefined,
      });
      setSuccess(`${CONSENT_INFO[type].title} signed successfully!`);
      setSignatureModal(null);
      setSignature("");
      setSignatureData("");
      await loadConsents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign consent");
    } finally {
      setSigning(null);
    }
  }

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Account Selected</h3>
        <p className="text-slate-500 dark:text-white/60">
          Please create or select an account to manage consents.
        </p>
      </div>
    );
  }

  const requiredForThisAccount = getRequiredConsents(currentAccount?.accountType);
  const requiredPending = requiredForThisAccount.filter((t) => !isConsentSigned(t));
  const allSigned = requiredPending.length === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Digital Contracts & Consents</h1>
        <p className="text-slate-500 dark:text-white/60 mt-1">
          Sign required consents to activate services for{" "}
          <span className="font-medium text-[#0891b2]">{currentAccount.name}</span>
        </p>
      </div>

      {/* Status Banner */}
      {!loading && (
        <div className={`mb-6 p-4 rounded-xl ${
          allSigned 
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-3">
            {allSigned ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">All required consents signed</p>
                  <p className="text-sm text-green-700 dark:text-green-400">You can now purchase and activate services.</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">{requiredPending.length} required consent(s) pending</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">Please sign all required consents to activate services.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Required Consents */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Required Consents</h2>
            <div className="space-y-4">
              {requiredForThisAccount.map((type) => (
                <ConsentCard
                  key={type}
                  type={type}
                  info={CONSENT_INFO[type]}
                  isSigned={isConsentSigned(type)}
                  signedDate={getConsentDate(type)}
                  required
                  onSign={() => {
                    setSignatureModal(type);
                    setSignature("");
                    setError("");
                  }}
                />
              ))}
            </div>
          </div>

          {/* Optional Consents */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Optional Consents</h2>
            <div className="space-y-4">
              {ALL_CONSENTS.filter((t) => !requiredForThisAccount.includes(t)).map((type) => (
                <ConsentCard
                  key={type}
                  type={type}
                  info={CONSENT_INFO[type]}
                  isSigned={isConsentSigned(type)}
                  signedDate={getConsentDate(type)}
                  onSign={() => {
                    setSignatureModal(type);
                    setSignature("");
                    setError("");
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Signature Modal */}
      {signatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sign {CONSENT_INFO[signatureModal].title}
              </h2>
            </div>
            <div className="p-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 mb-6">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {CONSENT_INFO[signatureModal].description}
                </p>
              </div>

              {/* Signature Mode Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSignatureMode("draw")}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                    signatureMode === "draw"
                      ? "bg-[#0891b2] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Draw Signature
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode("type")}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                    signatureMode === "type"
                      ? "bg-[#0891b2] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    Type Name
                  </span>
                </button>
              </div>

              {/* Draw Signature */}
              {signatureMode === "draw" && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Draw your signature below
                  </label>
                  <SignatureCanvas
                    onSignatureChange={setSignatureData}
                    signatureData={signatureData}
                  />
                </div>
              )}

              {/* Type Signature */}
              {signatureMode === "type" && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Type your full name
                  </label>
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white font-medium"
                  />
                  {signature && (
                    <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Signature Preview:</p>
                      <p className="text-2xl text-slate-900 dark:text-white italic" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>
                        {signature}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                By clicking &quot;Sign & Accept&quot;, you confirm that you have read and agree to the above terms. 
                Your IP address and timestamp will be recorded for audit purposes.
              </p>

              {error && (
                <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSignatureModal(null);
                    setSignature("");
                    setSignatureData("");
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSign(signatureModal)}
                  disabled={signing === signatureModal || (signatureMode === "type" ? !signature.trim() : !signatureData)}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white font-medium hover:shadow-lg hover:shadow-[#0891b2]/30 disabled:opacity-50"
                >
                  {signing === signatureModal ? "Signing..." : "Sign & Accept"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsentCard({
  type,
  info,
  isSigned,
  signedDate,
  required = false,
  onSign,
}: {
  type: ConsentType;
  info: { title: string; description: string };
  isSigned: boolean;
  signedDate: string | null;
  required?: boolean;
  onSign: () => void;
}) {
  return (
    <div className={`rounded-2xl p-6 ${
      isSigned 
        ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800"
        : "bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">{info.title}</h3>
            {required && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Required
              </span>
            )}
            {!required && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                Optional
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-white/70">{info.description}</p>
          {isSigned && signedDate && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Signed on {signedDate}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {isSigned ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Signed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSign}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white text-sm font-medium hover:shadow-lg hover:shadow-[#0891b2]/30 transition-all"
            >
              Sign Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Digital Signature Canvas Component
function SignatureCanvas({
  onSignatureChange,
  signatureData,
}: {
  onSignatureChange: (data: string) => void;
  signatureData: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; // Retina display
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw existing signature if any
    if (signatureData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = signatureData;
    }
  }, []);

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCoordinates]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }, [isDrawing, getCoordinates]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL("image/png");
      onSignatureChange(dataUrl);
    }
  }, [isDrawing, hasSignature, onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onSignatureChange("");
  }, [onSignatureChange]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-400 text-sm">Draw your signature here</p>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Use your mouse or finger to sign
        </p>
        <button
          type="button"
          onClick={clearSignature}
          className="text-sm text-[#0891b2] hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear
        </button>
      </div>
    </div>
  );
}
