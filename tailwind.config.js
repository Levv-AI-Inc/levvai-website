/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')
const defaults = require('tailwindcss/colors')

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/* Levv palette. Neutrals lean toward the navy of the wordmark; blue is the mark's mid tone. */
const levvInk = {
  50: '#f6f8fb',
  100: '#eef2f7',
  200: '#e0e6ef',
  300: '#c9d2df',
  400: '#95a1b5',
  500: '#616e84',
  600: '#465166',
  700: '#364157',
  800: '#232c42',
  900: '#131b35',
  950: '#0a1128',
}

const levvBlue = {
  50: '#eef4ff',
  100: '#dce7ff',
  200: '#c0d4ff',
  300: '#96b6fd',
  400: '#6692f8',
  500: '#3f72f1',
  600: '#2658e4',
  700: '#1e46c4',
  800: '#1f3c9c',
  900: '#1e357b',
  950: '#15214a',
}

/* Families whose values the brand replaces. `.levv-spec` restores Tailwind's own values for screens a spec pins
   (Flow Studio, runs, inbox), so their computed colours stay exactly as specified. */
const BRAND = { slate: levvInk, gray: levvInk, blue: levvBlue, cyan: levvBlue }

const triplet = (hex) => {
  const value = parseInt(hex.slice(1), 16)
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

const variables = (source) =>
  Object.fromEntries(
    Object.entries(source).flatMap(([family, scale]) =>
      STEPS.map((step) => [`--c-${family}-${step}`, triplet(scale[step])]),
    ),
  )

const varScale = (family) =>
  Object.fromEntries(STEPS.map((step) => [step, `rgb(var(--c-${family}-${step}) / <alpha-value>)`]))

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: varScale('slate'),
        gray: varScale('gray'),
        blue: varScale('blue'),
        cyan: varScale('cyan'),
        ink: levvInk,
        brand: levvBlue,
        nova: { 50: '#ecf8ff', 100: '#d3efff', 400: '#3fb6f7', 500: '#1a9de6', 600: '#0b7fc4', 700: '#0b659c' },
        // The shared Button's default and destructive variants (app/components/ui/button.tsx) read these.
        primary: { DEFAULT: levvInk[900], foreground: '#ffffff' },
        destructive: { DEFAULT: '#e11d48', foreground: '#ffffff' },
      },
      fontFamily: {
        // --font-app is the loaded Inter (--font-sans) on the landing page and Helvetica inside the signed-in app (globals.css).
        sans: ['var(--font-app)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
      },
      // Every corner reads a variable, so the app can run square while the landing page and spec-pinned screens keep theirs.
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      boxShadow: {
        sm: '0 1px 2px rgb(10 17 40 / 0.05)',
        DEFAULT: '0 1px 3px rgb(10 17 40 / 0.07), 0 1px 2px rgb(10 17 40 / 0.04)',
        md: '0 4px 12px -2px rgb(10 17 40 / 0.08), 0 2px 4px -2px rgb(10 17 40 / 0.05)',
        lg: '0 12px 28px -8px rgb(10 17 40 / 0.14), 0 2px 6px -2px rgb(10 17 40 / 0.06)',
        xl: '0 20px 44px -12px rgb(10 17 40 / 0.18), 0 4px 10px -4px rgb(10 17 40 / 0.06)',
        '2xl': '0 28px 64px -16px rgb(10 17 40 / 0.24)',
        pop: '0 16px 40px -12px rgb(10 17 40 / 0.22), 0 2px 6px -1px rgb(10 17 40 / 0.06)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    plugin(({ addBase }) => {
      addBase({
        ':root': {
          ...variables(BRAND),
          '--font-app': 'var(--font-sans)',
          '--radius-sm': '0.125rem',
          '--radius': '0.25rem',
          '--radius-md': '0.375rem',
          '--radius-lg': '0.5rem',
          '--radius-xl': '0.625rem',
          '--radius-2xl': '0.75rem',
          '--radius-3xl': '1rem',
        },
        '.levv-spec': {
          ...variables({ slate: defaults.slate, gray: defaults.gray, blue: defaults.blue, cyan: defaults.cyan }),
          '--font-app': 'var(--font-sans)',
          '--radius-sm': '0.125rem',
          '--radius': '0.25rem',
          '--radius-md': '0.375rem',
          '--radius-lg': '0.5rem',
          '--radius-xl': '0.75rem',
          '--radius-2xl': '1rem',
          '--radius-3xl': '1.5rem',
        },
      })
    }),
  ],
}
