/**
 * Palette sketch — standalone page. No global style changes yet;
 * everything here uses inline CSS custom properties so we can
 * iterate on hue + depth without touching the rest of the app.
 *
 * If this direction sticks, these tokens roll into the UI preset
 * and the ops/portal layouts get a dark shell.
 */

/* eslint-disable @next/next/no-img-element */

// All 10 domain hues: fixed L = 72%, fixed C = 0.17, only H rotates.
// That's what keeps them at "the same level" perceptually.
const SECTIONS = [
  { key: 'agencies', label: 'Agencies', hue: 250, icon: 'A' },
  { key: 'models', label: 'Models', hue: 290, icon: 'M' },
  { key: 'accounts', label: 'Accounts', hue: 25, icon: 'Ac' },
  { key: 'camps', label: 'Camps', hue: 60, icon: 'Ca' },
  { key: 'content', label: 'Content', hue: 135, icon: 'Co' },
  { key: 'formula', label: 'Formula', hue: 170, icon: 'F' },
  { key: 'notes', label: 'Context Notes', hue: 210, icon: 'N' },
  { key: 'insights', label: 'Insights', hue: 320, icon: 'I' },
  { key: 'vas', label: 'VAs', hue: 100, icon: 'V' },
  { key: 'devices', label: 'Devices', hue: 200, icon: 'D' },
] as const;

const hue = (h: number, alpha = 1) => `oklch(72% 0.17 ${h} / ${alpha})`;
const hueMuted = (h: number) => `oklch(72% 0.17 ${h} / 0.08)`;
const hueGlow = (h: number) => `oklch(72% 0.17 ${h} / 0.28)`;

// Three depth tiers — all live on a near-black base. Rim light on top +
// ambient drop below gives the "3D" feel without looking like neumorphism.
const DEPTH_FLAT = 'inset 0 1px 0 rgba(255,255,255,0.04)';
const DEPTH_RAISED =
  'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.45)';
const DEPTH_MODAL =
  'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.8), 0 24px 48px rgba(0,0,0,0.6)';

export default function StyleGuidePage() {
  return (
    <main
      className="min-h-screen font-sans"
      style={{
        background: '#0a0b0f',
        color: '#e5e7eb',
        backgroundImage:
          'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.05), transparent 60%), radial-gradient(1000px 500px at 90% 10%, rgba(236,72,153,0.04), transparent 60%)',
      }}
    >
      <div className="mx-auto max-w-[1200px] px-10 py-12">
        <header className="mb-12">
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-neutral-500">
            camp / style
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Palette sketch</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Equalized hues — every section color is{' '}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-[11px] text-neutral-300">
              oklch(72% 0.17 h)
            </code>{' '}
            with only the hue angle rotating, so none wins perceptually. Hue shows up as identity
            (icon, active nav, card accent strip, focus ring, tag) — never as a fill.
          </p>
        </header>

        {/* --- Hue set ------------------------------------------------- */}
        <Section title="1. The hue set" subtitle="10 section colors at the same lightness + chroma">
          <div className="grid grid-cols-5 gap-3">
            {SECTIONS.map((s) => (
              <div
                key={s.key}
                className="rounded-lg border border-neutral-800 p-4"
                style={{ background: '#14161c', boxShadow: DEPTH_FLAT }}
              >
                <div
                  className="mb-3 h-10 w-10 rounded-md text-sm font-semibold"
                  style={{
                    background: hueMuted(s.hue),
                    color: hue(s.hue),
                    border: `1px solid ${hue(s.hue, 0.3)}`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {s.icon}
                </div>
                <p className="text-sm font-medium text-neutral-200">{s.label}</p>
                <p className="mt-1 font-mono text-[10px] text-neutral-500">h = {s.hue}°</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- Depth tiers --------------------------------------------- */}
        <Section title="2. Depth tiers" subtitle="Three z-layers, all on a near-black base">
          <div className="grid grid-cols-3 gap-4">
            <DepthTile label="Flat surface" bg="#111218" shadow={DEPTH_FLAT} />
            <DepthTile label="Raised card" bg="#14161c" shadow={DEPTH_RAISED} />
            <DepthTile label="Modal / popover" bg="#1a1d26" shadow={DEPTH_MODAL} />
          </div>
        </Section>

        {/* --- Nav preview --------------------------------------------- */}
        <Section title="3. Nav — hue as active state" subtitle="Rest is neutral; hue marks domain + focus">
          <div className="grid grid-cols-[260px_1fr] gap-4">
            <nav
              className="rounded-xl border border-neutral-800 p-3"
              style={{ background: '#0f1117', boxShadow: DEPTH_RAISED }}
            >
              <div className="mb-4 px-3 pt-2">
                <p className="text-sm font-semibold text-white">camp</p>
                <p className="text-[11px] text-neutral-500">David · founder</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <NavRow label="Dashboard" />
                {SECTIONS.map((s, i) => (
                  <NavRow
                    key={s.key}
                    label={s.label}
                    hue={s.hue}
                    icon={s.icon}
                    active={i === 2 /* Accounts active as example */}
                  />
                ))}
                <NavRow label="Settings" />
              </div>
            </nav>
            <div
              className="rounded-xl border border-neutral-800 p-6"
              style={{ background: '#14161c', boxShadow: DEPTH_RAISED }}
            >
              <p className="text-[11px] uppercase tracking-widest text-neutral-500">
                Active: Accounts
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">1,284 accounts</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Active state uses a 2px left accent bar and a soft hue glow, no fill.
              </p>
            </div>
          </div>
        </Section>

        {/* --- Stat cards ---------------------------------------------- */}
        <Section title="4. Stat cards" subtitle="One hue per card via top accent strip + icon chip">
          <div className="grid grid-cols-4 gap-4">
            {SECTIONS.slice(0, 4).map((s) => (
              <StatCard key={s.key} section={s} value="1,284" delta="+12%" />
            ))}
          </div>
        </Section>

        {/* --- Buttons + focus ---------------------------------------- */}
        <Section title="5. Buttons & focus rings" subtitle="Focus ring always matches the section hue">
          <div className="flex flex-wrap gap-3">
            <NeutralButton>Neutral · default</NeutralButton>
            <NeutralButton focusHue={290}>Focus · Models hue</NeutralButton>
            <NeutralButton focusHue={60}>Focus · Camps hue</NeutralButton>
            <GhostButton>Ghost</GhostButton>
            <DangerButton>Destructive</DangerButton>
          </div>
        </Section>

        {/* --- Tag pills ----------------------------------------------- */}
        <Section title="6. Tag pills" subtitle="Rainbow-at-one-level — no hue dominates">
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <span
                key={s.key}
                className="rounded-full px-3 py-1 text-[11px] font-medium tracking-wide"
                style={{
                  color: hue(s.hue),
                  background: hueMuted(s.hue),
                  border: `1px solid ${hue(s.hue, 0.3)}`,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </Section>

        {/* --- Side-by-side: same card, every hue --------------------- */}
        <Section title="7. Equalization check" subtitle="Same card, every hue — nothing should pop more than its siblings">
          <div className="grid grid-cols-5 gap-3">
            {SECTIONS.map((s) => (
              <div
                key={s.key}
                className="relative overflow-hidden rounded-lg border border-neutral-800 p-4"
                style={{ background: '#14161c', boxShadow: DEPTH_RAISED }}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{ background: hue(s.hue) }}
                />
                <p
                  className="mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: hue(s.hue) }}
                >
                  {s.label}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-white">428</p>
                <p className="mt-1 text-[11px] text-neutral-500">last 24h</p>
              </div>
            ))}
          </div>
        </Section>

        <footer className="mt-16 border-t border-neutral-900 pt-6 text-xs text-neutral-600">
          If this reads right, next step is rolling the tokens into the shared UI preset and
          reskinning <code>/console</code> + <code>/va</code> + portal with the same rules.
        </footer>
      </div>
    </main>
  );
}

/* ---------- primitives ---------- */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DepthTile({ label, bg, shadow }: { label: string; bg: string; shadow: string }) {
  return (
    <div
      className="rounded-xl border border-neutral-800 p-8"
      style={{ background: bg, boxShadow: shadow }}
    >
      <p className="text-xs uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-2 text-sm text-neutral-300">Same base. Different shadow stack.</p>
    </div>
  );
}

function NavRow({
  label,
  hue: h,
  icon,
  active = false,
}: {
  label: string;
  hue?: number;
  icon?: string;
  active?: boolean;
}) {
  const tint = h !== undefined ? hue(h) : undefined;
  return (
    <div
      className="relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm"
      style={{
        color: active ? '#fff' : '#a3a3a3',
        background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
        boxShadow: active && tint ? `0 0 28px ${hueGlow(h!)}` : 'none',
      }}
    >
      {active && tint ? (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[2px] rounded-full"
          style={{ background: tint }}
        />
      ) : null}
      <span
        className="grid h-6 w-6 place-items-center rounded text-[10px] font-semibold"
        style={{
          background: h !== undefined ? hueMuted(h) : '#1c1f27',
          color: tint ?? '#737373',
          border: h !== undefined ? `1px solid ${hue(h, 0.25)}` : '1px solid #262a33',
        }}
      >
        {icon ?? '·'}
      </span>
      {label}
    </div>
  );
}

function StatCard({
  section,
  value,
  delta,
}: {
  section: (typeof SECTIONS)[number];
  value: string;
  delta: string;
}) {
  const h = section.hue;
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-neutral-800 p-5"
      style={{ background: '#14161c', boxShadow: DEPTH_RAISED }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: hue(h) }}
      />
      <div className="flex items-start justify-between">
        <div
          className="grid h-9 w-9 place-items-center rounded-md text-xs font-semibold"
          style={{
            background: hueMuted(h),
            color: hue(h),
            border: `1px solid ${hue(h, 0.3)}`,
          }}
        >
          {section.icon}
        </div>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ color: hue(h), background: hueMuted(h) }}
        >
          {delta}
        </span>
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {section.label}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function NeutralButton({
  children,
  focusHue,
}: {
  children: React.ReactNode;
  focusHue?: number;
}) {
  return (
    <button
      type="button"
      className="rounded-md border px-4 py-2 text-sm font-medium text-neutral-100 outline-none transition"
      style={{
        background: '#1c1f27',
        borderColor: '#2b2f3a',
        boxShadow: focusHue ? `0 0 0 2px ${hueGlow(focusHue)}` : DEPTH_FLAT,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-md px-4 py-2 text-sm font-medium text-neutral-400 transition hover:text-white"
    >
      {children}
    </button>
  );
}

function DangerButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-md border px-4 py-2 text-sm font-medium transition"
      style={{
        color: hue(25),
        background: hueMuted(25),
        borderColor: hue(25, 0.3),
      }}
    >
      {children}
    </button>
  );
}
