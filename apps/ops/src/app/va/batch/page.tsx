import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getOpenBatchForUser } from '../_loaders/current-batch';

/**
 * /va/batch — collapses to whichever batch the VA is currently
 * working on, or back to the landing page when there isn't one.
 * The real runner lives at /va/batch/[id].
 */
export default async function CurrentBatchRedirectPage() {
  const user = await requireUser();
  const open = await getOpenBatchForUser(user.id);
  if (open) redirect(`/va/batch/${open.id}`);
  redirect('/va');
}
