'use client';

import type { Subscription } from '@better-auth/stripe';
import { MobileIcon } from '@radix-ui/react-icons';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@repo/design-system/components/ui/alert';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@repo/design-system/components/ui/avatar';
import { Button } from '@repo/design-system/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@repo/design-system/components/ui/card';
import { Checkbox } from '@repo/design-system/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@repo/design-system/components/ui/dialog';
import { Label } from '@repo/design-system/components/ui/label';
import { PasswordInput } from '@repo/design-system/components/ui/password-input';
import { useQuery } from '@tanstack/react-query';
import {
    Laptop,
    Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { UAParser } from 'ua-parser-js';
import { authClient, useSession } from '@/lib/auth-client';
import type { Session } from '@/lib/auth-types';

export default function UserCard(props: {
    session: Session | null;
    activeSessions: Session['session'][];
    subscription?: Subscription;
}) {
    const router = useRouter();
    const { data, isPending } = useSession();
    const session = data || props.session;
    const [isTerminating, setIsTerminating] = useState<string>();

    const [emailVerificationPending, setEmailVerificationPending] =
        useState<boolean>(false);
    const [activeSessions, setActiveSessions] = useState(props.activeSessions);
    const removeActiveSession = (id: string) =>
        setActiveSessions(activeSessions.filter((session) => session.id !== id));


    return (
        <Card>
            <CardHeader>
                <CardTitle>Benutzer</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-8">
                <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="hidden h-9 w-9 sm:flex ">
                                <AvatarImage
                                    alt="Avatar"
                                    className="object-cover"
                                    src={session?.user.image || undefined}
                                />
                                <AvatarFallback>{session?.user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="grid">
                                <div className="flex items-center gap-1">
                                    <p className="font-medium text-sm leading-none">
                                        {session?.user.name}
                                    </p>

                                </div>
                                <p className="text-sm">{session?.user.email}</p>
                            </div>
                        </div>
                    </div>

                </div>

                {session?.user.emailVerified ? null : (
                    <Alert>
                        <AlertTitle>Bestätigen Sie Ihre E-Mail-Adresse</AlertTitle>
                        <AlertDescription className="text-muted-foreground">
                            Bitte bestätigen Sie Ihre E-Mail-Adresse. Überprüfen Sie Ihren Posteingang auf die
                            Bestätigungs-E-Mail. Wenn Sie die E-Mail nicht erhalten haben, klicken Sie auf die
                            Schaltfläche unten, um sie erneut zu senden.
                            <Button
                                className="mt-2"
                                onClick={async () => {
                                    await authClient.sendVerificationEmail(
                                        {
                                            email: session?.user.email || '',
                                        },
                                        {
                                            onRequest(context) {
                                                setEmailVerificationPending(true);
                                            },
                                            onError(context) {
                                                toast.error(context.error.message);
                                                setEmailVerificationPending(false);
                                            },
                                            onSuccess() {
                                                toast.success('Bestätigungs-E-Mail erfolgreich gesendet');
                                                setEmailVerificationPending(false);
                                            },
                                        }
                                    );
                                }}
                                size="sm"
                                variant="secondary"
                            >
                                {emailVerificationPending ? (
                                    <Loader2 className="animate-spin" size={15} />
                                ) : (
                                    'Bestätigungs-E-Mail erneut senden'
                                )}
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex w-max flex-col gap-1 border-l-2 px-2">
                    <p className="font-medium text-xs ">Aktive Sitzungen</p>
                    {activeSessions
                        .filter((session) => session.userAgent)
                        .map((session) => {
                            return (
                                <div key={session.id}>
                                    <div className="flex items-center gap-2 font-medium text-black text-sm dark:text-white">
                                        {new UAParser(session.userAgent || '').getDevice().type ===
                                            'mobile' ? (
                                            <MobileIcon />
                                        ) : (
                                            <Laptop size={16} />
                                        )}
                                        {new UAParser(session.userAgent || '').getOS().name},{' '}
                                        {new UAParser(session.userAgent || '').getBrowser().name}
                                        <Button
                                            className="cursor-pointer border-muted-foreground text-xs opacity-80 "
                                            onClick={async () => {
                                                setIsTerminating(session.id);
                                                const res = await authClient.revokeSession({
                                                    token: session.token,
                                                });

                                                if (res.error) {
                                                    toast.error(
                                                        res.error.message || 'Sitzung konnte nicht beendet werden'
                                                    );
                                                } else {
                                                    toast.success('Sitzung erfolgreich beendet');
                                                    removeActiveSession(session.id);
                                                }
                                                if (session.id === props.session?.session.id) {
                                                    router.refresh();
                                                }
                                                setIsTerminating(undefined);
                                            }}
                                            variant="secondary"
                                        >
                                            {(() => {
                                                if (isTerminating === session.id) {
                                                    return <Loader2 className="animate-spin" size={15} />;
                                                }
                                                if (session.id === props.session?.session.id) {
                                                    return 'Abmelden';
                                                }
                                                return 'Beenden';
                                            })()}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </CardContent>

        </Card>
    );
}