import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@xcrm/db';
import {
  Button,
  Card,
  Field,
  OPS_HUES,
  PageHeader,
  Select,
  Tag,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@xcrm/ui';
import { StateMachines } from '@xcrm/shared';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { changeAccountStatus, updateAccountDevice } from '../actions';

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const account = await prisma.account.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      model: {
        select: {
          id: true,
          displayName: true,
          archetype: true,
          agency: { select: { id: true, name: true, slug: true } },
        },
      },
      phoneDevice: { select: { id: true, label: true, status: true } },
      statusTransitions: {
        orderBy: { occurredAt: 'desc' },
        take: 20,
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      campMemberships: {
        include: { camp: { select: { id: true, weekOf: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { posts: true } },
    },
  });
  if (!account) notFound();

  const [devices, recentPosts] = await Promise.all([
    prisma.phoneDevice.findMany({
      select: { id: true, label: true, status: true },
      orderBy: { label: 'asc' },
    }),
    prisma.post.findMany({
      where: { accountId: account.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, scheduledFor: true, postedAt: true, copy: true },
    }),
  ]);

  const validNextStates = StateMachines.ACCOUNT_STATUS_TRANSITIONS[account.status] ?? [];
  const isTerminal = validNextStates.length === 0;

  return (
    <>
      <PageHeader
        kicker={`ACCOUNT · ${account.model.agency.slug}`}
        title={`@${account.handle}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Tag hue={ACCOUNT_STATUS_HUE[account.status]} size="sm">
              {account.status.toLowerCase().replace(/_/g, ' ')}
            </Tag>
            <span className="text-fg-muted">·</span>
            <Link
              href={`/console/models/${account.model.id}`}
              className="text-fg-dim hover:text-fg"
            >
              {account.model.displayName}
            </Link>
            <span className="text-fg-muted">·</span>
            <span>{account.followerCount.toLocaleString()} followers</span>
          </span>
        }
        hue={OPS_HUES.accounts}
        icon="Ac"
        actions={
          <Link href="/console/accounts" className="text-[13px] text-fg-dim hover:text-fg">
            ← All accounts
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Recent posts
              </h2>
              <span className="text-[11px] text-fg-faint">{account._count.posts} total</span>
            </div>
            {recentPosts.length === 0 ? (
              <p className="mt-4 text-[13px] text-fg-faint">
                No posts yet. Scheduling lands in feature 3.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3 text-[13px]">
                {recentPosts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-4 border-b border-line/60 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="line-clamp-2 text-fg-dim">{p.copy}</span>
                    <Tag size="sm">{p.status.toLowerCase()}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Camp membership
            </h2>
            {account.campMemberships.length === 0 ? (
              <p className="mt-4 text-[13px] text-fg-faint">
                Not currently in any camp. Camp pairing lives in a later phase.
              </p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2 text-[13px]">
                {account.campMemberships.map((m) => (
                  <Tag key={m.id} size="sm">
                    Week of {m.camp.weekOf.toISOString().slice(0, 10)}
                  </Tag>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Followers over time
            </h2>
            <p className="mt-4 text-[13px] text-fg-faint">
              Snapshot chart lands once the cron that captures daily follower counts is wired.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Status history
            </h2>
            {account.statusTransitions.length === 0 ? (
              <p className="mt-4 text-[13px] text-fg-faint">
                No status changes yet — this account has been {account.status
                  .toLowerCase()
                  .replace(/_/g, ' ')}{' '}
                since creation.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>From → To</TH>
                    <TH>Actor</TH>
                    <TH>Reason</TH>
                  </TR>
                </THead>
                <TBody>
                  {account.statusTransitions.map((t) => (
                    <TR key={t.id}>
                      <TD className="text-fg-muted">
                        {t.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </TD>
                      <TD className="font-mono text-[12px]">
                        {t.fromStatus.toLowerCase()} → {t.toStatus.toLowerCase()}
                      </TD>
                      <TD className="text-fg-dim">
                        {t.actor.name ?? t.actor.email}
                      </TD>
                      <TD className="text-fg-dim">
                        {t.reason ? t.reason : <span className="text-fg-faint">—</span>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Change status
            </h3>
            {isTerminal ? (
              <p className="mt-3 text-[13px] text-fg-faint">
                {account.status} is a terminal state — no further transitions allowed.
              </p>
            ) : (
              <form action={changeAccountStatus} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="id" value={account.id} />
                <Field label="New status">
                  <Select name="toStatus" defaultValue={validNextStates[0]}>
                    {validNextStates.map((s) => (
                      <option key={s} value={s}>
                        {s.toLowerCase().replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reason (optional)">
                  <input
                    name="reason"
                    maxLength={500}
                    className="h-9 w-full rounded-md border border-line bg-base px-3 text-[13px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Why are you moving it?"
                  />
                </Field>
                <Button type="submit" size="sm" hue={OPS_HUES.accounts}>
                  Apply transition
                </Button>
              </form>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Phone device
            </h3>
            <form action={updateAccountDevice} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="id" value={account.id} />
              <Field label="Bound device">
                <Select
                  name="phoneDeviceId"
                  defaultValue={account.phoneDevice?.id ?? devices[0]?.id}
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} ({d.status.toLowerCase()})
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" size="sm" variant="ghost">
                Rebind
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Meta
            </h3>
            <dl className="mt-3 flex flex-col gap-2 text-[12px]">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Agency</dt>
                <dd>
                  <Link
                    href={`/console/agencies/${account.model.agency.id}`}
                    className="text-fg-dim hover:text-fg"
                  >
                    {account.model.agency.name}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Archetype</dt>
                <dd className="text-fg-dim">
                  {account.model.archetype.toLowerCase().replace(/_/g, ' ')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Status since</dt>
                <dd className="text-fg-dim">
                  {account.statusChangedAt.toISOString().slice(0, 10)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Created</dt>
                <dd className="text-fg-dim">
                  {account.createdAt.toISOString().slice(0, 10)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Peak hours</dt>
                <dd className="font-mono text-fg-dim">
                  {account.peakHours.length === 0
                    ? '—'
                    : account.peakHours.join(', ')}
                </dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
