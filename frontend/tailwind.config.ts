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
        // Brand Colors — Bhalekar-inspired palette
        "primary-navy": "#10172a",
        "accent-pink": "#4ec9fa",
        "clean-white": "#FFFFFF",
        "off-white": "#f8fcff",
        "dark-charcoal": "#091426",
        "slate-blue": "#8ba3c7",
        // Extended palette
        "deep-navy": "#0b1120",
        "card-dark": "rgba(9, 20, 38, 0.85)",
        "accent-blue": "#3498db",
        "ice-blue": "#eaf6ff",
        "cyan-glow": "#4ec9fa",
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
