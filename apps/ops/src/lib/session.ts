import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Resolve the current actor (the logged-in ops user). Always call this at the
 * top of a server action or loader that writes to the DB — mutations need an
 * actorId for the audit trail even when role gating is off.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session.user;
}
