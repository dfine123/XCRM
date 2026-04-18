import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import { Button } from '@xcrm/ui';

const VA_NAV = [
  { href: '/va', label: "Today's Batches" },
  { href: '/va/batch', label: 'Current Batch' },
  { href: '/va/escalations', label: 'Escalations' },
  { href: '/va/stats', label: 'My Stats' },
];

export default async function VALayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  const isVA =
    session.user.role === 'VA_T1' ||
    session.user.role === 'VA_T2' ||
    session.user.role === 'VA_T3';
  if (!isVA) redirect('/console');

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">{PRODUCT_NAME}</span>
          <nav className="flex gap-4 text-sm">
            {VA_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{session.user.name}</span>
          <form action={doSignOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
