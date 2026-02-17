import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Bhalekar-inspired palette — clean white + dark navy + teal accent
        "brand-navy": "#0f172a",
        "brand-dark": "#020617",
        "brand-teal": "#0891b2",
        "brand-teal-dark": "#0e7490",
        "brand-teal-light": "#cffafe",
        "brand-gray": "#f8fafc",
        "brand-border": "#e2e8f0",
        // Legacy aliases for transition
        "primary-navy": "#0f172a",
        "deep-navy": "#020617",
        "cyan-glow": "#0891b2",
        "accent-blue": "#0284c7",
        "clean-white": "#FFFFFF",
        "off-white": "#f8fafc",
        "ice-blue": "#ecfeff",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
