import type { Subscription } from '@better-auth/stripe';
import { Badge } from '@repo/design-system/components/ui/badge';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { useQuery } from '@tanstack/react-query';

interface SubscriptionCardProps {
  subscription?: Subscription;
  isManagingSubscription: boolean;
  onUpgrade: () => void;
  onCancel: () => void;
}

export function SubscriptionCard({
  subscription,
  isManagingSubscription,
  onUpgrade,
  onCancel,
}: SubscriptionCardProps) {
  const hasActiveSubscription = !!subscription;


  // TODO: Get this from the subscription, right now hardcoded
  const monthlyUsageLimit = hasActiveSubscription ? 500 : 50;

  const { data, isPending } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch('/api/scribe/getUsage');
      if (!res.ok) {
        throw new Error('Network response was not ok')
      }
      return res.json();
    },
  });

  const { usage } = data || {};



  const statusBadge = subscription?.cancelAtPeriodEnd ? (
    <Badge
      className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-700"
      variant="outline"
    >
      Wird gekündigt
    </Badge>
  ) : (
    <Badge
      className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700"
      variant="outline"
    >
      Aktiv
    </Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktuelles Abonnement</CardTitle>
        <CardDescription>
          Verwalte Dein Abonnement und Deine Zahlungsinformationen.
        </CardDescription>
      </CardHeader>
      {hasActiveSubscription ? (
        <>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Status</span>
              {statusBadge}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Plan</span>
              <span className="text-sm capitalize">{subscription?.plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Nutzung (aktueller Monat)</span>
              <span className="text-sm">{usage?.count || 0} / {monthlyUsageLimit}</span>
            </div>
            {subscription?.periodEnd && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {subscription?.cancelAtPeriodEnd
                    ? 'Endet am'
                    : 'Nächstes Abrechnungsdatum'}
                </span>
                <span className="text-sm">
                  {new Date(subscription?.periodEnd).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="mt-auto">
            {!subscription?.cancelAtPeriodEnd && (
              <Button
                className="text-destructive hover:text-destructive"
                disabled={isManagingSubscription}
                onClick={onCancel}
                variant="outline"
              >
                Abonnement kündigen
              </Button>
            )}
          </CardFooter>
        </>
      ) : (
        <>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Status</span>
              <Badge
                className="bg-gray-50 text-gray-700 hover:bg-gray-50 hover:text-gray-700"
                variant="outline"
              >
                Kein Abonnement
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Plan</span>
              <span className="text-sm">Basis</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Nutzung (aktueller Monat)</span>
              <span className="text-sm">{usage?.count || 0} / {monthlyUsageLimit}</span>
            </div>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button
              className="w-full"
              disabled={isManagingSubscription}
              onClick={onUpgrade}
            >
              Abonnieren
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
