import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "#03045e",
          700: "#0077b6",
          500: "#00b4d8",
          200: "#90e0ef",
          100: "#caf0f8",
        },
      },
    },
  },
  plugins: [],
}

export default config
