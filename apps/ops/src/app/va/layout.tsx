import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import {
  Button,
  ShellBrand,
  TopbarNavItem,
  TopbarShell,
  VA_HUES,
} from '@xcrm/ui';

const VA_NAV = [
  { href: '/va', label: "Today's Batches", hue: VA_HUES.today, match: 'exact' as const },
  { href: '/va/batch', label: 'Current Batch', hue: VA_HUES.batch },
  { href: '/va/escalations', label: 'Escalations', hue: VA_HUES.escalations },
  { href: '/va/stats', label: 'My Stats', hue: VA_HUES.stats },
];

export default async function VALayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  const { role, name } = session.user;
  const isVA = role === 'VA_T1' || role === 'VA_T2' || role === 'VA_T3';
  if (!isVA) redirect('/console');

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <TopbarShell
      brand={<ShellBrand product={PRODUCT_NAME} subtitle={`${name} · ${role.toLowerCase()}`} />}
      nav={
        <>
          {VA_NAV.map((n) => (
            <TopbarNavItem
              key={n.href}
              href={n.href}
              label={n.label}
              hue={n.hue}
              match={n.match ?? 'prefix'}
            />
          ))}
        </>
      }
      actions={
        <form action={doSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      }
    >
      <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
    </TopbarShell>
  );
}
