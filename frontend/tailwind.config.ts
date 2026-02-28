import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mistral: {
          red: "#E10500",
          "orange-dark": "#FA500F",
          orange: "#FF8205",
          "orange-light": "#FFAF00",
          yellow: "#FFD800",
        },
        beige: {
          light: "#FFFAEB",
          medium: "#FFF0C3",
          dark: "#E9E2CB",
        },
        dark: {
          DEFAULT: "#000000",
          tinted: "#1E1E1E",
          surface: "#2A2A2A",
          border: "#3A3A3A",
        },
        samvad: {
          bg: "#FFFAEB",
          surface: "#FFF0C3",
          border: "#E9E2CB",
          accent: "#FF8205",
          "accent-hover": "#FA500F",
          text: "#000000",
          muted: "#1E1E1E",
          red: "#E10500",
          yellow: "#FFD800",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      borderRadius: {
        none: "0px",
        soft: "4px",
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 1s ease-in-out infinite",
        "block-blink": "block-blink 1s step-end infinite",
        "cursor-pulse": "cursor-pulse 1s step-end infinite",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "block-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "cursor-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
