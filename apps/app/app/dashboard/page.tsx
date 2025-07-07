import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import UserCard from './_components/user-card';
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
  ]).catch((_e) => {
    throw redirect('/sign-in');
  });
  if (!session?.user) {
    redirect('/sign-in');
  }
  const activeSubscription = subscriptions.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );
  const generationLimit =
    activeSubscription?.limits?.ai_scribe_generations || 0;

  return (
    <UserDashboard
      activeSessions={JSON.parse(JSON.stringify(activeSessions))}
      generationLimit={generationLimit}
      session={JSON.parse(JSON.stringify(session))}
      subscription={
        activeSubscription
          ? JSON.parse(JSON.stringify(activeSubscription))
          : undefined
      }
      user={JSON.parse(JSON.stringify(session.user))}
    />
  );
}
