import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#050816",
        panel: "#0f172a",
        panelSoft: "#111c34",
        line: "rgba(148, 163, 184, 0.18)",
        brand: "#38bdf8",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        text: "#e2e8f0",
        muted: "#94a3b8",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(2, 8, 23, 0.45)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top, rgba(56, 189, 248, 0.22), transparent 38%), radial-gradient(circle at 80% 10%, rgba(59, 130, 246, 0.14), transparent 26%)",
      },
    },
  },
  plugins: [],
};

export default config;
