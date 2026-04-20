import { redirect } from 'next/navigation';
import { currentSession, destroySession } from '@/lib/session';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import {
  Button,
  NavItem,
  PORTAL_HUES,
  Shell,
  ShellBrand,
  ShellFooter,
  ShellNav,
  ShellSection,
} from '@xcrm/ui';

const NAV_PRIMARY = [
  { href: '/overview', label: 'Overview', icon: 'Ov', hue: PORTAL_HUES.overview, match: 'exact' as const },
] as const;

const NAV_WORK = [
  { href: '/accounts', label: 'Accounts', icon: 'Ac', hue: PORTAL_HUES.accounts },
  { href: '/library', label: 'Content Library', icon: 'Lb', hue: PORTAL_HUES.library },
  { href: '/requests', label: 'Content Requests', icon: 'Rq', hue: PORTAL_HUES.requests },
  { href: '/insights', label: 'Insights', icon: 'In', hue: PORTAL_HUES.insights },
] as const;

const NAV_ACCOUNT = [
  { href: '/billing', label: 'Billing', icon: 'Bl', hue: PORTAL_HUES.billing },
  { href: '/settings', label: 'Settings', icon: 'St', hue: PORTAL_HUES.settings },
] as const;

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/login');

  async function doSignOut() {
    'use server';
    await destroySession();
    redirect('/login');
  }

  return (
    <Shell
      sidebar={
        <>
          <ShellBrand product={PRODUCT_NAME} subtitle={session.name} />
          <ShellNav>
            <ShellSection>
              {NAV_PRIMARY.map((n) => (
                <NavItem
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  icon={n.icon}
                  hue={n.hue}
                  match={n.match}
                />
              ))}
            </ShellSection>
            <ShellSection label="Workspace">
              {NAV_WORK.map((n) => (
                <NavItem key={n.href} href={n.href} label={n.label} icon={n.icon} hue={n.hue} />
              ))}
            </ShellSection>
            <ShellSection label="Account">
              {NAV_ACCOUNT.map((n) => (
                <NavItem key={n.href} href={n.href} label={n.label} icon={n.icon} hue={n.hue} />
              ))}
            </ShellSection>
          </ShellNav>
          <ShellFooter>
            <form action={doSignOut}>
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                Sign out
              </Button>
            </form>
          </ShellFooter>
        </>
      }
    >
      {children}
    </Shell>
  );
}
