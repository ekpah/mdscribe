'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function EmailVerifiedPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to dashboard after a brief moment to show success
        const timer = setTimeout(() => {
            router.push('/dashboard');
        }, 1500);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-background to-muted/30">
            <div className="text-center space-y-6 p-8">
                <div className="flex justify-center">
                    <CheckCircle2
                        className="h-16 w-16 text-solarized-green animate-in fade-in zoom-in duration-500"
                        strokeWidth={1.5}
                    />
                </div>
                <div className="space-y-2">
                    <h1 className="font-bold text-2xl text-foreground sm:text-3xl">
                        E-Mail erfolgreich verifiziert!
                    </h1>
                    <p className="text-muted-foreground">
                        Du wirst zum Dashboard weitergeleitet...
                    </p>
                </div>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        </div>
    );
}
