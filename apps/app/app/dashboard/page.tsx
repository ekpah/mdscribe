import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import UserDashboard from './_components/user-dashboard';

export default async function DashboardPage() {
  // Get the mocked session
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect('/sign-in');
  }

  return <UserDashboard user={session?.user} />;
}
