'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Input, Textarea, Select, OPS_HUES } from '@xcrm/ui';
import { Archetype } from '@xcrm/db';
import {
  createContextNote,
  type ContextNoteFormState,
} from '@/app/console/context-notes/actions';

type ScopeKind = 'ALL' | 'ARCHETYPES' | 'ACCOUNTS';
type DurationKey = 'TODAY' | 'THREE_DAYS' | 'ONE_WEEK' | 'UNTIL_REMOVED';

const DURATIONS: { key: DurationKey; label: string }[] = [
  { key: 'TODAY', label: 'Today' },
  { key: 'THREE_DAYS', label: '3 days' },
  { key: 'ONE_WEEK', label: '1 week' },
  { key: 'UNTIL_REMOVED', label: 'Until removed' },
];

const ARCHETYPES = Object.values(Archetype);

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES['context-notes']} disabled={pending}>
      {pending ? 'Saving…' : 'Save note'}
    </Button>
  );
}

/**
 * Create-a-context-note overlay. Rendered by the global `<NoteHotkey>`
 * mounted in the console layout, which toggles `open` on `N`.
 *
 * Accessibility notes:
 *   - ESC closes. Click outside closes. Explicit Cancel closes.
 *   - First input gets autoFocus so the operator types immediately.
 *   - Focus trap is intentionally omitted (MVP) — sequencing through
 *     the form fields with Tab reaches the buttons naturally.
 */
export function NoteOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action] = useFormState<ContextNoteFormState, FormData>(
    createContextNote,
    null,
  );
  const [scopeKind, setScopeKind] = useState<ScopeKind>('ALL');
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [accountHandles, setAccountHandles] = useState('');
  const [weight, setWeight] = useState(5);
  const [durationKey, setDurationKey] = useState<DurationKey>('THREE_DAYS');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset form state on open (including the wiped action state from a
  // previous submit cycle).
  useEffect(() => {
    if (!open) {
      setScopeKind('ALL');
      setArchetypes([]);
      setAccountHandles('');
      setWeight(5);
      setDurationKey('THREE_DAYS');
    }
  }, [open]);

  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Dismiss on successful save.
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  if (!open) return null;

  function toggleArchetype(a: Archetype) {
    setArchetypes((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-base/70 px-4 py-16 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-xl border border-line bg-bg shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-fg">
            New context note
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-fg-dim hover:text-fg"
          >
            Esc
          </button>
        </header>

        <form action={action} className="flex flex-col gap-4 px-5 py-4">
          <Field label="Title">
            <Input
              name="title"
              required
              maxLength={80}
              autoFocus
              placeholder="e.g. 'recreate-me format trending'"
            />
          </Field>

          <Field label="Body" hint="What the generator should take into account.">
            <Textarea
              name="body"
              required
              maxLength={2000}
              rows={4}
              placeholder="Free-form. The generator weighs this at draft time."
            />
          </Field>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] text-fg-dim">Scope</label>
            <input type="hidden" name="scopeKind" value={scopeKind} />
            <div className="flex flex-wrap gap-2 text-[13px]">
              {(['ALL', 'ARCHETYPES', 'ACCOUNTS'] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setScopeKind(k)}
                  className={`rounded-md border px-3 py-1.5 ${
                    scopeKind === k
                      ? 'border-fg-muted text-fg'
                      : 'border-line text-fg-dim hover:text-fg'
                  }`}
                >
                  {k === 'ALL'
                    ? 'All models'
                    : k === 'ARCHETYPES'
                      ? 'Archetypes'
                      : 'Accounts'}
                </button>
              ))}
            </div>
            {scopeKind === 'ARCHETYPES' ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ARCHETYPES.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => toggleArchetype(a)}
                    className={`rounded-md border px-2.5 py-1 text-[12px] ${
                      archetypes.includes(a)
                        ? 'border-fg-muted bg-surface/60 text-fg'
                        : 'border-line text-fg-dim hover:text-fg'
                    }`}
                  >
                    {a.toLowerCase().replace(/_/g, ' ')}
                  </button>
                ))}
                <input
                  type="hidden"
                  name="archetypes"
                  value={archetypes.join(',')}
                />
              </div>
            ) : null}
            {scopeKind === 'ACCOUNTS' ? (
              <Input
                name="accountHandles"
                value={accountHandles}
                onChange={(e) => setAccountHandles(e.target.value)}
                placeholder="@handle1, @handle2"
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] text-fg-dim">
              Weight —{' '}
              <span className="tabular-nums text-fg">{weight}</span>{' '}
              <span className="text-fg-faint">/ 10</span>
            </label>
            <input
              type="range"
              name="weight"
              min={1}
              max={10}
              step={1}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full accent-[oklch(72%_0.17_210)]"
            />
          </div>

          <Field label="Duration">
            <Select
              name="durationKey"
              value={durationKey}
              onChange={(e) => setDurationKey(e.target.value as DurationKey)}
            >
              {DURATIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>

          {state?.error ? (
            <p className="text-[13px] text-destructive">{state.error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <SubmitBtn />
          </div>
        </form>
      </div>
    </div>
  );
}
