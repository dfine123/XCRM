import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import {
  Button,
  NavItem,
  OPS_HUES,
  Shell,
  ShellBrand,
  ShellFooter,
  ShellNav,
  ShellSection,
} from '@xcrm/ui';

const NAV_PRIMARY = [
  { href: '/console', label: 'Dashboard', icon: 'D', hue: OPS_HUES.dashboard },
  // Literal hue 100 until Build B reshapes nav + formalizes OPS_HUES.
  { href: '/console/onboard', label: 'Onboard', icon: 'On', hue: 100 },
] as const;

const NAV_WORK = [
  { href: '/console/agencies', label: 'Agencies', icon: 'Ag', hue: OPS_HUES.agencies },
  { href: '/console/models', label: 'Models', icon: 'Md', hue: OPS_HUES.models },
  { href: '/console/accounts', label: 'Accounts', icon: 'Ac', hue: OPS_HUES.accounts },
  { href: '/console/camps', label: 'Camps', icon: 'Ca', hue: OPS_HUES.camps },
  { href: '/console/content', label: 'Content', icon: 'Co', hue: OPS_HUES.content },
  { href: '/console/formula', label: 'Formula', icon: 'Fo', hue: OPS_HUES.formula },
  {
    href: '/console/context-notes',
    label: 'Context Notes',
    icon: 'Ct',
    hue: OPS_HUES['context-notes'],
  },
  { href: '/console/insights', label: 'Insights', icon: 'In', hue: OPS_HUES.insights },
] as const;

const NAV_OPS = [
  { href: '/console/vas', label: 'VAs', icon: 'VA', hue: OPS_HUES.vas },
  { href: '/console/devices', label: 'Devices', icon: 'Dv', hue: OPS_HUES.devices },
  { href: '/console/settings', label: 'Settings', icon: 'St', hue: OPS_HUES.settings },
] as const;

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
    <Shell
      sidebar={
        <>
          <ShellBrand product={PRODUCT_NAME} subtitle={`${name} · ${role.toLowerCase()}`} />
          <ShellNav>
            <ShellSection>
              {NAV_PRIMARY.map((n) => (
                <NavItem key={n.href} href={n.href} label={n.label} icon={n.icon} hue={n.hue} match="exact" />
              ))}
            </ShellSection>
            <ShellSection label="Workspace">
              {NAV_WORK.map((n) => (
                <NavItem key={n.href} href={n.href} label={n.label} icon={n.icon} hue={n.hue} />
              ))}
            </ShellSection>
            <ShellSection label="Ops">
              {NAV_OPS.map((n) => (
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
