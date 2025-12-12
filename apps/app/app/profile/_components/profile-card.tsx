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
      email: '',
    },
  });

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
