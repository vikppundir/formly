"use client";

/**
 * Dynamic Page Renderer - Renders pages created in admin CMS
 * URL format: /p/[slug] e.g., /p/about, /p/services
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { notFound } from "next/navigation";

interface PageData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  metaTitle: string | null;
  metaKeywords: string | null;
  isPublished: boolean;
  showInNav: boolean;
  navOrder: number;
}

export default function DynamicPage({ params }: { params: { slug: string } }) {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function loadPage() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/public/pages/${params.slug}`
        );
        if (res.ok) {
          const data = await res.json();
          setPage(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load page:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#10172a] to-[#0b1120]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white dark:from-[#10172a] dark:to-[#0b1120]">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-[#10172a] dark:text-white mb-4">404</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-8">Page not found</p>
          <Link
            href="/"
            className="px-6 py-3 bg-[#0891b2] text-white rounded-lg font-semibold hover:bg-[#0891b2]/90 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-[#10172a]/95 backdrop-blur-md py-3 shadow-xl" : "bg-white dark:bg-[#10172a] py-4 shadow-md"}`}>
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
              O
            </div>
            <span className={`text-lg font-bold tracking-tight ${isScrolled ? "text-white" : "text-[#10172a] dark:text-white"}`}>
              ONBOARD
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/" className={`hidden sm:block text-sm font-semibold hover:text-[#0891b2] transition-colors ${isScrolled ? "text-white" : "text-[#10172a] dark:text-white"}`}>
              Home
            </Link>
            <Link href="/login" className={`hidden sm:block text-sm font-semibold hover:text-[#0891b2] transition-colors ${isScrolled ? "text-white" : "text-[#10172a] dark:text-white"}`}>
              Login
            </Link>
            <Link href="/register" className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#0891b2] hover:bg-[#0891b2]/90 text-white rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-lg shadow-[#0891b2]/30">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-slate-50 to-white dark:from-[#10172a] dark:to-[#0b1120]">
        <div className="container mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-[#10172a] dark:text-white mb-4">
            {page.title}
          </h1>
          {page.description && (
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl">
              {page.description}
            </p>
          )}
        </div>
      </section>

      {/* Page Content */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div
            className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-[#10172a] dark:prose-headings:text-white prose-a:text-[#0891b2] prose-strong:text-[#10172a] dark:prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 dark:border-[#0891b2]/20 bg-[#10172a] dark:bg-[#0b1120]">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold shadow-lg">O</div>
              <span className="text-lg font-bold text-white">ONBOARD</span>
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              ©2026 Onboard — All Rights Reserved
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
