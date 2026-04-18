import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function Root() {
  const session = await auth();
  if (!session) redirect('/login');
  const role = session.user.role;
  if (role === 'VA_T1' || role === 'VA_T2' || role === 'VA_T3') redirect('/va');
  redirect('/console');
}
