'use client';

import { useCallback, useEffect, useState } from 'react';
import { NoteOverlay } from './note-overlay';

/**
 * Global `N` hotkey mounted once in the console layout. Opens the
 * `<NoteOverlay>`. Guards:
 *   - Don't fire while typing in an input / textarea / contenteditable
 *     (so operators can type "n" in other forms).
 *   - Don't fire while the overlay is already open.
 *   - Don't fire while a modifier is held — `Cmd+N` (new window) and
 *     `Ctrl+N` should pass through to the browser.
 *
 * Per spec, the command palette (`Cmd+K`) stays deferred. One hotkey
 * covers the current vocabulary.
 */
export function NoteHotkey() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'n' && e.key !== 'N') return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (open) return;
      e.preventDefault();
      setOpen(true);
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return <NoteOverlay open={open} onClose={handleClose} />;
}
