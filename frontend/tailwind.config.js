/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        somnia: {
          purple: "#7B3FE4",
          blue:   "#3B82F6",
          dark:   "#0D0D1A",
          card:   "#13132A",
          border: "#2A2A4A",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
