import { cn } from '@xcrm/ui';
import { hue as hueFn, hueMuted } from '@xcrm/ui';
import type { OnboardStep } from '../_lib/resume';

const STEPS: { n: OnboardStep; label: string }[] = [
  { n: 1, label: 'Agency' },
  { n: 2, label: 'Model basics' },
  { n: 3, label: 'Accounts' },
  { n: 4, label: 'Drive folder' },
  { n: 5, label: 'Review & activate' },
];

const ACCENT = 100;

export function Stepper({ current }: { current: OnboardStep }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-[12px]">
      {STEPS.map((s, i) => {
        const state = s.n < current ? 'done' : s.n === current ? 'active' : 'upcoming';
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full border font-medium tabular-nums',
              )}
              style={
                state === 'active'
                  ? {
                      color: hueFn(ACCENT),
                      background: hueMuted(ACCENT),
                      borderColor: hueFn(ACCENT, 0.4),
                    }
                  : state === 'done'
                    ? { color: hueFn(ACCENT, 0.8), borderColor: hueFn(ACCENT, 0.3) }
                    : {}
              }
            >
              {state === 'done' ? '✓' : s.n}
            </span>
            <span
              className={cn(
                state === 'active' ? 'text-fg' : state === 'done' ? 'text-fg-dim' : 'text-fg-faint',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-1 text-fg-faint">›</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
