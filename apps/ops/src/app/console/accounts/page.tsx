import Link from 'next/link';
import { prisma, AccountStatus, type Prisma } from '@xcrm/db';
import {
  Button,
  EmptyState,
  OPS_HUES,
  PageHeader,
  Tag,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';

function parseStatus(raw: string | string[] | undefined): AccountStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  return (Object.values(AccountStatus) as string[]).includes(raw)
    ? (raw as AccountStatus)
    : undefined;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: { status?: string; agencyId?: string };
}) {
  const status = parseStatus(searchParams?.status);
  const agencyId =
    typeof searchParams?.agencyId === 'string' && searchParams.agencyId
      ? searchParams.agencyId
      : undefined;

  const where: Prisma.AccountWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(agencyId ? { model: { agencyId } } : {}),
  };

  const [agencies, accounts] = await Promise.all([
    prisma.agency.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
    prisma.account.findMany({
      where,
      include: {
        model: {
          select: {
            id: true,
            displayName: true,
            agency: { select: { id: true, name: true, slug: true } },
          },
        },
        phoneDevice: { select: { id: true, label: true } },
      },
      orderBy: [{ status: 'asc' }, { handle: 'asc' }],
    }),
  ]);

  return (
    <>
      <PageHeader
        kicker="ACCOUNTS"
        title="Accounts"
        subtitle="Status state machine enforced server-side. Every change logs to the audit trail."
        hue={OPS_HUES.accounts}
        icon="Ac"
        actions={
          <Link href="/console/accounts/new">
            <Button size="sm" hue={OPS_HUES.accounts}>
              New account
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-[13px]">
        <form className="flex items-center gap-2">
          {agencyId ? <input type="hidden" name="agencyId" value={agencyId} /> : null}
          <label className="text-fg-muted">Status</label>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="h-8 rounded-md border border-line bg-base px-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All</option>
            {Object.values(AccountStatus).map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <label className="text-fg-muted">Agency</label>
          <select
            name="agencyId"
            defaultValue={agencyId ?? ''}
            className="h-8 rounded-md border border-line bg-base px-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="ghost">
            Filter
          </Button>
          {status || agencyId ? (
            <Link
              href="/console/accounts"
              className="text-[12px] text-fg-muted hover:text-fg"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.accounts}
          icon="Ac"
          title={status || agencyId ? 'No accounts match this filter' : 'No accounts yet'}
          description="Create an account to bind a handle to a model and a phone device."
          actions={
            <Link href="/console/accounts/new">
              <Button size="sm" hue={OPS_HUES.accounts}>
                New account
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Handle</TH>
              <TH>Model</TH>
              <TH>Agency</TH>
              <TH>Status</TH>
              <TH>Device</TH>
              <TH className="text-right tabular-nums">Followers</TH>
              <TH className="w-20 text-right">&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {accounts.map((a) => (
              <TR key={a.id}>
                <TD className="font-mono text-fg">@{a.handle}</TD>
                <TD>
                  <Link
                    href={`/console/models/${a.model.id}`}
                    className="text-fg-dim hover:text-fg"
                  >
                    {a.model.displayName}
                  </Link>
                </TD>
                <TD className="text-fg-muted">{a.model.agency.name}</TD>
                <TD>
                  <Tag hue={ACCOUNT_STATUS_HUE[a.status]} size="sm">
                    {a.status.toLowerCase().replace(/_/g, ' ')}
                  </Tag>
                </TD>
                <TD className="text-fg-dim">
                  {a.phoneDevice ? (
                    <Link
                      href={`/console/devices/${a.phoneDevice.id}`}
                      className="hover:text-fg"
                    >
                      {a.phoneDevice.label}
                    </Link>
                  ) : (
                    <span className="text-fg-faint">—</span>
                  )}
                </TD>
                <TD className="text-right tabular-nums">{a.followerCount.toLocaleString()}</TD>
                <TD className="text-right">
                  <Link
                    href={`/console/accounts/${a.id}`}
                    className="text-[13px] text-fg-dim hover:text-fg"
                  >
                    Open →
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
