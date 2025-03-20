'use client';

import { authClient } from '@/lib/auth-client';
import type { Subscription } from '@better-auth/stripe';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FeaturesCard } from './features-card';
import { ProfileCard } from './profile-card';
import { SubscriptionCard } from './subscription-card';

type User = {
  name: string;
  email: string;
};

export default function UserDashboard({
  user,
  subscription,
  generationLimit,
}: {
  user: User;
  subscription?: Subscription;
  generationLimit: number;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const hasActiveSubscription = !!subscription;

  function handleSubscriptionUpgrade() {
    setIsManagingSubscription(true);
    toast
      .promise(
        authClient.subscription.upgrade({
          plan: 'plus',
          successUrl: '/dashboard',
          cancelUrl: '/dashboard',
        }),
        {
          loading: 'Dein Abonnement wird aktualisiert...',
          error: 'Dein Abonnement konnte nicht aktualisiert werden.',
        }
      )
      .finally(() => setIsManagingSubscription(false));
  }

  function handleSubscriptionCancel() {
    setIsManagingSubscription(true);
    toast
      .promise(
        authClient.subscription.cancel({
          returnUrl: '/dashboard',
        }),
        {
          loading: 'Dein Abonnement wird storniert...',
          error: 'Dein Abonnement konnte nicht storniert werden.',
        }
      )
      .finally(() => setIsManagingSubscription(false));
  }

  return (
    <div className="overflow-y-auto">
      <div className="hidden 2xl:block">
        <ProfileCard
          user={user}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <SubscriptionCard
            subscription={subscription}
            isManagingSubscription={isManagingSubscription}
            onUpgrade={handleSubscriptionUpgrade}
            onCancel={handleSubscriptionCancel}
          />
          <FeaturesCard
            hasActiveSubscription={hasActiveSubscription}
            onUpgrade={handleSubscriptionUpgrade}
          />
        </div>
      </div>

      <div className="2xl:hidden">
        <Tabs defaultValue="profile" className="w-full p-4">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="w-full">
              Profil
            </TabsTrigger>
            <TabsTrigger value="subscription" className="w-full">
              Abonnement
            </TabsTrigger>
            <TabsTrigger value="features" className="w-full">
              Funktionen
            </TabsTrigger>
          </TabsList>
          <div className="h-[500px] w-[800px] max-w-full">
            <TabsContent value="profile" className="h-full">
              <ProfileCard
                user={user}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </TabsContent>
            <TabsContent value="subscription" className="h-full">
              <SubscriptionCard
                subscription={subscription}
                isManagingSubscription={isManagingSubscription}
                onUpgrade={handleSubscriptionUpgrade}
                onCancel={handleSubscriptionCancel}
              />
            </TabsContent>
            <TabsContent value="features" className="h-full">
              <FeaturesCard
                hasActiveSubscription={hasActiveSubscription}
                onUpgrade={handleSubscriptionUpgrade}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
