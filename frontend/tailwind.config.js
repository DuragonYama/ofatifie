/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "0 0% 7%",           // Dark background like Spotify
        foreground: "0 0% 95%",          // Light text
        card: "0 0% 10%",                // Card background
        "card-foreground": "0 0% 95%",
        primary: {
          DEFAULT: "0 65% 45%",          // Dark red (like #B93939)
          foreground: "0 0% 100%",
        },
        secondary: {
          DEFAULT: "0 0% 15%",
          foreground: "0 0% 95%",
        },
        muted: {
          DEFAULT: "0 0% 15%",
          foreground: "0 0% 60%",
        },
        accent: {
          DEFAULT: "0 65% 45%",          // Same dark red
          foreground: "0 0% 100%",
        },
        destructive: {
          DEFAULT: "0 84% 60%",
          foreground: "0 0% 98%",
        },
        border: "0 0% 20%",
        input: "0 0% 18%",
        ring: "0 65% 45%",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
}