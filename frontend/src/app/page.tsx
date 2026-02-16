"use client";

/**
 * Public Homepage — Formly Accounting Platform
 * Enterprise-grade client portal for Australian accounting practices
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
  const statsVis = useInView(0.3);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast("Thank you! We'll be in touch within one business day.");
    setTimeout(() => setToast(null), 4000);
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
    { name: "Sarah Mitchell", role: "CEO, TechStart Solutions", text: "Formly transformed our financial management. Their expertise saved us over $30,000 in the first year alone. Highly professional!", img: "https://i.pravatar.cc/150?img=47" },
    { name: "Michael Chen", role: "Property Investor", text: "Tax compliance was overwhelming. Formly simplified everything and helped me maximize deductions. Exceptional team!", img: "https://i.pravatar.cc/150?img=12" },
    { name: "Emma Thompson", role: "Small Business Owner", text: "The cloud accounting setup was seamless. I can focus on growing my business while Formly handles the rest.", img: "https://i.pravatar.cc/150?img=45" },
  ];

  return (
    <div className="min-h-screen bg-deep-navy text-white font-sans" suppressHydrationWarning>

      {/* ===== NAVBAR ===== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-primary-navy/95 backdrop-blur-md shadow-xl py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-glow to-accent-blue flex items-center justify-center text-primary-navy font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">F</div>
            <span className="text-xl font-bold tracking-tight text-white">Formly</span>
          </Link>
          <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-white/80">
            <a href="#problem" className="hover:text-cyan-glow transition-colors">Why Formly</a>
            <a href="#features" className="hover:text-cyan-glow transition-colors">Features</a>
            <a href="#security" className="hover:text-cyan-glow transition-colors">Security</a>
            <a href="#pricing" className="hover:text-cyan-glow transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-cyan-glow transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-white/80 hover:text-cyan-glow transition-colors">Login</Link>
            <Link href="/register" className="px-5 py-2.5 bg-cyan-glow hover:bg-cyan-glow/90 text-primary-navy rounded-lg text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-cyan-glow/20">Get Started</Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2 text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenu ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="lg:hidden bg-primary-navy/98 backdrop-blur-lg border-t border-cyan-glow/20 mt-2">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              {["problem|Why Formly","features|Features","security|Security","pricing|Pricing","contact|Contact"].map(s => {
                const [id, label] = s.split("|");
                return <a key={id} href={`#${id}`} onClick={() => setMobileMenu(false)} className="text-white py-2 border-b border-white/10">{label}</a>;
              })}
              <Link href="/login" onClick={() => setMobileMenu(false)} className="text-white py-2">Login</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-deep-navy via-primary-navy to-deep-navy" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(78,201,250,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(52,152,219,0.1),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(78,201,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(78,201,250,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-glow/10 border border-cyan-glow/30 rounded-full text-xs font-semibold uppercase tracking-widest text-cyan-glow mb-8">
            <span className="w-2 h-2 bg-cyan-glow rounded-full animate-pulse" />
            Enterprise-Grade • ATO Compliant • SOC 2 Aligned
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 leading-[1.1]">
            Your Secure{" "}
            <span className="text-cyan-glow">Client Portal</span>
            <br className="hidden sm:block" />
            for Australian Accounting
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-3xl mx-auto leading-relaxed">
            Stop chasing clients for documents. A complete, enterprise-grade portal where your clients self-serve — register, submit TFN &amp; ABN, invite partners, purchase services, sign consents &amp; pay online.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-10 py-4 bg-cyan-glow text-primary-navy font-bold rounded-lg text-base hover:bg-cyan-glow/90 transition-all shadow-xl shadow-cyan-glow/20 hover:scale-105">
              Start Free Demo
            </Link>
            <a href="#features" className="w-full sm:w-auto px-10 py-4 border-2 border-cyan-glow/40 text-white font-semibold rounded-lg text-base hover:border-cyan-glow hover:bg-cyan-glow/10 transition-all">
              Explore Features
            </a>
          </div>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[{ n: "AES-256", t: "Encryption" }, { n: "100%", t: "ATO Ready" }, { n: "24/7", t: "Client Access" }, { n: "<$45", t: "Per Month" }].map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-glow/40 transition-all">
                <div className="text-2xl font-display font-bold text-cyan-glow">{s.n}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THE PROBLEM ===== */}
      <section id="problem" className="py-24 bg-primary-navy relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">The Problem</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              Managing Client Data is{" "}
              <span className="text-cyan-glow">Broken</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">As an Australian accounting practice, you deal with highly sensitive client data every day — TFN, ABN, financial records. Current methods are failing you.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((p, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-red-400/40 transition-all group">
                <div className="text-3xl mb-4">{p.icon}</div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-red-400 transition-colors">{p.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THE SOLUTION ===== */}
      <section className="py-24 bg-deep-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(78,201,250,0.08),transparent_60%)]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">The Solution</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              Everything in{" "}
              <span className="text-cyan-glow">One Place</span>
            </h2>
            <p className="text-white/60 max-w-3xl mx-auto">A complete Client Portal and Practice Management Platform — built specifically for the Australian accounting industry. Fully secure. Fully automated.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="p-8 rounded-2xl bg-white/5 border border-cyan-glow/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-cyan-glow/20 flex items-center justify-center text-cyan-glow text-lg">👤</div>
                <h3 className="text-xl font-bold">Your Clients Get</h3>
              </div>
              <div className="space-y-3">
                {["Register & verify identity in minutes", "Create Individual, Company, Trust & Partnership accounts", "Submit TFN, ABN & personal details via encrypted forms", "Invite directors, partners, trustees & spouses", "Purchase services & pay online via Stripe", "Sign legal consents with digital signatures", "Raise support tickets directly"].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-cyan-glow/20 flex items-center justify-center text-cyan-glow text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-white/80">{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-cyan-glow/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-cyan-glow/20 flex items-center justify-center text-cyan-glow text-lg">🏢</div>
                <h3 className="text-xl font-bold">Your Team Gets</h3>
              </div>
              <div className="space-y-3">
                {["Powerful admin dashboard with analytics", "Manage all clients & accounts from one place", "Track service purchases, payments & revenue", "Role-based access control (Super Admin, Admin, Manager, User)", "Full website CMS — update content without a developer", "Configure email, SMS & payment settings", "Handle support tickets with priority tracking"].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-cyan-glow/20 flex items-center justify-center text-cyan-glow text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-white/80">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CLIENT FEATURES ===== */}
      <section id="features" className="py-24 bg-primary-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Client Experience</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              What Your Clients{" "}
              <span className="text-cyan-glow">Experience</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientFeatures.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-glow/40 transition-all group hover:-translate-y-1">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-cyan-glow transition-colors">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ADMIN FEATURES ===== */}
      <section className="py-24 bg-deep-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Admin Dashboard</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              Powerful{" "}
              <span className="text-cyan-glow">Management Tools</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminFeatures.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-glow/40 transition-all group hover:-translate-y-1">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-cyan-glow transition-colors">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== KEY DIFFERENTIATORS ===== */}
      <section className="py-24 bg-primary-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(78,201,250,0.08),transparent_60%)]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Why Choose Formly</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              Key{" "}
              <span className="text-cyan-glow">Differentiators</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {differentiators.map((d, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-cyan-glow/40 transition-all">
                <div className="text-3xl mb-4">{d.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-cyan-glow">{d.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 bg-deep-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">End-to-End Flow</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              How It{" "}
              <span className="text-cyan-glow">Works</span>
            </h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-white/5 border border-cyan-glow/20">
              <h3 className="text-lg font-bold text-cyan-glow mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-cyan-glow/20 flex items-center justify-center text-sm">👤</span>
                Client Journey
              </h3>
              <div className="space-y-4">
                {["Register & verify email/phone", "Create account (Individual, Company, Trust, Partnership)", "Fill details — TFN, ABN, address, etc.", "Invite partners, directors, trustees, spouse", "Partners accept & fill their own details", "Browse & purchase accounting services", "Pay securely via Stripe", "Sign legal consents (digital signature)", "Track service progress", "Raise support tickets if needed"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-cyan-glow/10 border border-cyan-glow/30 flex items-center justify-center text-cyan-glow text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-white/80">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-cyan-glow/20">
              <h3 className="text-lg font-bold text-cyan-glow mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-cyan-glow/20 flex items-center justify-center text-sm">🏢</span>
                Admin Journey
              </h3>
              <div className="space-y-4">
                {["Login to admin dashboard", "Review dashboard overview & stats", "Review new account submissions", "Manage service purchases & track progress", "Track payments & revenue", "Reply to support tickets", "Update website content via CMS", "Manage users, roles & permissions", "Configure email, SMS & payment settings", "Generate reports & analytics"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-cyan-glow/10 border border-cyan-glow/30 flex items-center justify-center text-cyan-glow text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-white/80">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TECH STATS ===== */}
      <section ref={statsVis.ref} className="py-24 bg-primary-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(78,201,250,0.1),transparent_50%)]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Platform Scale</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3">
              Built for{" "}
              <span className="text-cyan-glow">Scale</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => {
              const count = useCountUp(s.value, s.dur, statsVis.inView);
              return (
                <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-4xl md:text-5xl font-display font-bold text-cyan-glow tabular-nums">
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
      <section id="security" className="py-24 bg-deep-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Security & Compliance</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              Enterprise-Grade{" "}
              <span className="text-cyan-glow">Security</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">Your clients trust you with their most sensitive information. This portal treats that trust with the highest level of security.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {compliance.map((c, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-glow/30 transition-all">
                <div className="inline-block px-3 py-1 bg-cyan-glow/10 border border-cyan-glow/30 rounded-full text-cyan-glow text-xs font-bold mb-3">{c.badge}</div>
                <p className="text-sm text-white/60">{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-6 text-white/90">Technology Stack</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {techStack.map((t, i) => (
                <div key={i} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-glow/30 transition-all">
                  <div className="text-sm font-semibold text-white/90">{t.name}</div>
                  <div className="text-[10px] text-cyan-glow uppercase tracking-wider">{t.cat}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 bg-primary-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(78,201,250,0.06),transparent_50%)]" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Running Costs</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3 mb-4">
              Incredibly{" "}
              <span className="text-cyan-glow">Affordable</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">Compare ~$25–45/month total to hiring a developer ($8,000+/month) or buying off-the-shelf SaaS ($200–$500/month) that doesn't fit.</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-cyan-glow/20 overflow-hidden">
            <div className="grid grid-cols-3 gap-0 p-4 bg-cyan-glow/10 text-xs font-bold uppercase tracking-wider text-cyan-glow">
              <div>Service</div><div>Purpose</div><div className="text-right">Monthly (AUD)</div>
            </div>
            {costs.map((c, i) => (
              <div key={i} className="grid grid-cols-3 gap-0 p-4 border-t border-white/5 text-sm">
                <div className="font-medium text-white/90">{c.item}</div>
                <div className="text-white/50">{c.detail}</div>
                <div className="text-right text-cyan-glow font-semibold">{c.cost}</div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-0 p-4 border-t-2 border-cyan-glow/30 bg-cyan-glow/5">
              <div className="font-bold text-white col-span-2">TOTAL ESTIMATED</div>
              <div className="text-right text-cyan-glow font-bold text-lg">~$25 – $45/mo</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 bg-deep-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Client Stories</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3">
              Trusted by{" "}
              <span className="text-cyan-glow">Businesses</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-glow/30 transition-all">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-sm">★</span>)}</div>
                <p className="text-sm text-white/70 mb-6 italic leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full border border-cyan-glow/30" />
                  <div>
                    <div className="text-sm font-bold text-white">{t.name}</div>
                    <div className="text-xs text-cyan-glow">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY THIS PLATFORM ===== */}
      <section className="py-24 bg-primary-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Impact</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mt-3">
              The Business{" "}
              <span className="text-cyan-glow">Impact</span>
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
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-glow/20 transition-all">
                <span className="w-6 h-6 rounded-full bg-cyan-glow/20 flex items-center justify-center text-cyan-glow text-xs flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <div className="text-sm font-bold text-white">{item.b}</div>
                  <div className="text-xs text-white/50 mt-0.5">{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT / CTA ===== */}
      <section id="contact" className="py-24 bg-deep-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(78,201,250,0.1),transparent_50%)]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-cyan-glow text-xs font-semibold uppercase tracking-widest">Get Started</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold mt-3 mb-6">
                Transform Your Practice{" "}
                <span className="text-cyan-glow">Today</span>
              </h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                This platform transforms your accounting practice from a paper-based operation into a modern, secure, digital-first business — giving your clients a premium experience while saving your team countless hours every week.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">📧</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Email</div>
                    <a href="mailto:contact@formly.com.au" className="text-sm text-cyan-glow hover:underline">contact@formly.com.au</a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">📞</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Phone</div>
                    <a href="tel:1300367659" className="text-sm text-cyan-glow hover:underline">1300 FORMLY (1300 367 659)</a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg">📍</span>
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Locations</div>
                    <div className="text-sm text-white/80">Melbourne CBD — Level 12, 120 Collins St, VIC 3000</div>
                    <div className="text-sm text-white/80">Sydney CBD — Level 8, 50 Margaret St, NSW 2000</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-cyan-glow/20">
              <h3 className="text-xl font-bold mb-6">Request a Demo</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input required placeholder="First Name" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan-glow transition-colors placeholder:text-white/30" />
                  <input required placeholder="Last Name" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan-glow transition-colors placeholder:text-white/30" />
                </div>
                <input required type="email" placeholder="Business Email" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan-glow transition-colors placeholder:text-white/30" />
                <input type="tel" placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan-glow transition-colors placeholder:text-white/30" />
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/60 text-sm outline-none focus:border-cyan-glow transition-colors">
                  <option value="">Practice Size</option>
                  <option value="solo">Solo Practitioner</option>
                  <option value="small">Small (2-5 staff)</option>
                  <option value="medium">Medium (6-20 staff)</option>
                  <option value="large">Large (20+ staff)</option>
                </select>
                <textarea rows={3} placeholder="Tell us about your practice..." className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan-glow transition-colors placeholder:text-white/30 resize-none" />
                <button type="submit" className="w-full bg-cyan-glow text-primary-navy font-bold py-4 rounded-lg text-sm uppercase tracking-wider hover:bg-cyan-glow/90 transition-all shadow-lg shadow-cyan-glow/20">
                  Request Demo
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 border-t border-white/10 bg-primary-navy">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-10 mb-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-glow to-accent-blue flex items-center justify-center text-primary-navy font-bold text-lg">F</div>
                <span className="text-xl font-bold text-white">Formly</span>
              </div>
              <p className="text-sm text-white/50 max-w-md leading-relaxed">
                Enterprise-grade client portal and practice management platform — built specifically for Australian accounting practices. SOC 2 aligned. AES-256 encrypted. ATO compliant.
              </p>
            </div>
            <div>
              <h4 className="text-cyan-glow text-xs font-bold uppercase tracking-widest mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#problem" className="hover:text-cyan-glow transition-colors">Why Formly</a></li>
                <li><a href="#features" className="hover:text-cyan-glow transition-colors">Features</a></li>
                <li><a href="#security" className="hover:text-cyan-glow transition-colors">Security</a></li>
                <li><a href="#pricing" className="hover:text-cyan-glow transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-cyan-glow text-xs font-bold uppercase tracking-widest mb-4">Locations</h4>
              <ul className="space-y-3 text-sm text-white/50">
                <li><span className="text-white block font-medium">Melbourne CBD</span>Level 12, 120 Collins St, VIC 3000</li>
                <li><span className="text-white block font-medium">Sydney CBD</span>Level 8, 50 Margaret St, NSW 2000</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40 uppercase tracking-wider">
            <div>©2026 Formly — All Rights Reserved</div>
            <div className="flex gap-6">
              <Link href="/p/privacy-policy" className="hover:text-cyan-glow transition-colors">Privacy Policy</Link>
              <Link href="/p/terms-of-service" className="hover:text-cyan-glow transition-colors">Terms of Service</Link>
              <Link href="/p/data-processing-agreement" className="hover:text-cyan-glow transition-colors">DPA</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-primary-navy border border-cyan-glow/50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="w-2 h-2 bg-cyan-glow rounded-full animate-pulse" />
          <span className="text-sm text-white">{toast}</span>
          <button onClick={() => setToast(null)} className="text-white/40 hover:text-cyan-glow ml-3">✕</button>
        </div>
      )}
    </div>
  );
}
