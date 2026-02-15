'use client';

import { authClient } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
  location: z
    .string()
    .max(120, {
      message: 'Standort darf nicht länger als 120 Zeichen sein.',
    })
    .optional(),
  personalContext: z
    .string()
    .max(1000, {
      message: 'Persönlicher Kontext darf nicht länger als 1000 Zeichen sein.',
    })
    .optional(),
  email: z
    .string()
    .email({
      message: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    })
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileCardProps {
  user: {
    name: string;
    email: string;
    location?: string | null;
    personalContext?: string | null;
  };
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
}

export function ProfileCard({
  user,
  isLoading,
  setIsLoading,
}: ProfileCardProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      location: '',
      personalContext: '',
      email: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        location: user.location || '',
        personalContext: user.personalContext || '',
        email: user.email || '',
      });
    }
  }, [user, form]);

  function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    toast.promise(
      authClient.updateUser({
        name: data.name,
        location: data.location,
        personalContext: data.personalContext,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>
          Verwalten Sie Ihre persönlichen Informationen und deren Darstellung in
          MDScribe.
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
                    Dies ist Dein vollständiger Name, wie er für andere Benutzer
                    erscheint.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standort</FormLabel>
                  <FormControl>
                    <Input placeholder="Klinikum Beispielstadt" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optionaler Standort für persönliche Kontextangaben im
                    KI-Scribe.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="personalContext"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persönlicher Kontext</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="z. B. Fachrichtung, Praxissetting, bevorzugter Schreibstil"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Zusätzliche Informationen, die die KI-Antworten auf Dich
                    zuschneiden.
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
          <CardFooter className="mt-auto">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Speichern...' : 'Änderungen speichern'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
