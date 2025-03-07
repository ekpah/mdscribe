import { auth } from '@repo/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { toast } from 'react-hot-toast';
import UserDashboard from './_components/user-dashboard';

export default async function DashboardPage() {
  // Get the mocked session
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    toast.error('Bitte melden Sie sich an, um Ihr Profil zu verwalten.');
    redirect('/sign-in');
  }

  return <UserDashboard user={session?.user} />;
}
