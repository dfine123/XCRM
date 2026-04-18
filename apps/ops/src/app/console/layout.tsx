import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import { Button } from '@xcrm/ui';

const NAV = [
  { href: '/console', label: 'Dashboard' },
  { href: '/console/agencies', label: 'Agencies' },
  { href: '/console/models', label: 'Models' },
  { href: '/console/accounts', label: 'Accounts' },
  { href: '/console/camps', label: 'Camps' },
  { href: '/console/content', label: 'Content' },
  { href: '/console/formula', label: 'Formula' },
  { href: '/console/context-notes', label: 'Context Notes' },
  { href: '/console/insights', label: 'Insights' },
  { href: '/console/vas', label: 'VAs' },
  { href: '/console/devices', label: 'Devices' },
  { href: '/console/settings', label: 'Settings' },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  const { role, name } = session.user;
  if (role !== 'FOUNDER' && role !== 'PARTNER') redirect('/va');

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r bg-muted/40 p-4">
        <div className="mb-6">
          <p className="text-lg font-semibold">{PRODUCT_NAME}</p>
          <p className="text-xs text-muted-foreground">
            {name} · {role.toLowerCase()}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
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
