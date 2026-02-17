"use client";

/**
 * Public Homepage — Onboard by Bhalekar
 * Enterprise-grade client portal for Australian accounting practices
 * White background design matching bhalekar.ai
 */

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

/* ---------- animated counter hook ---------- */
function useCountUp(target: number, duration = 2000, start: boolean) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!start) { setVal(0); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, start]);
  return val;
}

/* ---------- intersection observer hook ---------- */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ========== PAGE ========== */
export default function PublicHomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const statsVis = useInView(0.3);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      email: fd.get("email") as string,
      phone: fd.get("phone") as string,
      practiceSize: fd.get("practiceSize") as string,
      message: fd.get("message") as string,
    };

    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${API}/contact/demo-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Request failed");
      e.currentTarget.reset();
      setToast("Thank you! We'll be in touch within one business day.");
    } catch {
      setToast("Something went wrong. Please email us directly at info@bhalekar.com.au");
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  /* ---------- DATA ---------- */
  const problems = [
    { icon: "⏰", title: "Time-Consuming", desc: "Chasing clients for documents, details and signatures via email and phone." },
    { icon: "⚠️", title: "Risky", desc: "Sensitive TFN and financial data floating around in emails and WhatsApp." },
    { icon: "📈", title: "Unscalable", desc: "More clients means more spreadsheets, more chaos, more errors." },
    { icon: "🚫", title: "Non-Compliant", desc: "No audit trail, no encryption, no proper access control." },
  ];

  const clientFeatures = [
    { icon: "🔐", title: "Secure Registration & Verification", desc: "Email + OTP verification. Quick, simple, and compliant." },
    { icon: "🏢", title: "Multi-Account Management", desc: "Individual, Company, Trust & Partnership accounts — all from one login." },
    { icon: "👥", title: "Partner & Spouse Collaboration", desc: "Invite directors, trustees, beneficiaries and spouses via branded emails." },
    { icon: "🛒", title: "Service Marketplace", desc: "Clients browse, purchase & pay for accounting services via Stripe." },
    { icon: "✍️", title: "Digital Consent & Signatures", desc: "Legally binding digital signatures with full IP & timestamp audit trail." },
    { icon: "🎫", title: "Support Tickets", desc: "Clients raise tickets directly from their dashboard — your team resolves." },
  ];

  const adminFeatures = [
    { icon: "📊", title: "Dashboard Overview", desc: "Users, accounts, tickets, revenue — all at a glance." },
    { icon: "👤", title: "User Management", desc: "Full CRUD, search, filter, roles, status control." },
    { icon: "💳", title: "Payment & Revenue", desc: "Stripe payments, revenue tracking, GST calculation." },
    { icon: "🔑", title: "RBAC Access Control", desc: "4 default roles + custom roles with fine-grained permissions." },
    { icon: "🌐", title: "Website CMS", desc: "Update your entire public website without any developer." },
    { icon: "⚙️", title: "Full Configuration", desc: "Email, SMS, payments, templates — all from admin panel." },
  ];

  const differentiators = [
    { icon: "🇦🇺", title: "Built for Australia", desc: "TFN encryption, ABN validation via ABR, GST tracking, Australian account structures, AUD currency." },
    { icon: "🛡️", title: "Enterprise Security", desc: "AES-256-GCM encryption, bcrypt hashing, JWT + HTTP-only cookies, Helmet headers, rate limiting." },
    { icon: "🤝", title: "Self-Service Onboarding", desc: "Clients register, fill details, invite partners, sign consents & pay — all without your team lifting a finger." },
    { icon: "📝", title: "Legal Audit Trail", desc: "Digital signatures with IP address, browser fingerprint, timestamp, document version — legally defensible." },
    { icon: "🏗️", title: "Multi-Account Architecture", desc: "One client, multiple accounts. Each account with multiple partners. Handles complex trust structures." },
    { icon: "💰", title: "Low Running Cost", desc: "~AUD $25–45/month total hosting + services. Cheaper than a single hour of your time." },
  ];

  const stats = [
    { value: 150, suffix: "+", label: "API Endpoints", dur: 2000 },
    { value: 25, suffix: "+", label: "Database Models", dur: 1500 },
    { value: 30, suffix: "+", label: "Frontend Pages", dur: 1800 },
    { value: 4, suffix: "", label: "Account Types", dur: 1200 },
  ];

  const techStack = [
    { name: "Next.js 14", cat: "Frontend" },
    { name: "React 18", cat: "Frontend" },
    { name: "TypeScript", cat: "Full Stack" },
    { name: "Tailwind CSS", cat: "Frontend" },
    { name: "Fastify", cat: "Backend" },
    { name: "Prisma ORM", cat: "Backend" },
    { name: "PostgreSQL", cat: "Database" },
    { name: "Stripe", cat: "Payments" },
    { name: "Twilio", cat: "SMS" },
    { name: "SendGrid", cat: "Email" },
    { name: "AES-256", cat: "Security" },
    { name: "JWT + RBAC", cat: "Auth" },
  ];

  const compliance = [
    { badge: "SOC 2", desc: "Encryption at rest & in transit, access controls, audit logging" },
    { badge: "Privacy Act", desc: "Data minimisation, purpose limitation, consent collection" },
    { badge: "ATO", desc: "TFN encryption, ABN validation, Tax Agent Authority consent" },
    { badge: "PCI DSS", desc: "Stripe handles all card data — zero card storage" },
    { badge: "OWASP", desc: "Input validation, auth controls, security headers, rate limiting" },
  ];

  const costs = [
    { item: "Application Hosting", detail: "Server, DB, Frontend", cost: "$22 – $40" },
    { item: "SMS (Twilio)", detail: "Phone verification", cost: "$2 – $5" },
    { item: "Emails (SendGrid)", detail: "Notifications", cost: "FREE" },
    { item: "Payments (Stripe)", detail: "Client payments", cost: "1.75% + $0.30/txn" },
    { item: "Domain Name", detail: ".com.au", cost: "$15 – $30/yr" },
    { item: "SSL + ABN Lookup", detail: "Security & validation", cost: "FREE" },
  ];

  const testimonials = [
    { name: "Sarah Mitchell", role: "CEO, TechStart Solutions", text: "Onboard transformed our financial management. Their expertise saved us over $30,000 in the first year alone. Highly professional!", img: "https://i.pravatar.cc/150?img=47" },
    { name: "Michael Chen", role: "Property Investor", text: "Tax compliance was overwhelming. Onboard simplified everything and helped me maximize deductions. Exceptional team!", img: "https://i.pravatar.cc/150?img=12" },
    { name: "Emma Thompson", role: "Small Business Owner", text: "The cloud accounting setup was seamless. I can focus on growing my business while Onboard handles the rest.", img: "https://i.pravatar.cc/150?img=45" },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" suppressHydrationWarning>

      {/* ===== NAVBAR ===== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">O</div>
            <div className="flex flex-col leading-tight">
              <span className={`text-xl font-bold tracking-tight ${scrolled ? "text-slate-900" : "text-white"}`}>Onboard</span>
              <span className={`text-[9px] uppercase tracking-widest font-medium ${scrolled ? "text-brand-teal" : "text-white/70"}`}>by Bhalekar</span>
            </div>
          </Link>
          <div className={`hidden lg:flex items-center gap-8 text-sm font-medium ${scrolled ? "text-slate-600" : "text-white/80"}`}>
            <a href="#problem" className="hover:text-brand-teal transition-colors">Why Onboard</a>
            <a href="#features" className="hover:text-brand-teal transition-colors">Features</a>
            <a href="#security" className="hover:text-brand-teal transition-colors">Security</a>
            <a href="#pricing" className="hover:text-brand-teal transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-brand-teal transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className={`hidden sm:block text-sm font-medium transition-colors ${scrolled ? "text-slate-600 hover:text-brand-teal" : "text-white/80 hover:text-white"}`}>Login</Link>
            <Link href="/register" className="px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-lg text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-brand-teal/20">Get Started</Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className={`lg:hidden p-2 ${scrolled ? "text-slate-700" : "text-white"}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenu ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="lg:hidden bg-white/98 backdrop-blur-lg border-t border-slate-100 mt-2 shadow-lg">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              {["problem|Why Onboard","features|Features","security|Security","pricing|Pricing","contact|Contact"].map(s => {
                const [id, label] = s.split("|");
                return <a key={id} href={`#${id}`} onClick={() => setMobileMenu(false)} className="text-slate-700 py-2 border-b border-slate-100">{label}</a>;
              })}
              <Link href="/login" onClick={() => setMobileMenu(false)} className="text-slate-700 py-2">Login</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO (dark, like bhalekar.ai) ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-20 bg-brand-navy">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-dark via-brand-navy to-brand-navy" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(14,116,144,0.1),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(8,145,178,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(8,145,178,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-teal/10 border border-brand-teal/30 rounded-full text-xs font-semibold uppercase tracking-widest text-brand-teal mb-8">
            <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
            A Bhalekar Product • Enterprise-Grade • ATO Compliant • SOC 2 Aligned
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 leading-[1.1] text-white">
            Your Secure{" "}
            <span className="text-brand-teal">Client Portal</span>
            <br className="hidden sm:block" />
            for Australian Accounting
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-3xl mx-auto leading-relaxed">
            Stop chasing clients for documents. A complete, enterprise-grade portal where your clients self-serve — register, submit TFN &amp; ABN, invite partners, purchase services, sign consents &amp; pay online.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-10 py-4 bg-brand-teal text-white font-bold rounded-lg text-base hover:bg-brand-teal-dark transition-all shadow-xl shadow-brand-teal/20 hover:scale-105">
              Start Free Demo
            </Link>
            <a href="#features" className="w-full sm:w-auto px-10 py-4 border-2 border-brand-teal/40 text-white font-semibold rounded-lg text-base hover:border-brand-teal hover:bg-brand-teal/10 transition-all">
              Explore Features
            </a>
          </div>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[{ n: "AES-256", t: "Encryption" }, { n: "100%", t: "ATO Ready" }, { n: "24/7", t: "Client Access" }, { n: "<$45", t: "Per Month" }].map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-brand-teal/40 transition-all">
                <div className="text-2xl font-display font-bold text-brand-teal">{s.n}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THE PROBLEM ===== */}
      <section id="problem" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">The Problem</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              Managing Client Data is{" "}
              <span className="text-brand-teal">Broken</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">As an Australian accounting practice, you deal with highly sensitive client data every day — TFN, ABN, financial records. Current methods are failing you.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((p, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-red-300 transition-all group">
                <div className="text-3xl mb-4">{p.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-slate-900 group-hover:text-red-500 transition-colors">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THE SOLUTION ===== */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">The Solution</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              Everything in{" "}
              <span className="text-brand-teal">One Place</span>
            </h2>
            <p className="text-slate-500 max-w-3xl mx-auto">A complete Client Portal and Practice Management Platform — built specifically for the Australian accounting industry. Fully secure. Fully automated.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center text-brand-teal text-lg">👤</div>
                <h3 className="text-xl font-bold text-slate-900">Your Clients Get</h3>
              </div>
              <div className="space-y-3">
                {["Register & verify identity in minutes", "Create Individual, Company, Trust & Partnership accounts", "Submit TFN, ABN & personal details via encrypted forms", "Invite directors, partners, trustees & spouses", "Partners accept & fill their own details", "Browse & purchase accounting services", "Pay securely via Stripe", "Sign legal consents with digital signatures", "Track service progress", "Raise support tickets if needed"].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-slate-600">{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center text-brand-teal text-lg">🏢</div>
                <h3 className="text-xl font-bold text-slate-900">Your Team Gets</h3>
              </div>
              <div className="space-y-3">
                {["Powerful admin dashboard with analytics", "Manage all clients & accounts from one place", "Track service purchases, payments & revenue", "Role-based access control (Super Admin, Admin, Manager, User)", "Full website CMS — update content without a developer", "Configure email, SMS & payment settings", "Handle support tickets with priority tracking"].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-slate-600">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CLIENT FEATURES ===== */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Client Experience</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              What Your Clients{" "}
              <span className="text-brand-teal">Experience</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientFeatures.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/40 transition-all group hover:-translate-y-1">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-slate-900 group-hover:text-brand-teal transition-colors">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ADMIN FEATURES ===== */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Admin Dashboard</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              Powerful{" "}
              <span className="text-brand-teal">Management Tools</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminFeatures.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/40 transition-all group hover:-translate-y-1">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-slate-900 group-hover:text-brand-teal transition-colors">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== KEY DIFFERENTIATORS ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Why Choose Onboard</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              Key{" "}
              <span className="text-brand-teal">Differentiators</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {differentiators.map((d, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/40 transition-all">
                <div className="text-3xl mb-4">{d.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-brand-teal">{d.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">End-to-End Flow</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              How It{" "}
              <span className="text-brand-teal">Works</span>
            </h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-brand-teal mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center text-sm">👤</span>
                Client Journey
              </h3>
              <div className="space-y-4">
                {["Register & verify email/phone", "Create account (Individual, Company, Trust, Partnership)", "Fill details — TFN, ABN, address, etc.", "Invite partners, directors, trustees, spouse", "Partners accept & fill their own details", "Browse & purchase accounting services", "Pay securely via Stripe", "Sign legal consents (digital signature)", "Track service progress", "Raise support tickets if needed"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center text-brand-teal text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-slate-600">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-brand-teal mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center text-sm">🏢</span>
                Admin Journey
              </h3>
              <div className="space-y-4">
                {["Login to admin dashboard", "Review dashboard overview & stats", "Review new account submissions", "Manage service purchases & track progress", "Track payments & revenue", "Reply to support tickets", "Update website content via CMS", "Manage users, roles & permissions", "Configure email, SMS & payment settings", "Generate reports & analytics"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center text-brand-teal text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-slate-600">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TECH STATS ===== */}
      <section ref={statsVis.ref} className="py-24 bg-brand-navy text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Platform Scale</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3">
              Built for{" "}
              <span className="text-brand-teal">Scale</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => {
              const count = useCountUp(s.value, s.dur, statsVis.inView);
              return (
                <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-4xl md:text-5xl font-display font-bold text-brand-teal tabular-nums">
                    {Math.floor(count)}{s.suffix}
                  </div>
                  <div className="text-xs text-white/50 uppercase tracking-widest mt-2">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SECURITY & COMPLIANCE ===== */}
      <section id="security" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Security & Compliance</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              Enterprise-Grade{" "}
              <span className="text-brand-teal">Security</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Your clients trust you with their most sensitive information. This portal treats that trust with the highest level of security.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {compliance.map((c, i) => (
              <div key={i} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/30 transition-all">
                <div className="inline-block px-3 py-1 bg-brand-teal/10 border border-brand-teal/30 rounded-full text-brand-teal text-xs font-bold mb-3">{c.badge}</div>
                <p className="text-sm text-slate-500">{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-6 text-slate-900">Technology Stack</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {techStack.map((t, i) => (
                <div key={i} className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-teal/30 transition-all">
                  <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                  <div className="text-[10px] text-brand-teal uppercase tracking-wider">{t.cat}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Running Costs</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4 text-slate-900">
              Incredibly{" "}
              <span className="text-brand-teal">Affordable</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">Compare ~$25–45/month total to hiring a developer ($8,000+/month) or buying off-the-shelf SaaS ($200–$500/month) that doesn't fit.</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 gap-0 p-4 bg-brand-teal/5 text-xs font-bold uppercase tracking-wider text-brand-teal border-b border-slate-200">
              <div>Service</div><div>Purpose</div><div className="text-right">Monthly (AUD)</div>
            </div>
            {costs.map((c, i) => (
              <div key={i} className="grid grid-cols-3 gap-0 p-4 border-t border-slate-100 text-sm">
                <div className="font-medium text-slate-800">{c.item}</div>
                <div className="text-slate-500">{c.detail}</div>
                <div className="text-right text-brand-teal font-semibold">{c.cost}</div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-0 p-4 border-t-2 border-brand-teal/30 bg-brand-teal/5">
              <div className="font-bold text-slate-900 col-span-2">TOTAL ESTIMATED</div>
              <div className="text-right text-brand-teal font-bold text-lg">~$25 – $45/mo</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Client Stories</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 text-slate-900">
              Trusted by{" "}
              <span className="text-brand-teal">Businesses</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/30 transition-all">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <span key={j} className="text-amber-400 text-sm">★</span>)}</div>
                <p className="text-sm text-slate-600 mb-6 italic leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full border border-brand-teal/30" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{t.name}</div>
                    <div className="text-xs text-brand-teal">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY THIS PLATFORM ===== */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Impact</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 text-slate-900">
              The Business{" "}
              <span className="text-brand-teal">Impact</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { b: "Save 20+ hrs/week", d: "Clients self-serve — no more chasing" },
              { b: "Zero paper", d: "Everything digital — forms, signatures, payments" },
              { b: "Military-grade security", d: "AES-256 encrypted — safer than a bank" },
              { b: "Get paid faster", d: "Online Stripe payments at purchase time" },
              { b: "Legal protection", d: "Digital consent with full audit trail" },
              { b: "Professional image", d: "Branded portal + website = trust & credibility" },
              { b: "Infinitely scalable", d: "10 clients or 10,000 — scales automatically" },
              { b: "No developer needed", d: "Settings, content, services — all from admin" },
              { b: "Australian-specific", d: "TFN, ABN, GST, trusts — built for AU day one" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/20 transition-all">
                <span className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal text-xs flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.b}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CUSTOM DEVELOPMENT ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-br from-brand-teal/5 via-slate-50 to-white border border-brand-teal/20 text-center shadow-sm">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal/10 border border-brand-teal/30 rounded-full text-xs font-bold uppercase tracking-widest text-brand-teal mb-6">
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              Fully Customisable
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 text-slate-900">
              Need Changes?{" "}
              <span className="text-brand-teal">We&apos;ll Build It.</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
              This platform is fully customisable to your exact requirements. Whether you need new features, workflow changes, additional integrations, or a completely tailored module — our engineering team at <a href="https://bhalekar.ai" target="_blank" rel="noopener noreferrer" className="text-brand-teal font-semibold hover:underline">Bhalekar Consulting</a> will deliver it.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { icon: "🔧", title: "Custom Features", desc: "New modules, workflows, reports tailored to your practice" },
                { icon: "🔗", title: "New Integrations", desc: "Connect with Xero, MYOB, QuickBooks, or any system" },
                { icon: "🎨", title: "White-Label Branding", desc: "Your logo, colours, domain — fully branded as yours" },
                { icon: "🚀", title: "Dedicated Support", desc: "Priority engineering support and ongoing maintenance" },
              ].map((item, i) => (
                <div key={i} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-teal/30 transition-all text-left">
                  <div className="text-2xl mb-3">{item.icon}</div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{item.title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm mb-6 italic">
              &ldquo;Your requirements are our priority. If you can imagine it, we can build it — and we&apos;ll integrate it seamlessly into your existing platform.&rdquo;
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="https://bhalekar.ai/contact" target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-brand-teal text-white font-bold rounded-lg text-sm uppercase tracking-wider hover:bg-brand-teal-dark transition-all shadow-lg shadow-brand-teal/20 hover:scale-105">
                Discuss Your Requirements
              </a>
              <a href="tel:1800434005" className="px-8 py-4 border-2 border-brand-teal/40 text-slate-700 font-semibold rounded-lg text-sm hover:border-brand-teal hover:bg-brand-teal/5 transition-all">
                Call 1800 434 005
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTACT / CTA ===== */}
      <section id="contact" className="py-24 bg-brand-navy text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-brand-teal text-xs font-semibold uppercase tracking-widest">Get Started</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold mt-3 mb-6">
                Transform Your Practice{" "}
                <span className="text-brand-teal">Today</span>
              </h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                This platform transforms your accounting practice from a paper-based operation into a modern, secure, digital-first business — giving your clients a premium experience while saving your team countless hours every week.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">📧</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Email</div>
                    <a href="mailto:info@bhalekar.com.au" className="text-sm text-brand-teal hover:underline">info@bhalekar.com.au</a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">📞</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Phone</div>
                    <a href="tel:1800434005" className="text-sm text-brand-teal hover:underline">1800 434 005</a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">📍</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Office</div>
                    <div className="text-sm text-white/80">Unit 207, 111 Overton Road</div>
                    <div className="text-sm text-white/80">Williams Landing, VIC 3027, Australia</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">🌐</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Website</div>
                    <a href="https://bhalekar.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-teal hover:underline">bhalekar.ai</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-brand-teal/20">
              <h3 className="text-xl font-bold mb-6">Request a Demo</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input name="firstName" required placeholder="First Name" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-brand-teal transition-colors placeholder:text-white/30" />
                  <input name="lastName" required placeholder="Last Name" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-brand-teal transition-colors placeholder:text-white/30" />
                </div>
                <input name="email" required type="email" placeholder="Business Email" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-brand-teal transition-colors placeholder:text-white/30" />
                <input name="phone" type="tel" placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-brand-teal transition-colors placeholder:text-white/30" />
                <select name="practiceSize" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/60 text-sm outline-none focus:border-brand-teal transition-colors">
                  <option value="">Practice Size</option>
                  <option value="Solo Practitioner">Solo Practitioner</option>
                  <option value="Small (2-5 staff)">Small (2-5 staff)</option>
                  <option value="Medium (6-20 staff)">Medium (6-20 staff)</option>
                  <option value="Large (20+ staff)">Large (20+ staff)</option>
                </select>
                <textarea name="message" rows={3} placeholder="Tell us about your practice..." className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-brand-teal transition-colors placeholder:text-white/30 resize-none" />
                <button type="submit" disabled={submitting} className="w-full bg-brand-teal text-white font-bold py-4 rounded-lg text-sm uppercase tracking-wider hover:bg-brand-teal-dark transition-all shadow-lg shadow-brand-teal/20 disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? "Sending..." : "Request Demo"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-10 mb-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center text-white font-bold text-lg">O</div>
                <div>
                  <span className="text-xl font-bold text-slate-900 block leading-tight">Onboard</span>
                  <span className="text-[10px] text-brand-teal uppercase tracking-widest font-medium">by Bhalekar Consulting</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed mt-3">
                Enterprise-grade client portal and practice management platform — built specifically for Australian accounting practices by <a href="https://bhalekar.ai" target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">Bhalekar Consulting</a>. SOC 2 aligned. AES-256 encrypted. ATO compliant.
              </p>
            </div>
            <div>
              <h4 className="text-brand-teal text-xs font-bold uppercase tracking-widest mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#problem" className="hover:text-brand-teal transition-colors">Why Onboard</a></li>
                <li><a href="#features" className="hover:text-brand-teal transition-colors">Features</a></li>
                <li><a href="#security" className="hover:text-brand-teal transition-colors">Security</a></li>
                <li><a href="#pricing" className="hover:text-brand-teal transition-colors">Pricing</a></li>
                <li><a href="https://bhalekar.ai" target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal transition-colors">Bhalekar Consulting</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-brand-teal text-xs font-bold uppercase tracking-widest mb-4">Contact</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><a href="tel:1800434005" className="hover:text-brand-teal transition-colors">1800 434 005</a></li>
                <li><a href="mailto:info@bhalekar.com.au" className="hover:text-brand-teal transition-colors">info@bhalekar.com.au</a></li>
                <li><span className="text-slate-700 block font-medium">Williams Landing</span>Unit 207, 111 Overton Rd, VIC 3027</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 uppercase tracking-wider">
            <div>©2026 Onboard — A Product of <a href="https://bhalekar.ai" target="_blank" rel="noopener noreferrer" className="text-brand-teal/70 hover:text-brand-teal">Bhalekar Pty Ltd</a></div>
            <div className="flex gap-6">
              <Link href="/p/privacy-policy" className="hover:text-brand-teal transition-colors">Privacy Policy</Link>
              <Link href="/p/terms-of-service" className="hover:text-brand-teal transition-colors">Terms of Service</Link>
              <Link href="/p/data-processing-agreement" className="hover:text-brand-teal transition-colors">DPA</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-white border border-brand-teal/50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
          <span className="text-sm text-slate-800">{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-brand-teal ml-3">✕</button>
        </div>
      )}
    </div>
  );
}
