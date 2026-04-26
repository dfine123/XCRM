import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getBatchWithTasks } from '../../_loaders/batch-detail';
import { TaskRunner } from '../../_components/task-runner';

/**
 * Fullscreen runner. Loads + auth-scopes the batch, hands off to
 * `<TaskRunner>` which overlays the topbar layout via `fixed inset-0`.
 *
 * Route params: `id` = TaskBatch.id. Auth: any allowed VA-or-operator
 * role per the layout, AND the batch must be assigned to this user.
 */
export default async function BatchRunnerPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const batch = await getBatchWithTasks(params.id, user.id);
  if (!batch) notFound();
  return <TaskRunner batch={batch} />;
}
