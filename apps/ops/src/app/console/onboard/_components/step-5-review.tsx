import { Button, OPS_HUES, Tag } from '@xcrm/ui';
import { completeOnboarding } from '../actions';

type ReviewData = {
  modelId: string;
  agency: { name: string; slug: string };
  model: { displayName: string; realName: string; archetype: string };
  accounts: { id: string; handle: string; status: string }[];
  driveSources: { id: string; folderName: string; folderId: string }[];
};

export function Step5Review({ data }: { data: ReviewData }) {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <section className="rounded-lg border border-line bg-surface/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Agency
        </h4>
        <p className="mt-1.5 text-[13px] text-fg">
          {data.agency.name}{' '}
          <span className="text-fg-faint">({data.agency.slug})</span>
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Model
        </h4>
        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-fg">
          {data.model.displayName}
          <Tag hue={OPS_HUES.models} size="sm">
            {data.model.archetype.toLowerCase().replace(/_/g, ' ')}
          </Tag>
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Accounts ({data.accounts.length})
        </h4>
        <ul className="mt-1.5 flex flex-col gap-1 text-[13px]">
          {data.accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <span className="font-mono text-fg">@{a.handle}</span>
              <Tag hue={null} size="sm">
                {a.status.toLowerCase().replace(/_/g, ' ')}
              </Tag>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-surface/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Drive folders ({data.driveSources.length})
        </h4>
        <ul className="mt-1.5 flex flex-col gap-1 text-[13px]">
          {data.driveSources.map((s) => (
            <li key={s.id} className="flex flex-col">
              <span className="text-fg">{s.folderName}</span>
              <span className="font-mono text-[11px] text-fg-faint">{s.folderId}</span>
            </li>
          ))}
        </ul>
      </section>

      <form action={completeOnboarding} className="pt-2">
        <input type="hidden" name="modelId" value={data.modelId} />
        <Button type="submit" hue={OPS_HUES.models}>
          Activate model
        </Button>
      </form>
    </div>
  );
}
