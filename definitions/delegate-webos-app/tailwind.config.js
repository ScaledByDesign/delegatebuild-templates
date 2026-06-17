/** @type {import('tailwindcss').Config} */
// Delegate WebOS-native app tailwind config.
// - Colors are semantic tokens resolved from CSS custom properties (set in
//   src/index.css and overwritten live by the Delegate host theme bridge).
// - Font sizes use the `fs-*` scale (var(--fs-*)) which tracks --font-scale, so
//   the Delegate font customizer resizes the whole app. Do NOT use text-[Npx].
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        // WebOS font scale — the ONLY sizes WebOS apps should use.
        'fs-3xs': 'var(--fs-3xs)',
        'fs-2xs': 'var(--fs-2xs)',
        'fs-xs': 'var(--fs-xs)',
        'fs-sm': 'var(--fs-sm)',
        'fs-base': 'var(--fs-base)',
        'fs-md': 'var(--fs-md)',
        'fs-lg': 'var(--fs-lg)',
        'fs-xl': 'var(--fs-xl)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        'foreground-subtle': 'hsl(var(--foreground-subtle))',
        link: 'hsl(var(--link))',
        'surface-2': 'hsl(var(--surface-2))',
        'accent-tint': 'hsl(var(--accent-tint))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
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
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
