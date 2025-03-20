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
              <Badge
                variant={
                  subscription?.cancelAtPeriodEnd ? 'outline' : 'outline'
                }
                className={
                  subscription?.cancelAtPeriodEnd
                    ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-700'
                    : 'bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700'
                }
              >
                {subscription?.cancelAtPeriodEnd ? 'Wird gekündigt' : 'Aktiv'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Plan</span>
              <span className="text-sm capitalize">{subscription?.plan}</span>
            </div>
            {subscription?.periodEnd && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {subscription?.cancelAtPeriodEnd
                    ? 'Endet am'
                    : 'Nächstes Abrechnungsdatum'}
                </span>
                <span className="text-sm">
                  {subscription?.periodEnd?.toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="mt-auto">
            {!subscription?.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={onCancel}
                disabled={isManagingSubscription}
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
                variant="outline"
                className="bg-gray-50 text-gray-700 hover:bg-gray-50 hover:text-gray-700"
              >
                Kein Abonnement
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Plan</span>
              <span className="text-sm">Basis</span>
            </div>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button
              className="w-full"
              onClick={onUpgrade}
              disabled={isManagingSubscription}
            >
              Abonnieren
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
