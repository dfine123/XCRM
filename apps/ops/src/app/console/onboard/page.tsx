import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma, Archetype, DriveSourceStatus } from '@xcrm/db';
import { Button, EmptyState, PageHeader, Tag } from '@xcrm/ui';
import { requireUser } from '@/lib/session';
import { computeResumeStep, type OnboardStep } from './_lib/resume';
import { Stepper } from './_components/stepper';
import { Step1Agency } from './_components/step-1-agency';
import { Step2Model } from './_components/step-2-model';
import { Step3Accounts } from './_components/step-3-accounts';
import { Step4Drive } from './_components/step-4-drive';
import { Step5Review } from './_components/step-5-review';
import { abandonOnboarding } from './actions';

const ACCENT = 100;

function clampStep(raw: unknown, min: OnboardStep, max: OnboardStep): OnboardStep {
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return Math.floor(n) as OnboardStep;
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: { modelId?: string; agencyId?: string; step?: string };
}) {
  await requireUser();

  // --- Resume path: modelId present ---------------------------------------
  if (searchParams.modelId) {
    const model = await prisma.model.findFirst({
      where: { id: searchParams.modelId, deletedAt: null },
      include: {
        agency: { select: { id: true, name: true, slug: true } },
        accounts: {
          where: { deletedAt: null },
          select: { id: true, handle: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        driveSources: {
          where: { status: DriveSourceStatus.ACTIVE },
          select: { id: true, folderName: true, folderId: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!model) notFound();
    if (model.onboardingCompletedAt) {
      redirect(`/console/models/${model.id}`);
    }

    const resumeStep = await computeResumeStep(model.id);
    const requested = searchParams.step ? clampStep(searchParams.step, 3, 5) : resumeStep;
    // Never skip ahead: cap at the computed resume step.
    const current = (Math.min(requested, resumeStep) as OnboardStep);

    const devices = await prisma.phoneDevice.findMany({
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });

    return (
      <>
        <PageHeader
          kicker={`ONBOARDING · ${model.displayName.toUpperCase()}`}
          title="Resume onboarding"
          subtitle="Finish the remaining steps. Each step saves as you go — you can close the tab and pick up where you left off."
          hue={ACCENT}
          icon="On"
          actions={
            <form action={abandonOnboarding}>
              <input type="hidden" name="modelId" value={model.id} />
              <Button type="submit" size="sm" variant="ghost">
                Abandon
              </Button>
            </form>
          }
        />
        <Stepper current={current} />

        {current === 3 ? (
          <Step3Accounts
            modelId={model.id}
            accounts={model.accounts}
            devices={devices}
          />
        ) : null}

        {current === 4 ? (
          <Step4Drive modelId={model.id} />
        ) : null}

        {current === 5 ? (
          <Step5Review
            data={{
              modelId: model.id,
              agency: { name: model.agency.name, slug: model.agency.slug },
              model: {
                displayName: model.displayName,
                realName: model.realName,
                archetype: model.archetype,
              },
              accounts: model.accounts,
              driveSources: model.driveSources,
            }}
          />
        ) : null}
      </>
    );
  }

  // --- Post-step-1 path: agencyId present ---------------------------------
  if (searchParams.agencyId) {
    const agency = await prisma.agency.findFirst({
      where: { id: searchParams.agencyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!agency) redirect('/console/onboard');

    return (
      <>
        <PageHeader
          kicker="ONBOARDING"
          title="New model"
          subtitle="Tell us who this model is. Display name is public-facing; real name stays internal."
          hue={ACCENT}
          icon="On"
        />
        <Stepper current={2} />
        <Step2Model
          agencyId={agency.id}
          agencyName={agency.name}
          archetypes={Object.values(Archetype)}
        />
      </>
    );
  }

  // --- Entry path: incomplete list + start-new ----------------------------
  const [incomplete, agencies] = await Promise.all([
    prisma.model.findMany({
      where: { onboardingCompletedAt: null, deletedAt: null },
      include: {
        agency: { select: { id: true, name: true } },
        _count: {
          select: {
            accounts: { where: { deletedAt: null } },
            driveSources: { where: { status: DriveSourceStatus.ACTIVE } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agency.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        kicker="ONBOARDING"
        title="Onboard a model"
        subtitle="Under ten minutes end-to-end: agency → model → accounts → Drive folder → activate. Saves as you go."
        hue={ACCENT}
        icon="On"
      />

      {incomplete.length > 0 ? (
        <section className="mb-6 rounded-lg border border-line bg-surface/40 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Resume ({incomplete.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {incomplete.map((m) => {
              const nextStep = m._count.accounts === 0 ? 3 : m._count.driveSources === 0 ? 4 : 5;
              const stepLabel =
                nextStep === 3 ? 'add accounts' : nextStep === 4 ? 'connect Drive' : 'review & activate';
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg/40 p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-fg">{m.displayName}</span>
                    <span className="text-[12px] text-fg-dim">
                      {m.agency.name} · started {formatRelative(m.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Tag hue={ACCENT} size="sm">
                      next: {stepLabel}
                    </Tag>
                    <Link href={`/console/onboard?modelId=${m.id}`}>
                      <Button size="sm" hue={ACCENT}>
                        Resume →
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-surface/40 p-4">
        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Start new
        </h3>
        <Stepper current={1} />
        {agencies.length === 0 && incomplete.length === 0 ? (
          <EmptyState
            hue={ACCENT}
            icon="On"
            title="First onboarding"
            description="Create the first agency inline below — no setup needed elsewhere."
          />
        ) : null}
        <Step1Agency agencies={agencies} />
      </section>
    </>
  );
}
