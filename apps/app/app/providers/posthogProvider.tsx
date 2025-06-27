// app/providers.tsx
'use client';

import { env } from '@repo/env';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';

import { authClient } from '@/lib/auth-client';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    // use fake token to identify, when to opt out of tracking (dev and staging)
    if (env.NEXT_PUBLIC_POSTHOG_KEY !== 'fake token') {
      posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host:
          (env.NEXT_PUBLIC_POSTHOG_HOST as string) ??
          'https://eu.i.posthog.com',
        person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
        capture_pageview: 'history_change',
        persistence: 'memory',
        bootstrap: {
          distinctID: session?.user?.id ?? undefined,
          isIdentifiedID: !!session?.user?.id,
        },
      });
    } else {
      posthog.init('fake token', {
        autocapture: false,
        loaded: (ph) => {
          if (process.env.ENVIRONMENT === 'development') {
            ph.opt_out_capturing(); // opts a user out of event capture
            ph.set_config({ disable_session_recording: true });
          }
        },
      });
    }
  }, [session?.user?.id]);

  // Identify user once logged in
  useEffect(() => {
    if (posthog && session?.user?.id) {
      posthog.identify(session?.user?.id, {
        email: session?.user?.email,
      });
    }
  }, [session?.user?.id]);

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PHProvider>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  // Track pageviews
  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = `${url}?${searchParams.toString()}`;
      }

      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

// Wrap PostHogPageView in Suspense to avoid the useSearchParams usage above
// from de-opting the whole app into client-side rendering
// See: https://nextjs.org/docs/messages/deopted-into-client-rendering
function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}
