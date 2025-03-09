'use client';

import { authClient } from '@/lib/auth-client';
import type { Subscription } from '@better-auth/stripe';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/design-system/components/ui/form';
import { Input } from '@repo/design-system/components/ui/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Name muss mindestens 2 Zeichen lang sein.',
    })
    .max(30, {
      message: 'Name darf nicht länger als 30 Zeichen sein.',
    }),
  email: z
    .string()
    .email({
      message: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    })
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type User = {
  name: string;
  email: string;
};

//user Dashboard to manage profile and subscription
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

  // get the active subscription
  const activeSubscription = subscription;

  const hasActiveSubscription = !!activeSubscription;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  // Update form values when session data is available
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user, form]);

  function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    toast.promise(
      authClient.updateUser({
        name: data.name,
      }),
      {
        loading: 'Dein Profil wird aktualisiert...',
        success: 'Dein Profil wurde erfolgreich aktualisiert.',
        error:
          'Dein Profil konnte nicht aktualisiert werden. Bitte versuche es erneut.',
      }
    );
    setIsLoading(false);
  }

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
          success: 'Dein Abonnement wurde erfolgreich aktualisiert.',
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
          success: 'Dein Abonnement wurde erfolgreich storniert.',
          error: 'Dein Abonnement konnte nicht storniert werden.',
        }
      )
      .finally(() => setIsManagingSubscription(false));
  }

  function handleUpdatePaymentMethod() {
    setIsManagingSubscription(true);
    toast
      .promise(
        authClient.subscription.upgrade({
          plan: 'plus',
          returnUrl: '/dashboard',
        }),
        {
          loading: 'Zahlungsmethode wird aktualisiert...',
          success: 'Zahlungsmethode wurde erfolgreich aktualisiert.',
          error: 'Zahlungsmethode konnte nicht aktualisiert werden.',
        }
      )
      .finally(() => setIsManagingSubscription(false));
  }

  function handleManageSubscription() {
    setIsManagingSubscription(true);
    toast
      .promise(
        authClient.subscription.cancel({
          returnUrl: '/dashboard',
        }),
        {
          loading: 'Kundencenter wird geladen...',
          success: 'Kundencenter wurde geladen.',
          error: 'Kundencenter konnte nicht geladen werden.',
        }
      )
      .finally(() => setIsManagingSubscription(false));
  }

  /*
    try {
      const toastId = toast.loading('Loading...');
      await authClient.updateUser({
        name: data.name,
      });

      toast.success('Dein Profil wurde erfolgreich aktualisiert.');
    } catch (error) {
      toast.error(
        'Dein Profil konnte nicht aktualisiert werden. Bitte versuche es erneut.'
      );
    } finally {
      setIsLoading(false);
    }
  }
*/

  return (
    <div className="overflow-y-auto">
      <div className="hidden 2xl:block">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>
              Verwalten Sie Ihre persönlichen Informationen und deren
              Darstellung in MDScribe.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Maria Mustermann" {...field} />
                      </FormControl>
                      <FormDescription>
                        Dies ist Dein vollständiger Name, wie er für andere
                        Benutzer erscheint.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input placeholder={user?.email} {...field} disabled />
                      </FormControl>
                      <FormDescription>
                        Deine E-Mail-Adresse wird zum Login verwendet und kann
                        aktuell nicht verändert werden.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Speichern...' : 'Änderungen speichern'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
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
                        activeSubscription?.cancelAtPeriodEnd
                          ? 'outline'
                          : 'outline'
                      }
                      className={
                        activeSubscription?.cancelAtPeriodEnd
                          ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-700'
                          : 'bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700'
                      }
                    >
                      {activeSubscription?.cancelAtPeriodEnd
                        ? 'Wird gekündigt'
                        : 'Aktiv'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Plan</span>
                    <span className="text-sm capitalize">
                      {activeSubscription?.plan}
                    </span>
                  </div>
                  {activeSubscription?.periodEnd && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {activeSubscription?.cancelAtPeriodEnd
                          ? 'Endet am'
                          : 'Nächstes Abrechnungsdatum'}
                      </span>
                      <span className="text-sm">
                        {activeSubscription?.periodEnd?.toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col items-start space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleUpdatePaymentMethod}
                    disabled={isManagingSubscription}
                  >
                    Zahlungsmethode aktualisieren
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={isManagingSubscription}
                  >
                    Abonnement verwalten
                  </Button>
                  {!activeSubscription?.cancelAtPeriodEnd && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={handleSubscriptionCancel}
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
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={handleSubscriptionUpgrade}
                    disabled={isManagingSubscription}
                  >
                    Abonnieren
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Plan-Funktionen</CardTitle>
              <CardDescription>
                Dein Professional-Plan enthält die folgenden Funktionen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {[
                  'Unbegrenzt Textbausteine nutzen',
                  'Favoriten-Bibliothek verwalten',
                  'Benutzerdefinierte Vorlagen generieren',
                  'Zeit im klinischen Alltag sparen',
                  'Anamnesen mit KI generieren',
                ].map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Zap className="mr-2 h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleSubscriptionUpgrade}>
                <Zap className="mr-2 h-4 w-4" />
                Hol dir Plus
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <div className="2xl:hidden">
        <Tabs defaultValue="profile">
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
          <div className="h-[400px] w-[800px]">
            <TabsContent value="profile" className="h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Profil</CardTitle>
                  <CardDescription>
                    Verwalten Sie Ihre persönlichen Informationen und deren
                    Darstellung in MDScribe.
                  </CardDescription>
                </CardHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                      <FormField
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Dr. Maria Mustermann"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Dies ist Dein vollständiger Name, wie er für
                              andere Benutzer erscheint.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-Mail</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={user?.email}
                                {...field}
                                disabled
                              />
                            </FormControl>
                            <FormDescription>
                              Deine E-Mail-Adresse wird zum Login verwendet und
                              kann aktuell nicht verändert werden.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Speichern...' : 'Änderungen speichern'}
                      </Button>
                    </CardFooter>
                  </form>
                </Form>
              </Card>
            </TabsContent>
            <TabsContent value="subscription" className="h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Aktuelles Abonnement</CardTitle>
                  <CardDescription>
                    Verwalte Dein Abonnement und Deine Zahlungsinformationen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasActiveSubscription ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Status</span>
                        <Badge
                          variant={
                            activeSubscription?.cancelAtPeriodEnd
                              ? 'outline'
                              : 'outline'
                          }
                          className={
                            activeSubscription?.cancelAtPeriodEnd
                              ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-700'
                              : 'bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700'
                          }
                        >
                          {activeSubscription?.cancelAtPeriodEnd
                            ? 'Wird gekündigt'
                            : 'Aktiv'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Plan</span>
                        <span className="text-sm capitalize">
                          {activeSubscription?.plan}
                        </span>
                      </div>
                      {activeSubscription?.periodEnd && (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {activeSubscription?.cancelAtPeriodEnd
                              ? 'Endet am'
                              : 'Nächstes Abrechnungsdatum'}
                          </span>
                          <span className="text-sm">
                            {activeSubscription?.periodEnd?.toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
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
                        <span className="text-sm">Free</span>
                      </div>
                      <div className="rounded-md bg-gray-50 p-4 text-sm">
                        Mit einem Plus-Abonnement erhältst du Zugriff auf alle
                        Premium-Funktionen von MDScribe, einschließlich
                        unbegrenzter Textbausteine und KI-Generierungen.
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col items-start space-y-2">
                  {hasActiveSubscription ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleUpdatePaymentMethod}
                        disabled={isManagingSubscription}
                      >
                        Zahlungsmethode aktualisieren
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleManageSubscription}
                        disabled={isManagingSubscription}
                      >
                        Abonnement verwalten
                      </Button>
                      {!activeSubscription?.cancelAtPeriodEnd && (
                        <Button
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={handleSubscriptionCancel}
                          disabled={isManagingSubscription}
                        >
                          Abonnement kündigen
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={handleSubscriptionUpgrade}
                      disabled={isManagingSubscription}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Hol dir Plus
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="features" className="h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Plan-Funktionen</CardTitle>
                  <CardDescription>
                    Dein Professional-Plan enthält die folgenden Funktionen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {[
                      'Unbegrenzt Textbausteine nutzen',
                      'Favoriten-Bibliothek verwalten',
                      'Benutzerdefinierte Vorlagen generieren',
                      'Zeit im klinischen Alltag sparen',
                      'Anamnesen mit KI generieren',
                    ].map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <Zap className="mr-2 h-4 w-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={handleSubscriptionUpgrade}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Hol dir Plus
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
