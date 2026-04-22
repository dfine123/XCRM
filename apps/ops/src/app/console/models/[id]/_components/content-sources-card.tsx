import { prisma } from '@xcrm/db';
import {
  Button,
  OPS_HUES,
  Tag,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  type Hue,
} from '@xcrm/ui';
import { disconnectDriveSource } from '@/app/console/drive-sources/actions';
import { relativeTime } from '@/lib/relative-time';
import { ConnectDriveForm } from './connect-drive-form';
import { SyncNowButton } from './sync-now-button';

const SYNC_HUE: Record<'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'NEVER', Hue> = {
  RUNNING: 210,
  SUCCEEDED: 135,
  FAILED: 25,
  NEVER: null,
};

export async function ContentSourcesCard({ modelId }: { modelId: string }) {
  const sources = await prisma.driveSource.findMany({
    where: { modelId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      folderId: true,
      folderName: true,
      isActive: true,
      lastSyncedAt: true,
      lastSyncStatus: true,
    },
  });

  return (
    <section className="mt-4 flex flex-col gap-4 rounded-lg border border-line bg-surface/40 p-5">
      <header className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Content Sources
        </h3>
        <Tag hue={OPS_HUES.content} size="sm">
          {sources.length} connected
        </Tag>
      </header>

      {sources.length === 0 ? (
        <p className="text-[13px] text-fg-dim">
          No Drive folders connected yet. Paste a folder ID below to start auto-tagging assets
          for this model.
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Folder</TH>
              <TH>Status</TH>
              <TH>Last synced</TH>
              <TH className="text-right">&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {sources.map((s) => {
              const statusKey = s.lastSyncStatus ?? 'NEVER';
              return (
                <TR key={s.id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="text-fg">{s.folderName}</span>
                      <span className="font-mono text-[11px] text-fg-faint">
                        {s.folderId}
                      </span>
                    </div>
                  </TD>
                  <TD>
                    <Tag hue={SYNC_HUE[statusKey]} size="sm">
                      {statusKey.toLowerCase()}
                    </Tag>
                  </TD>
                  <TD className="text-fg-dim">{relativeTime(s.lastSyncedAt)}</TD>
                  <TD className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <SyncNowButton sourceId={s.id} />
                      <form action={disconnectDriveSource}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Disconnect
                        </Button>
                      </form>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="border-t border-line pt-4">
        <ConnectDriveForm modelId={modelId} />
      </div>
    </section>
  );
}
