import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import UserDashboard from './_components/user-dashboard';

export default async function DashboardPage() {
  // Get the mocked session
  const [session, activeSessions, subscriptions] = await Promise.all([
    auth.api.getSession({
      headers: await headers(),
    }),
    auth.api.listSessions({
      headers: await headers(),
    }),
    auth.api.listActiveSubscriptions({
      headers: await headers(),
    }),
  ]).catch((e) => {
    console.log(e);
    throw redirect('/sign-in');
  });
  if (!session?.user) {
    redirect('/sign-in');
  }

  const generationLimit =
    subscriptions?.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    )?.limits?.ai_scribe_generations || 0;

  return (
    <UserDashboard
      user={session?.user}
      subscription={subscriptions.find(
        (sub) => sub.status === 'active' || sub.status === 'trialing'
      )}
      generationLimit={generationLimit}
    />
  );
}
