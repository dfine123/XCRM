/**
 * Shared Tailwind preset — consumed by ops + portal.
 *
 * Tokens:
 *   - surface tiers: bg-base / bg-surface / bg-raised / bg-modal
 *   - foreground tiers: text-fg / text-fg-dim / text-fg-muted / text-fg-faint
 *   - lines: border-line / border-line-strong
 *   - depth: shadow-depth-flat / shadow-depth-raised / shadow-depth-modal
 *
 * Section hues are NOT here — they're parameters, not theme, passed
 * as inline styles via helpers in @xcrm/ui (see hues.ts).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        raised: 'rgb(var(--bg-raised) / <alpha-value>)',
        modal: 'rgb(var(--bg-modal) / <alpha-value>)',
        fg: {
          DEFAULT: 'rgb(var(--fg-default) / <alpha-value>)',
          dim: 'rgb(var(--fg-dim) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted) / <alpha-value>)',
          faint: 'rgb(var(--fg-faint) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },

        /* legacy aliases so existing shadcn-flavored markup keeps
           rendering during the reskin sweep */
        background: 'rgb(var(--bg-base) / <alpha-value>)',
        foreground: 'rgb(var(--fg-default) / <alpha-value>)',
        border: 'rgb(var(--border-default) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--bg-surface) / <alpha-value>)',
          foreground: 'rgb(var(--fg-dim) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--fg-default) / <alpha-value>)',
          foreground: 'rgb(var(--bg-base) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'oklch(72% 0.17 25)',
          foreground: 'rgb(var(--fg-default) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--bg-surface) / <alpha-value>)',
          foreground: 'rgb(var(--fg-default) / <alpha-value>)',
        },
      },
      boxShadow: {
        'depth-flat': 'inset 0 1px 0 rgba(255,255,255,0.04)',
        'depth-raised':
          'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.45)',
        'depth-modal':
          'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.8), 0 24px 48px rgba(0,0,0,0.6)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
