import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentSession, destroySession } from '@/lib/session';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import { Button } from '@xcrm/ui';

const NAV = [
  { href: '/overview', label: 'Overview' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/library', label: 'Content Library' },
  { href: '/requests', label: 'Content Requests' },
  { href: '/insights', label: 'Insights' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/login');

  async function doSignOut() {
    'use server';
    await destroySession();
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/40 p-4">
        <div className="mb-6">
          <p className="text-lg font-semibold">{PRODUCT_NAME}</p>
          <p className="text-xs text-muted-foreground">{session.name}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={doSignOut}>
          <Button type="submit" variant="ghost" size="sm" className="mt-4 w-full justify-start">
            Sign out
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
