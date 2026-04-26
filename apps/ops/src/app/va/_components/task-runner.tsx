'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Tag } from '@xcrm/ui';
import type { BatchDetail, RunnerTask } from '../_loaders/batch-detail';
import { markTaskDone, skipTask } from '../actions';
import { EscalateForm } from './escalate-form';

/**
 * Fullscreen, keyboard-driven runner for a single batch. One task at
 * a time. Per `/docs/operational-model.md`: hours get spent here, so
 * the polish bar is highest. v1 builds the spine — Done / Escalate /
 * Skip with keyboard shortcuts.
 *
 * Renders `fixed inset-0` to overlay the topbar layout (rather than
 * routing into a separate layout group) — keeps the URL inside /va
 * but fills the viewport.
 *
 * Keyboard:
 *   D / Enter  done     E   escalate (opens reason form)
 *   S          skip     J / →   next         K / ←   previous
 *   Esc        exit to /va (or close escalate form if open)
 *
 * Skipped or escalated tasks remain visible in the runner so the VA
 * sees what they did with each one. Done tasks too. Navigation jumps
 * to the next PENDING task automatically after a resolution; once
 * none remain, a completion summary is shown.
 */
export function TaskRunner({ batch }: { batch: BatchDetail }) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      batch.tasks.findIndex((t) => t.status === 'PENDING'),
    ),
  );
  const [escalateOpen, setEscalateOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const total = batch.tasks.length;
  const remaining = batch.tasks.filter((t) => t.status === 'PENDING').length;
  const completed = batch.tasks.filter(
    (t) => t.status === 'COMPLETED',
  ).length;
  const escalated = batch.tasks.filter(
    (t) => t.status === 'ESCALATED',
  ).length;
  const skipped = batch.tasks.filter((t) => t.status === 'SKIPPED').length;

  const activeTask = batch.tasks[activeIndex];
  const allResolved = remaining === 0;

  const advance = useMemo(
    () => () => {
      // Find next PENDING after the current index.
      for (let i = activeIndex + 1; i < total; i++) {
        if (batch.tasks[i]!.status === 'PENDING') {
          setActiveIndex(i);
          return;
        }
      }
      // Wrap to find any earlier PENDING.
      for (let i = 0; i < activeIndex; i++) {
        if (batch.tasks[i]!.status === 'PENDING') {
          setActiveIndex(i);
          return;
        }
      }
      // No pending left — stay put.
    },
    [activeIndex, total, batch.tasks],
  );

  // Keyboard handler.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't fire when typing in an input.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (escalateOpen) {
          e.preventDefault();
          setEscalateOpen(false);
        } else {
          e.preventDefault();
          router.push('/va');
        }
        return;
      }

      if (allResolved || !activeTask) return;
      if (escalateOpen) return; // textarea owns input while open

      switch (e.key) {
        case 'd':
        case 'D':
        case 'Enter': {
          e.preventDefault();
          if (activeTask.status === 'PENDING') {
            const fd = new FormData();
            fd.set('id', activeTask.id);
            void markTaskDone(fd).then(() => router.refresh());
          }
          break;
        }
        case 'e':
        case 'E': {
          e.preventDefault();
          if (activeTask.status === 'PENDING') setEscalateOpen(true);
          break;
        }
        case 's':
        case 'S': {
          e.preventDefault();
          if (activeTask.status === 'PENDING') {
            const fd = new FormData();
            fd.set('id', activeTask.id);
            void skipTask(fd).then(() => router.refresh());
          }
          break;
        }
        case 'j':
        case 'J':
        case 'ArrowRight':
          e.preventDefault();
          setActiveIndex((i) => Math.min(total - 1, i + 1));
          break;
        case 'k':
        case 'K':
        case 'ArrowLeft':
          e.preventDefault();
          setActiveIndex((i) => Math.max(0, i - 1));
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTask, allResolved, escalateOpen, router, total]);

  // After server action completes, useFormState would let us close the
  // escalate form on success. We don't want client-side complexity here
  // for v1: the action revalidates the path, the next render reflects
  // ESCALATED status, and `escalateOpen` is reset by an effect that
  // watches the active task's status.
  useEffect(() => {
    if (activeTask && activeTask.status !== 'PENDING' && escalateOpen) {
      setEscalateOpen(false);
    }
  }, [activeTask, escalateOpen]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base">
      {/* Top progress strip */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface/60 px-6 py-3 backdrop-blur-sm">
        <Link
          href="/va"
          className="text-[12px] text-fg-dim hover:text-fg"
          title="Exit (Esc)"
        >
          ← Exit
        </Link>
        <div className="flex flex-1 items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">
            Batch · {batch.id.slice(-6)}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-fg-muted transition-all"
              style={{
                width: total === 0 ? '0%' : `${(completed / total) * 100}%`,
              }}
            />
          </div>
          <span className="tabular-nums text-[11px] text-fg-dim">
            {completed}/{total} done
            {skipped ? ` · ${skipped} skipped` : ''}
            {escalated ? ` · ${escalated} escalated` : ''}
          </span>
        </div>
      </header>

      {/* Body */}
      {allResolved ? (
        <CompletionScreen completed={completed} skipped={skipped} escalated={escalated} />
      ) : activeTask ? (
        <main className="grid flex-1 grid-cols-1 gap-6 overflow-auto px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left: asset preview + copy */}
          <section className="flex flex-col gap-4">
            <ActiveTaskCard task={activeTask} />
          </section>

          {/* Right: actions + nav */}
          <aside className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface/40 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Actions
              </h3>
              {activeTask.status !== 'PENDING' ? (
                <p className="text-[12px] text-fg-dim">
                  This task is{' '}
                  <span className="font-medium text-fg">
                    {activeTask.status.toLowerCase()}
                  </span>
                  . Use{' '}
                  <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">J</kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">K</kbd>{' '}
                  to navigate.
                </p>
              ) : (
                <>
                  <ActionButtons
                    taskId={activeTask.id}
                    onEscalateClick={() => setEscalateOpen(true)}
                    formRef={formRef}
                  />
                  <EscalateForm
                    taskId={activeTask.id}
                    open={escalateOpen}
                    onClose={() => setEscalateOpen(false)}
                  />
                </>
              )}
            </div>

            <NavStrip
              batch={batch}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
            />

            <div className="rounded-lg border border-line bg-surface/40 p-4 text-[11px] text-fg-faint">
              Keyboard:{' '}
              <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">D</kbd>{' '}
              done ·{' '}
              <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">E</kbd>{' '}
              escalate ·{' '}
              <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">S</kbd>{' '}
              skip ·{' '}
              <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">J</kbd>{' '}
              /{' '}
              <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">K</kbd>{' '}
              next/prev ·{' '}
              <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[10px]">Esc</kbd>{' '}
              exit
            </div>
          </aside>
        </main>
      ) : (
        <main className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-fg-faint">No tasks in this batch.</p>
        </main>
      )}
    </div>
  );
}

function ActiveTaskCard({ task }: { task: RunnerTask }) {
  const copy = task.payload.copy ?? '(no copy)';
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface/40 p-5">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-fg">
          {task.modelDisplayName}
        </span>
        <span className="text-fg-muted">·</span>
        <span className="font-mono text-[13px] text-fg">
          @{task.accountHandle}
        </span>
        {task.phoneDeviceLabel ? (
          <Tag hue={null} size="sm">
            {task.phoneDeviceLabel}
          </Tag>
        ) : null}
        {task.payload.scheduledFor ? (
          <span className="ml-auto text-[11px] text-fg-faint">
            scheduled{' '}
            {task.payload.scheduledFor.slice(0, 16).replace('T', ' ')} UTC
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {task.payload.assetId ? (
          <a
            href={`/api/drive/file/${task.payload.assetId}`}
            target="_blank"
            rel="noreferrer"
            title="Open the asset in a new tab — easier to AirDrop / save."
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/drive/file/${task.payload.assetId}`}
              alt=""
              className="h-[260px] w-full rounded-md border border-line object-cover"
            />
          </a>
        ) : (
          <div className="flex h-[260px] w-full items-center justify-center rounded-md border border-line bg-base text-[11px] uppercase tracking-[0.2em] text-fg-faint">
            no asset
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Copy ({copy.length} chars)
          </h3>
          <CopyBlock text={copy} />
        </div>
      </div>

      {task.escalationReason ? (
        <p className="text-[11px] text-destructive">
          Escalation reason: {task.escalationReason}
        </p>
      ) : null}
    </div>
  );
}

function CopyBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <pre className="whitespace-pre-wrap break-words rounded-md border border-line bg-bg/40 p-3 font-sans text-[14px] leading-relaxed text-fg">
        {text}
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore clipboard failures (Safari permission, http context, etc.)
        }
      }}
      className="self-start rounded-md border border-line px-2 py-1 text-[11px] text-fg-dim hover:border-fg-muted hover:text-fg"
    >
      {copied ? 'Copied ✓' : 'Copy text'}
    </button>
  );
}

function ActionButtons({
  taskId,
  onEscalateClick,
  formRef,
}: {
  taskId: string;
  onEscalateClick: () => void;
  formRef: React.RefObject<HTMLFormElement>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={markTaskDone} ref={formRef}>
        <input type="hidden" name="id" value={taskId} />
        <Button type="submit" size="sm" hue={135}>
          Done (D)
        </Button>
      </form>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onEscalateClick}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        Escalate (E)
      </Button>
      <form action={skipTask}>
        <input type="hidden" name="id" value={taskId} />
        <Button type="submit" size="sm" variant="ghost">
          Skip (S)
        </Button>
      </form>
    </div>
  );
}

function NavStrip({
  batch,
  activeIndex,
  setActiveIndex,
}: {
  batch: BatchDetail;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface/40 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
        Tasks
      </h3>
      <ol className="flex flex-col gap-1 text-[12px]">
        {batch.tasks.map((t, i) => {
          const isActive = i === activeIndex;
          const stateColor =
            t.status === 'COMPLETED'
              ? 'text-fg'
              : t.status === 'ESCALATED'
                ? 'text-destructive'
                : t.status === 'SKIPPED'
                  ? 'text-fg-faint'
                  : 'text-fg-dim';
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left ${
                  isActive ? 'bg-bg/60 text-fg' : 'hover:bg-bg/40'
                }`}
              >
                <span className={stateColor}>
                  {i + 1}. @{t.accountHandle}
                </span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-fg-faint">
                  {t.status.toLowerCase()}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CompletionScreen({
  completed,
  skipped,
  escalated,
}: {
  completed: number;
  skipped: number;
  escalated: number;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h2 className="text-[24px] font-semibold text-fg">Batch complete.</h2>
      <p className="text-[13px] text-fg-dim">
        {completed} done{skipped ? ` · ${skipped} skipped` : ''}
        {escalated ? ` · ${escalated} escalated` : ''}.
      </p>
      <div className="flex gap-2">
        <Link href="/va">
          <Button size="lg" hue={100}>
            Back to /va
          </Button>
        </Link>
      </div>
    </main>
  );
}
