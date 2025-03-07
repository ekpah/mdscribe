'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { authClient } from '@repo/auth/lib/auth-client';
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
import { CreditCard, Zap } from 'lucide-react';
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
      message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    })
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type User = {
  name: string;
  email: string;
};

export default function UserDashboard({ user }: { user: User }) {
  const [isLoading, setIsLoading] = useState(false);

  const { data: session } = authClient.useSession();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  // Update form values when session data is available
  useEffect(() => {
    if (session?.user) {
      form.reset({
        name: session.user.name || '',
        email: session.user.email || '',
      });
    }
  }, [session, form]);

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
    toast.promise(
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
    );
  }

  function handleSubscriptionCancel() {
    toast.promise(
      authClient.subscription.cancel({
        returnUrl: '/dashboard',
      }),
      {
        loading: 'Dein Abonnement wird storniert...',
        success: 'Dein Abonnement wurde erfolgreich storniert.',
        error: 'Dein Abonnement konnte nicht storniert werden.',
      }
    );
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
                        <Input
                          placeholder={session?.user?.email}
                          {...field}
                          disabled
                        />
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
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Status</span>
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700"
                >
                  Aktiv
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Plan</span>
                <span className="text-sm">Professional</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  Nächstes Abrechnungsdatum
                </span>
                <span className="text-sm">1. Juni 2024</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Zahlungsmethode</span>
                <div className="flex items-center">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span className="text-sm">•••• 4242</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start space-y-2">
              <Button variant="outline">Zahlungsmethode aktualisieren</Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleSubscriptionCancel}
              >
                Abonnement kündigen
              </Button>
            </CardFooter>
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
                                placeholder={session?.user?.email}
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
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Status</span>
                    <Badge className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700">
                      Aktiv
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Plan</span>
                    <span className="text-sm">Professional</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      Nächstes Abrechnungsdatum
                    </span>
                    <span className="text-sm">1. Juni 2024</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Zahlungsmethode</span>
                    <div className="flex items-center">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span className="text-sm">•••• 4242</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-start space-y-2">
                  <Button variant="outline">
                    Zahlungsmethode aktualisieren
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={handleSubscriptionCancel}
                  >
                    Abonnement kündigen
                  </Button>
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
