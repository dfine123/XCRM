import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/session';

export default async function Root() {
  const session = await currentSession();
  if (!session) redirect('/login');
  redirect('/overview');
}
