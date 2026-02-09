"use client";

/**
 * Public Homepage - Formly Accounting Platform
 * Shows hero with video background, about, services, testimonials, and contact sections
 */

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// Particles Component for Hero Background
function Particles() {
  const [particles, setParticles] = useState<Array<{
    id: number;
    left: number;
    top: number;
    delay: number;
    duration: number;
    size: number;
  }>>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 4,
        size: 2 + Math.random() * 4,
      }))
    );
  }, []);

  if (particles.length === 0) {
    return <div className="particles" suppressHydrationWarning />;
  }

  return (
    <div className="particles" suppressHydrationWarning>
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: `${p.size}px`,
            height: `${p.size}px`,
          }}
          suppressHydrationWarning
        />
      ))}
    </div>
  );
}

// Count-up animation hook
function useCountUp(targetValue: number, duration: number = 2000, isHovered: boolean) {
  const [count, setCount] = useState(targetValue);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHovered) {
      setCount(targetValue);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    setCount(0);
    const startTime = performance.now();
    startTimeRef.current = startTime;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(targetValue * easeOutQuart);
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(targetValue);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [targetValue, duration, isHovered]);

  return count;
}

// Stat Icon Component
function StatIcon({ type, className }: { type: string; className?: string }) {
  const iconClass = `w-12 h-12 ${className || ''}`;
  
  switch (type) {
    case 'clients':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'savings':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'grants':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'calls':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7292C21.7209 20.9842 21.5573 21.2131 21.3522 21.4012C21.1472 21.5894 20.9053 21.7326 20.6424 21.8217C20.3795 21.9108 20.1015 21.9437 19.8262 21.9182C16.7429 21.5851 13.787 20.5341 11.19 18.85C8.77382 17.3147 6.72533 15.2662 5.19 12.85C3.49997 10.2412 2.44824 7.27099 2.12 4.18C2.09453 3.90472 2.12739 3.62671 2.21649 3.36381C2.30559 3.1009 2.44879 2.85902 2.63696 2.654C2.82513 2.44899 3.05402 2.28538 3.30901 2.17379C3.564 2.06219 3.83972 2.00513 4.118 2.006H7.118C7.59395 1.99522 8.06706 2.16708 8.43371 2.49159C8.80036 2.8161 9.03526 3.27145 9.09 3.77C9.24337 5.00712 9.59233 6.21491 10.12 7.35C10.2604 7.67437 10.3091 8.03379 10.2603 8.38581C10.2115 8.73783 10.0674 9.06856 9.845 9.34L8.09 11.1C9.51429 13.4871 11.5029 15.4757 13.89 16.9L15.65 15.14C15.9214 14.9176 16.2521 14.7735 16.6041 14.7247C16.9561 14.6759 17.3156 14.7246 17.64 14.865C18.7751 15.3927 19.9829 15.7416 21.22 15.895C21.7186 15.9497 22.1739 16.1846 22.4984 16.5513C22.8229 16.918 22.9948 17.3911 22.984 17.867L22 16.92Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return null;
  }
}

// Stat Card Component
function StatCard({ stat, index }: { stat: any; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const count = useCountUp(stat.targetValue, stat.duration, isHovered);
  const displayValue = isHovered
    ? (stat.isDecimal ? count.toFixed(1) : Math.floor(count).toLocaleString())
    : (stat.isDecimal ? stat.targetValue.toFixed(1) : stat.targetValue.toLocaleString());

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative p-6 sm:p-8 bg-white dark:bg-primary-navy/40 rounded-3xl border-2 border-primary-navy/30 dark:border-primary-navy/50 shadow-xl hover:shadow-2xl transition-all duration-700 hover:scale-105 hover:-translate-y-3 backdrop-blur-sm overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary-navy/0 via-primary-navy/0 to-primary-navy/0 group-hover:from-primary-navy/10 group-hover:via-primary-navy/5 group-hover:to-transparent transition-all duration-700 rounded-3xl" />
      
      <div className="relative mb-4 sm:mb-6">
        <div className="absolute -top-2 -left-2 w-12 h-12 sm:w-16 sm:h-16 bg-accent-pink/10 dark:bg-accent-pink/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-accent-pink dark:text-accent-pink/80 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
          <StatIcon type={stat.icon} className="w-full h-full" />
        </div>
      </div>
      
      <div className="mb-3 sm:mb-4 relative z-10">
        <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-slate-900 dark:text-white group-hover:text-accent-pink transition-colors duration-500 tabular-nums flex items-baseline flex-wrap gap-1">
          {stat.prefix && (
            <span className="text-xl sm:text-2xl md:text-3xl text-primary-navy dark:text-slate-blue font-semibold leading-none">
              {stat.prefix}
            </span>
          )}
          <span className="inline-block min-w-0 flex-shrink-0">
            {displayValue}
          </span>
          {stat.suffix && (
            <span className="text-xl sm:text-2xl md:text-3xl text-primary-navy dark:text-slate-blue font-semibold leading-none">
              {stat.suffix}
            </span>
          )}
        </div>
      </div>
      
      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest relative z-10 group-hover:text-accent-pink transition-colors duration-500">
        {stat.label}
      </div>
      
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
      
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent-pink/0 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export default function PublicHomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActiveService(null);
    setToast("Thank you! Formly will contact you within one business day.");
    setTimeout(() => setToast(null), 4000);
  }

  const services = [
    { title: "Taxation Services", icon: "💼", desc: "GST/BAS, individual and business returns, and strategic year-end planning." },
    { title: "Bookkeeping & Payroll", icon: "📊", desc: "Day-to-day management and full superannuation compliance." },
    { title: "Business Advisory", icon: "💡", desc: "Understanding financial positioning to improve long-term profitability." },
    { title: "Startup & Company Setup", icon: "🚀", desc: "From business structure choice to registration and cloud accounting setup." },
    { title: "BAS & GST Compliance", icon: "📑", desc: "Accurate, on-time lodgements every quarter without the headaches." },
    { title: "Financial Reporting", icon: "📝", desc: "Clear, accurate reports including cash flow statements and P&L summaries." }
  ];

  const audienceSegments = [
    { label: 'Small to medium size business', benefit: 'Scale with structural confidence' },
    { label: 'Startup and New Business', benefit: 'From ABN setup to cloud automation' },
    { label: 'High-income individual', benefit: 'Optimize your wealth & tax position' },
    { label: 'Property investor', benefit: 'Manage yields, deductions & CGT' },
    { label: 'e-commerce, online and uber drivers', benefit: 'Specialized ride-share tax support' },
    { label: 'Sole Trader and contractor', benefit: 'Simple, effective BAS & Bookkeeping' }
  ];

  const statistics = [
    { targetValue: 6000, suffix: "+", label: "Happy Clients", icon: "clients", duration: 2000 },
    { targetValue: 25440, prefix: "$", label: "Average Savings", icon: "savings", duration: 2500 },
    { targetValue: 8.5, prefix: "$", suffix: "M", label: "Government Grants", icon: "grants", duration: 2000, isDecimal: true },
    { targetValue: 98.4, suffix: "%", label: "Calls responded in 24 hrs", icon: "calls", duration: 2000, isDecimal: true }
  ];

  const testimonials = [
    { name: "Sarah Mitchell", role: "CEO, TechStart Solutions", content: "Formly transformed our financial management. Their expertise saved us over $30,000 in the first year alone. Highly professional and always responsive!", rating: 5, image: "https://i.pravatar.cc/150?img=47" },
    { name: "Michael Chen", role: "Property Investor", content: "As a property investor, tax compliance was overwhelming. Formly simplified everything and helped me maximize deductions. Their team is exceptional!", rating: 5, image: "https://i.pravatar.cc/150?img=12" },
    { name: "Emma Thompson", role: "Small Business Owner", content: "The cloud accounting setup was seamless. I can now focus on growing my business while Formly handles all the financial complexities. Best decision ever!", rating: 5, image: "https://i.pravatar.cc/150?img=45" },
    { name: "David Rodriguez", role: "Freelance Consultant", content: "From BAS lodgements to tax optimization, Formly has been a game-changer. They're always available when I need them. 98.4% response rate is real!", rating: 5, image: "https://i.pravatar.cc/150?img=33" },
    { name: "Lisa Anderson", role: "E-commerce Entrepreneur", content: "Government grants assistance was outstanding. Formly helped us secure significant funding and navigate all compliance requirements. Truly grateful!", rating: 5, image: "https://i.pravatar.cc/150?img=20" },
    { name: "James Wilson", role: "Startup Founder", content: "Starting a business is stressful enough. Having Formly handle all financial aspects gave me peace of mind. Professional, efficient, and reliable.", rating: 5, image: "https://i.pravatar.cc/150?img=51" }
  ];

  return (
    <div className="min-h-screen transition-colors duration-500 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50 font-sans" suppressHydrationWarning>
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-primary-navy/95 backdrop-blur-md py-3 shadow-xl" : "bg-transparent py-4 sm:py-6"}`}>
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-accent-pink to-[#312966] flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
              F
            </div>
            <span className={`text-lg sm:text-xl font-bold tracking-tight ${isScrolled ? "text-white" : "text-primary-navy dark:text-white"}`}>
              Formly
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className={`hidden lg:flex items-center gap-8 text-sm font-semibold ${isScrolled ? "text-white" : "text-primary-navy dark:text-white"}`}>
            <a href="#about" className="hover:text-accent-pink transition-colors">About</a>
            <a href="#services" className="hover:text-accent-pink transition-colors">Services</a>
            <a href="#testimonials" className="hover:text-accent-pink transition-colors">Testimonials</a>
            <a href="#contact" className="hover:text-accent-pink transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className={`hidden sm:block text-sm font-semibold hover:text-accent-pink transition-colors ${isScrolled ? "text-white" : "text-primary-navy dark:text-white"}`}>
              Login
            </Link>
            <Link href="/register" className="px-4 sm:px-6 py-2 sm:py-2.5 bg-accent-pink hover:bg-accent-pink/90 text-white rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-lg shadow-accent-pink/30">
              Get Started
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${isScrolled ? "text-white" : "text-primary-navy dark:text-white"}`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-primary-navy/98 backdrop-blur-lg border-t border-accent-pink/20 mt-2">
            <div className="container mx-auto px-6 py-4 flex flex-col gap-3">
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="text-white py-2 border-b border-white/10">About</a>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} className="text-white py-2 border-b border-white/10">Services</a>
              <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="text-white py-2 border-b border-white/10">Testimonials</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="text-white py-2 border-b border-white/10">Contact</a>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-white py-2">Login</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section with Background Video */}
      <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden pt-24 pb-20">
        {/* Animated Background Layers */}
        <div className="absolute inset-0 z-0">
          {/* Background Video */}
          <video 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="w-full h-full object-cover z-0" 
            style={{ filter: 'brightness(1.3) contrast(1.2)' }}
          >
            <source src="/videos/hero-section-vdo.mp4" type="video/mp4" />
            <source src="https://assets.mixkit.co/videos/preview/mixkit-financial-data-on-a-digital-screen-22684-large.mp4" type="video/mp4" />
            <source src="https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_30fps.mp4" type="video/mp4" />
          </video>
          
          {/* Video Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-clean-white/50 via-clean-white/30 to-clean-white/60 dark:from-primary-navy/80 dark:via-primary-navy/70 dark:to-primary-navy/85 z-10" />
          <div className="absolute inset-0 bg-primary-navy/10 dark:bg-dark-charcoal/20 z-10" />
          <div className="absolute inset-0 bg-gradient-to-br from-accent-pink/5 via-transparent to-slate-blue/5 dark:from-accent-pink/3 dark:via-transparent dark:to-slate-blue/3 animate-gradient z-20" />
          
          {/* Particle Effects */}
          <Particles />
        </div>
        
        {/* Hero Content */}
        <div className="container mx-auto px-6 relative z-30 text-center max-w-5xl mt-20">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-off-white/90 dark:bg-primary-navy/90 backdrop-blur-sm rounded-full text-xs font-semibold uppercase tracking-wider text-primary-navy dark:text-clean-white mb-8 border border-accent-pink/30 shadow-lg animate-slide-up hover:scale-105 transition-transform cursor-default">
            <span className="w-2 h-2 bg-accent-pink rounded-full animate-pulse" />
            <span>ATO Compliance • Australia Wide</span>
            <span className="w-2 h-2 bg-accent-pink rounded-full animate-pulse" />
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-8 tracking-tight leading-[1.1] text-primary-navy dark:text-clean-white animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Protect.{' '}
            <span className="text-accent-pink">Optimise.</span>{' '}
            Grow.
          </h1>

          <p className="text-lg md:text-xl lg:text-2xl text-dark-charcoal dark:text-slate-300 mb-12 font-normal max-w-3xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Smart, simple, and reliable accounting solutions that help you focus on what matters —{' '}
            <span className="font-semibold text-primary-navy dark:text-accent-pink">growing your business.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Link 
              href="/register"
              className="group relative w-full sm:w-auto px-12 py-5 bg-accent-pink hover:bg-accent-pink/90 text-clean-white font-bold rounded-lg text-lg transition-all shadow-xl shadow-accent-pink/30 hover:shadow-accent-pink/50 transform hover:scale-105 overflow-hidden"
            >
              <span className="relative z-10">Get Started</span>
              <div className="absolute inset-0 bg-white/20 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </Link>
            <a 
              href="#services"
              className="group w-full sm:w-auto px-12 py-5 bg-clean-white dark:bg-primary-navy border-2 border-primary-navy dark:border-accent-pink text-primary-navy dark:text-clean-white font-semibold rounded-lg text-lg hover:bg-off-white dark:hover:bg-primary-navy/80 transition-all transform hover:scale-105 shadow-lg"
            >
              Our Services
            </a>
          </div>
          
          {/* Scroll Indicator */}
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-float">
            <div className="w-6 h-10 border-2 border-accent-pink/50 rounded-full flex justify-center p-2">
              <div className="w-1 h-3 bg-accent-pink rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-off-white dark:bg-dark-charcoal relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-pink/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-blue/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <span className="inline-flex items-center gap-2 text-accent-pink font-semibold uppercase tracking-wider text-xs mb-4">
                <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-pulse" />
                About Formly
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-primary-navy dark:text-clean-white leading-[1.1]">
                We don't just prepare accounts.{' '}
                <span className="text-accent-pink">We protect your business.</span>
              </h2>
              <p className="text-dark-charcoal dark:text-slate-300 text-base leading-relaxed mb-6">
                At Formly, we believe accounting isn't just about numbers — it's about building confidence in your financial decisions. Based in Victoria, our team provides end-to-end accounting and tax services tailored for individuals and SMEs across Australia.
              </p>
              <p className="text-dark-charcoal/70 dark:text-slate-400 leading-relaxed mb-8 text-sm">
                We combine modern cloud accounting tools with practical business insights to simplify your finances, ensure compliance, and help you plan ahead with clarity and confidence.
              </p>
              <div className="group p-6 bg-clean-white dark:bg-primary-navy/50 border-l-4 border-accent-pink rounded-lg shadow-md hover:shadow-lg transition-all">
                <span className="text-accent-pink font-bold text-lg">"</span>
                <span className="text-dark-charcoal dark:text-slate-300 italic text-sm ml-2">
                  We optimise your tax position, and keep you compliant—so you can grow with confidence.
                </span>
                <span className="text-accent-pink font-bold text-lg">"</span>
              </div>
            </div>
            <div className="lg:w-1/2 grid grid-cols-2 gap-4">
              {[
                { n: '100%', t: 'ATO Ready', icon: '✓', image: '/images/ato-ready.jpg' },
                { n: '24h', t: 'Support', icon: '⚡', image: '/images/support.jpg' },
                { n: 'Secure', t: 'Data Vault', icon: '🔒', image: '/images/data-vault.jpg' },
                { n: 'VIC', t: 'Victoria Base', icon: '📍', image: '/images/victoria-base.jpg' }
              ].map((s, i) => (
                <div 
                  key={i} 
                  className="group aspect-square bg-clean-white dark:bg-primary-navy/30 rounded-xl p-6 flex flex-col justify-end shadow-lg border border-slate-blue/20 dark:border-slate-blue/10 hover:border-accent-pink/50 hover:scale-105 transition-all cursor-default relative overflow-hidden"
                >
                  <div className="absolute inset-0 z-0">
                    <img 
                      src={s.image} 
                      alt={s.t}
                      className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-primary-navy/5 group-hover:bg-primary-navy/10 transition-all rounded-xl" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="absolute top-3 right-3 text-xl opacity-30 group-hover:opacity-50 transition-opacity z-20">{s.icon}</div>
                    <div className="text-3xl font-display font-bold text-primary-navy dark:text-clean-white mb-2 group-hover:text-accent-pink transition-colors">
                      {s.n}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-dark-charcoal/70 dark:text-slate-400">
                      {s.t}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-24 bg-gradient-to-b from-slate-50 via-off-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(229,9,127,0.08),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(229,9,127,0.1),transparent_50%)]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-pink/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-slate-blue/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-accent-pink font-semibold uppercase tracking-wider text-xs mb-4">
              <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-pulse" />
              By The Numbers
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 text-primary-navy dark:text-clean-white">
              Proven <span className="text-accent-pink">Results</span> That Speak
            </h2>
            <p className="text-dark-charcoal/70 dark:text-slate-300 max-w-2xl mx-auto text-sm leading-relaxed">
              Delivering exceptional results and measurable value to businesses across Australia
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-7xl mx-auto">
            {statistics.map((stat, index) => (
              <StatCard key={index} stat={stat} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-20 bg-clean-white dark:bg-dark-charcoal relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="inline-block text-accent-pink font-semibold uppercase tracking-wider text-xs mb-4">
              Our Expertise
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 text-primary-navy dark:text-clean-white">
              Expert <span className="text-accent-pink">Solutions</span>
            </h2>
            <p className="text-dark-charcoal/70 dark:text-slate-400 max-w-2xl mx-auto text-sm">
              "Built to meet ATO / IRD / GST requirements from day one"
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, idx) => (
              <div 
                key={idx} 
                className="group relative p-8 bg-off-white dark:bg-primary-navy/30 rounded-xl border border-slate-blue/20 dark:border-slate-blue/10 hover:border-accent-pink/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
              >
                <div className="text-4xl mb-6 transform group-hover:scale-110 transition-transform duration-300">
                  {s.icon}
                </div>
                <h3 className="text-xl font-display font-bold mb-3 text-primary-navy dark:text-clean-white group-hover:text-accent-pink transition-colors">
                  {s.title}
                </h3>
                <p className="text-dark-charcoal/70 dark:text-slate-400 text-sm leading-relaxed mb-6">
                  {s.desc}
                </p>
                <button 
                  onClick={() => setActiveService(s.title)}
                  className="w-full py-3 bg-primary-navy dark:bg-accent-pink hover:bg-accent-pink dark:hover:bg-accent-pink/90 text-clean-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shadow-md hover:shadow-lg"
                >
                  Start Application
                </button>
                <div className="absolute top-0 right-0 w-16 h-16 bg-accent-pink/0 group-hover:bg-accent-pink/5 rounded-bl-xl transition-all" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Help Section */}
      <section className="py-20 bg-off-white dark:bg-primary-navy/20 relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="inline-block text-accent-pink font-semibold uppercase tracking-wider text-xs mb-4">
              Target Audience
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 text-primary-navy dark:text-clean-white">
              Built for <span className="text-accent-pink">You</span>
            </h2>
            <p className="text-dark-charcoal/70 dark:text-slate-400 max-w-2xl mx-auto text-sm">
              Specialised accounting for every Australian business segment.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {audienceSegments.map((item, i) => (
              <div 
                key={i} 
                className="group relative p-6 bg-clean-white dark:bg-primary-navy/30 border border-slate-blue/20 dark:border-slate-blue/10 rounded-lg hover:border-accent-pink/50 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-1 h-6 bg-accent-pink rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  <h4 className="font-display font-bold text-primary-navy dark:text-clean-white group-hover:text-accent-pink transition-colors text-sm">
                    {item.label}
                  </h4>
                </div>
                <p className="text-xs text-dark-charcoal/70 dark:text-slate-400 font-medium italic ml-4">
                  "{item.benefit}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership & Onboarding */}
      <section id="contact" className="py-20 bg-clean-white dark:bg-dark-charcoal relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-3">
              <div className="bg-off-white dark:bg-primary-navy/30 p-10 rounded-xl border border-slate-blue/20 shadow-xl hover:border-accent-pink/30 transition-all">
                <div className="flex items-center gap-3 mb-8">
                  <span className="w-1 h-8 bg-accent-pink rounded-full" />
                  <h3 className="text-3xl font-display font-bold text-primary-navy dark:text-clean-white">
                    Get Started
                  </h3>
                </div>
                <form onSubmit={handleFormSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <input 
                      required 
                      placeholder="First Name" 
                      className="w-full bg-clean-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-5 py-4 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink focus:ring-2 focus:ring-accent-pink/20 transition-all placeholder:text-dark-charcoal/50 dark:placeholder:text-slate-blue" 
                    />
                    <input 
                      required 
                      placeholder="Last Name" 
                      className="w-full bg-clean-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-5 py-4 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink focus:ring-2 focus:ring-accent-pink/20 transition-all placeholder:text-dark-charcoal/50 dark:placeholder:text-slate-blue" 
                    />
                  </div>
                  <input 
                    required 
                    type="email" 
                    placeholder="Business Email" 
                    className="w-full bg-clean-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-5 py-4 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink focus:ring-2 focus:ring-accent-pink/20 transition-all placeholder:text-dark-charcoal/50 dark:placeholder:text-slate-blue" 
                  />
                  <textarea 
                    rows={4} 
                    placeholder="Initial Requirements" 
                    className="w-full bg-clean-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-5 py-4 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink focus:ring-2 focus:ring-accent-pink/20 transition-all placeholder:text-dark-charcoal/50 dark:placeholder:text-slate-blue resize-none" 
                  />
                  <button 
                    type="submit" 
                    className="w-full bg-accent-pink hover:bg-accent-pink/90 text-clean-white font-bold py-5 rounded-lg text-base transition-all shadow-lg hover:shadow-xl hover:shadow-accent-pink/30 uppercase tracking-wider"
                  >
                    Start Onboarding
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col gap-8">
              <div className="bg-off-white dark:bg-primary-navy/30 p-8 rounded-xl border border-slate-blue/20 shadow-xl hover:border-accent-pink/30 transition-all group">
                <div className="relative w-20 h-20 rounded-xl bg-primary-navy dark:bg-accent-pink/20 mb-6 overflow-hidden border-2 border-accent-pink/30 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full bg-gradient-to-br from-primary-navy to-accent-pink flex items-center justify-center text-white text-2xl font-bold">F</div>
                </div>
                <h4 className="text-xl font-display font-bold text-primary-navy dark:text-clean-white group-hover:text-accent-pink transition-colors">
                  Formly Team
                </h4>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-pink mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-accent-pink rounded-full animate-pulse" />
                  Leadership, Formly
                </p>
                <p className="text-dark-charcoal/70 dark:text-slate-400 text-sm leading-relaxed italic mb-6 border-l-4 border-accent-pink pl-4">
                  "At Formly, we believe accounting isn't just about numbers — it's about building confidence in your financial decisions."
                </p>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-clean-white dark:bg-primary-navy/50 hover:bg-accent-pink/10 transition-all">
                  <div className="p-3 bg-accent-pink/10 rounded-lg text-lg">🔒</div>
                  <div>
                    <div className="text-xs font-semibold text-primary-navy dark:text-clean-white uppercase">SOC 2 Compliant</div>
                    <div className="text-xs font-medium text-dark-charcoal/70 dark:text-slate-400">AES-256 ENCRYPTED • RBAC SECURED</div>
                  </div>
                </div>
              </div>
              <div className="p-8 bg-accent-pink/5 rounded-xl border border-accent-pink/20 shadow-sm hover:border-accent-pink/40 transition-all">
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-1 h-6 bg-accent-pink rounded-full" />
                  <h4 className="font-bold text-primary-navy dark:text-clean-white text-sm">Compliance Tracking</h4>
                </div>
                <div className="space-y-3">
                  {['BAS Reporting', 'Tax Lodgement', 'Superannuation'].map((t, i) => (
                    <div 
                      key={i} 
                      className="flex justify-between items-center p-3 rounded-lg hover:bg-clean-white/50 dark:hover:bg-primary-navy/30 transition-all group/item"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-dark-charcoal/70 dark:text-slate-400 group-hover/item:text-accent-pink transition-colors">
                        {t}
                      </span>
                      <span className="px-3 py-1 bg-accent-pink/20 text-accent-pink text-xs font-semibold rounded-full border border-accent-pink/30">
                        Automated
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gradient-to-b from-off-white via-clean-white to-off-white dark:from-slate-950 dark:via-primary-navy dark:to-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-pink/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-slate-blue/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-pink/5 rounded-full blur-3xl" />
        </div>

        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(229,9,127,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(229,9,127,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-accent-pink font-semibold uppercase tracking-wider text-xs mb-4">
              <span className="w-2 h-2 bg-accent-pink rounded-full animate-pulse" />
              Client Success Stories
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 text-primary-navy dark:text-white">
              What Our <span className="text-accent-pink">Clients</span> Say
            </h2>
            <p className="text-dark-charcoal/70 dark:text-slate-300 max-w-2xl mx-auto text-sm">
              Real feedback from businesses and individuals who trust Formly
            </p>
          </div>

          {/* Main Testimonial Display */}
          <div className="max-w-5xl mx-auto mb-12">
            <div 
              className={`relative bg-gradient-to-br from-white/80 to-white/60 dark:from-white/10 dark:to-white/5 backdrop-blur-xl rounded-3xl border border-primary-navy/20 dark:border-white/20 p-8 md:p-12 shadow-2xl transition-all duration-500 ${
                isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}
              style={{
                boxShadow: '0 20px 60px rgba(229,9,127,0.2), inset 0 1px 0 rgba(49,41,102,0.1)'
              }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-accent-pink via-slate-blue to-accent-pink rounded-3xl blur opacity-20 dark:opacity-30 animate-pulse" />
              
              <div className="relative z-10">
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                    <span key={i} className="text-2xl text-yellow-400 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                      ⭐
                    </span>
                  ))}
                </div>

                <div className="absolute top-8 right-8 text-6xl text-accent-pink/20 font-serif">"</div>

                <p className="text-lg md:text-xl text-primary-navy/90 dark:text-white/90 mb-8 leading-relaxed italic relative z-10">
                  {testimonials[currentTestimonial].content}
                </p>

                <div className="flex items-center gap-4 pt-6 border-t border-primary-navy/10 dark:border-white/10">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-accent-pink/50 ring-4 ring-accent-pink/20">
                      <img 
                        src={testimonials[currentTestimonial].image} 
                        alt={testimonials[currentTestimonial].name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-white/20" />
                  </div>
                  <div>
                    <h4 className="text-primary-navy dark:text-white font-bold text-lg">
                      {testimonials[currentTestimonial].name}
                    </h4>
                    <p className="text-accent-pink text-sm font-medium">
                      {testimonials[currentTestimonial].role}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                onClick={() => {
                  setIsAnimating(true);
                  setTimeout(() => {
                    setCurrentTestimonial(index);
                    setIsAnimating(false);
                  }, 300);
                }}
                className={`group relative bg-gradient-to-br from-white/70 to-white/50 dark:from-white/5 dark:to-white/0 backdrop-blur-lg rounded-2xl border border-primary-navy/20 dark:border-white/10 p-6 cursor-pointer transition-all duration-300 hover:border-accent-pink/50 hover:scale-105 hover:shadow-xl ${
                  currentTestimonial === index ? 'border-accent-pink/50 ring-2 ring-accent-pink/30' : ''
                }`}
              >
                <div className="absolute inset-0 bg-accent-pink/0 group-hover:bg-accent-pink/5 rounded-2xl transition-all duration-300" />
                
                <div className="relative z-10">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-sm text-yellow-400">⭐</span>
                    ))}
                  </div>

                  <p className="text-sm text-primary-navy/70 dark:text-white/70 mb-4 line-clamp-3 italic">
                    {testimonial.content}
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-accent-pink/30">
                      <img 
                        src={testimonial.image} 
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h5 className="text-primary-navy dark:text-white text-sm font-semibold">
                        {testimonial.name}
                      </h5>
                      <p className="text-accent-pink/80 text-xs">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Dots */}
          <div className="flex justify-center gap-2 mt-12">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsAnimating(true);
                  setTimeout(() => {
                    setCurrentTestimonial(index);
                    setIsAnimating(false);
                  }, 300);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentTestimonial === index 
                    ? 'w-8 bg-accent-pink' 
                    : 'bg-primary-navy/30 dark:bg-white/30 hover:bg-primary-navy/50 dark:hover:bg-white/50'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-slate-blue/20 bg-primary-navy dark:bg-dark-charcoal relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-4 gap-12 mb-12">
            <div className="lg:col-span-2">
              <div className="mb-6 flex items-center gap-3 group cursor-default">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-accent-pink to-[#312966] flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform">
                  F
                </div>
                <span className="text-xl sm:text-2xl font-bold text-clean-white tracking-tight">
                  Formly
                </span>
              </div>
              <p className="text-slate-blue max-w-md text-sm leading-relaxed mb-8 italic border-l-4 border-accent-pink pl-4">
                "Built to protect your business, optimise your tax position, and keep you compliant—so you can grow with confidence."
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent-pink/10 transition-all group/item">
                  <div className="w-8 h-8 rounded-lg bg-accent-pink/20 flex items-center justify-center text-base group-hover/item:scale-110 transition-transform flex-shrink-0">
                    📧
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-blue mb-1">Email</div>
                    <a href="mailto:contact@formly.com.au" className="text-sm text-clean-white hover:text-accent-pink transition-colors break-all">
                      contact@formly.com.au
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent-pink/10 transition-all group/item">
                  <div className="w-8 h-8 rounded-lg bg-accent-pink/20 flex items-center justify-center text-base group-hover/item:scale-110 transition-transform flex-shrink-0">
                    📞
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-blue mb-1">Phone</div>
                    <div className="space-y-1">
                      <a href="tel:1300367659" className="block text-sm text-clean-white hover:text-accent-pink transition-colors">
                        1300 FORMLY (1300 367 659)
                      </a>
                      <a href="tel:+61390001234" className="block text-sm text-clean-white hover:text-accent-pink transition-colors">
                        +61 3 9000 1234
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-wider text-xs text-accent-pink mb-6 flex items-center gap-2">
                <span className="w-1 h-4 bg-accent-pink rounded-full" />
                Quick Links
              </h4>
              <ul className="space-y-3 text-xs text-slate-blue font-medium">
                <li><a href="#services" className="hover:text-accent-pink transition-colors">Services</a></li>
                <li><a href="#about" className="hover:text-accent-pink transition-colors">About Us</a></li>
                <li><a href="#testimonials" className="hover:text-accent-pink transition-colors">Testimonials</a></li>
                <li><a href="#contact" className="hover:text-accent-pink transition-colors">Get Started</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-wider text-xs text-accent-pink mb-6 flex items-center gap-2">
                <span className="w-1 h-4 bg-accent-pink rounded-full" />
                Locations
              </h4>
              <ul className="space-y-4 text-xs font-medium text-slate-blue">
                {[
                  { name: 'Melbourne CBD', address: 'Level 12, 120 Collins St, VIC 3000' },
                  { name: 'Sydney CBD', address: 'Level 8, 50 Margaret St, NSW 2000' }
                ].map((loc, i) => (
                  <li key={i} className="group">
                    <span className="text-clean-white block mb-1 group-hover:text-accent-pink transition-colors font-semibold">
                      {loc.name}
                    </span>
                    <span className="text-slate-blue">
                      {loc.address}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-blue/20 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-blue font-medium uppercase tracking-wider">
            <div className="hover:text-accent-pink transition-colors cursor-default">
              ©2026 FORMLY — ALL RIGHTS RESERVED
            </div>
            <div className="flex gap-8">
              <button className="hover:text-accent-pink transition-colors relative group">
                Privacy Charter
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-pink group-hover:w-full transition-all" />
              </button>
              <button className="hover:text-accent-pink transition-colors relative group">
                Security Terms
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-pink group-hover:w-full transition-all" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Service Inquiry Modal */}
      {activeService && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-primary-navy/80 backdrop-blur-md" onClick={() => setActiveService(null)} />
          <div className="relative w-full max-w-xl bg-clean-white dark:bg-primary-navy p-8 rounded-xl border-2 border-accent-pink/30 shadow-2xl">
            <button onClick={() => setActiveService(null)} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-dark-charcoal dark:text-slate-blue hover:text-accent-pink rounded-lg transition-all text-xl">✕</button>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1 h-6 bg-accent-pink rounded-full" />
              <h3 className="text-2xl font-display font-bold text-primary-navy dark:text-clean-white">
                Inquiry: <span className="text-accent-pink">{activeService}</span>
              </h3>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input required placeholder="First Name" className="w-full bg-off-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-4 py-3 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink transition-all" />
                <input required placeholder="Last Name" className="w-full bg-off-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-4 py-3 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink transition-all" />
              </div>
              <input required type="email" placeholder="Business Email" className="w-full bg-off-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-4 py-3 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink transition-all" />
              <input required type="tel" placeholder="Mobile Number" className="w-full bg-off-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-4 py-3 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink transition-all" />
              <textarea required rows={4} placeholder="Tell us more about your requirements..." className="w-full bg-off-white dark:bg-primary-navy/50 border-2 border-slate-blue/20 dark:border-slate-blue/10 rounded-lg px-4 py-3 text-dark-charcoal dark:text-clean-white outline-none focus:border-accent-pink transition-all resize-none" />
              <button type="submit" className="w-full bg-accent-pink hover:bg-accent-pink/90 text-clean-white font-bold py-4 rounded-lg transition-all shadow-lg uppercase tracking-wider text-sm">
                Submit Inquiry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-[100] bg-clean-white dark:bg-primary-navy border-2 border-accent-pink/50 px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3">
          <span className="w-2 h-2 bg-accent-pink rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary-navy dark:text-clean-white">{toast}</span>
          <button onClick={() => setToast(null)} className="text-dark-charcoal/50 hover:text-accent-pink ml-4">✕</button>
        </div>
      )}
    </div>
  );
}
