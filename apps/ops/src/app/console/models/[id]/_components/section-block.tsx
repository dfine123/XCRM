import type { ReactNode } from 'react';

/**
 * One anchor-navigable section on Surface 3. Renders a section header
 * with matching `id` for the `<AnchorNav>` links to target.
 */
export function SectionBlock({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-fg">
          {title}
        </h2>
        {subtitle ? (
          <span className="text-[11px] text-fg-faint">{subtitle}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
