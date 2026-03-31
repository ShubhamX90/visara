import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        clinical: {
          navy: "hsl(var(--clinical-navy))",
          teal: "hsl(var(--clinical-teal))",
          amber: "hsl(var(--clinical-amber))",
          orange: "hsl(var(--clinical-orange))",
          red: "hsl(var(--clinical-red))",
          green: "hsl(var(--clinical-green))",
          blue: "hsl(var(--clinical-blue))",
          cyan: "hsl(var(--clinical-cyan))"
        }
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(7, 11, 23, 0.22)",
        glow: "0 0 0 1px rgba(14,165,233,0.18), 0 24px 80px rgba(15,22,41,0.45)"
      },
      backgroundImage: {
        "clinical-grid":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "panel-gradient": "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(247,250,255,0.92))",
        "hero-glow": "radial-gradient(circle at top, rgba(14,165,233,0.22), transparent 55%)"
      }
    }
  },
  plugins: [animate]
} satisfies Config;

export default config;

