'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@repo/design-system/components/ui/card';
import {
    ArrowRight,
    Brain,
    CheckCircle2,
    FileCheck,
    FileText,
    Heart,
    Plus,
    Sparkles,
    Stethoscope,
} from 'lucide-react';
import Link from 'next/link';

export default function EmailVerifiedPage() {
    return (
        <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-background to-muted/30">
            <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-12">
                {/* Success Hero Section */}
                <div className="mb-10 space-y-5 text-center sm:mb-16 sm:space-y-6">
                    <div className="flex justify-center">
                        <CheckCircle2
                            className="h-12 w-12 text-solarized-green sm:h-16 sm:w-16"
                            strokeWidth={1.5}
                        />
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                        <h1 className="px-2 font-bold text-3xl text-foreground leading-tight sm:text-4xl lg:text-5xl">
                            Willkommen bei{' '}
                            <span className="text-solarized-blue">MDScribe</span>!
                        </h1>
                        <p className="mx-auto max-w-2xl px-4 text-lg text-muted-foreground sm:px-0 sm:text-xl">
                            Deine E-Mail wurde erfolgreich verifiziert. Du kannst jetzt alle
                            Funktionen nutzen, um deine medizinische Dokumentation zu
                            revolutionieren.
                        </p>
                    </div>

                    {/* Primary CTA */}
                    <div className="px-4 pt-4 sm:px-0">
                        <Button
                            asChild
                            className="w-full px-6 py-4 text-base shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl sm:w-auto sm:px-8 sm:py-6 sm:text-lg"
                            size="lg"
                        >
                            <Link
                                className="flex items-center justify-center gap-2 sm:gap-3"
                                href="/aiscribe"
                            >
                                <Brain className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span>KI-Funktionen jetzt ausprobieren</span>
                                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Link>
                        </Button>
                        <p className="mt-3 px-2 text-muted-foreground text-sm sm:px-0">
                            Erstelle in Sekunden professionelle Arztbriefe mit
                            KI-Unterstützung
                        </p>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="space-y-8 sm:space-y-12">
                    <div className="px-4 text-center sm:px-0">
                        <h2 className="mb-3 font-bold text-2xl text-foreground sm:mb-4 sm:text-3xl">
                            Deine nächsten Schritte
                        </h2>
                        <p className="text-base text-muted-foreground sm:text-lg">
                            Entdecke die Möglichkeiten von MDScribe
                        </p>
                    </div>

                    {/* AI Features Section */}
                    <div className="grid gap-4 px-2 sm:grid-cols-2 sm:gap-6 sm:px-0 lg:grid-cols-4">
                        <Link
                            className="block rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            href="/aiscribe/er"
                        >
                            <Card className="h-full border-solarized-red/30 bg-solarized-red/5 transition-colors hover:border-solarized-red/50">
                                <CardHeader className="text-center">
                                    <div className="mb-3 flex justify-center">
                                        <Heart className="h-8 w-8 text-solarized-red" />
                                    </div>
                                    <CardTitle className="text-solarized-red">
                                        Notfall-Modus
                                    </CardTitle>
                                    <CardDescription>
                                        Erstelle Anamnesen und Diagnosen für
                                        Notaufnahme-Patienten
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>

                        <Link
                            className="block rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            href="/aiscribe/outpatient"
                        >
                            <Card className="h-full border-solarized-blue/30 bg-solarized-blue/5 transition-colors hover:border-solarized-blue/50">
                                <CardHeader className="text-center">
                                    <div className="mb-3 flex justify-center">
                                        <Stethoscope className="h-8 w-8 text-solarized-blue" />
                                    </div>
                                    <CardTitle className="text-solarized-blue">
                                        Ambulant-Modus
                                    </CardTitle>
                                    <CardDescription>
                                        Professionelle Arztbriefe für deine ambulanten Konsultationen
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>

                        <Link
                            className="block rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            href="/aiscribe/discharge"
                        >
                            <Card className="h-full border-solarized-green/30 bg-solarized-green/5 transition-colors hover:border-solarized-green/50">
                                <CardHeader className="text-center">
                                    <div className="mb-3 flex justify-center">
                                        <FileCheck className="h-8 w-8 text-solarized-green" />
                                    </div>
                                    <CardTitle className="text-solarized-green">
                                        Entlassung-Modus
                                    </CardTitle>
                                    <CardDescription>
                                        Strukturierte Entlassungsbriefe und Weiterbehandlung
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>

                        <Link
                            className="block rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            href="/aiscribe/procedures"
                        >
                            <Card className="h-full border-solarized-orange/30 bg-solarized-orange/5 transition-colors hover:border-solarized-orange/50">
                                <CardHeader className="text-center">
                                    <div className="mb-3 flex justify-center">
                                        <Sparkles className="h-8 w-8 text-solarized-orange" />
                                    </div>
                                    <CardTitle className="text-solarized-orange">
                                        Prozedur-Modus
                                    </CardTitle>
                                    <CardDescription>
                                        Dokumentation medizinischer Eingriffe und Prozeduren
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    </div>

                    {/* Templates Section */}
                    <div className="mx-2 space-y-5 rounded-2xl bg-muted/30 p-4 sm:mx-0 sm:space-y-6 sm:p-8">
                        <div className="text-center">
                            <h3 className="mb-2 font-bold text-foreground text-xl sm:text-2xl">
                                Textbausteine entdecken
                            </h3>
                            <p className="text-muted-foreground text-sm sm:text-base">
                                Nutze vorgefertigte Vorlagen oder erstelle eigene
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                            <Link href="/templates">
                                <Card className="h-full cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-8 w-8 text-solarized-blue" />
                                            <div>
                                                <CardTitle>Textbausteine durchsuchen</CardTitle>
                                                <CardDescription>
                                                    Entdecke hunderte von vorgefertigten
                                                    medizinischen Vorlagen
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            </Link>

                            <Link href="/templates/create">
                                <Card className="h-full cursor-pointer border-solarized-green/30 bg-solarized-green/5 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <Plus className="h-8 w-8 text-solarized-green" />
                                            <div>
                                                <CardTitle className="text-solarized-green">
                                                    Eigene Vorlage erstellen
                                                </CardTitle>
                                                <CardDescription>
                                                    Erstelle personalisierte Textbausteine für deine
                                                    Praxis
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            </Link>
                        </div>
                    </div>

                    {/* Final CTA Section */}
                    <div className='mx-2 space-y-4 rounded-2xl bg-gradient-to-r from-solarized-blue/10 to-solarized-green/10 p-4 text-center sm:mx-0 sm:p-8'>
                        <h3 className='px-2 font-bold text-foreground text-xl sm:px-0 sm:text-2xl'>
                            Bereit, deine Dokumentation zu revolutionieren?
                        </h3>
                        <p className='mx-auto max-w-2xl px-2 text-base text-muted-foreground sm:px-0 sm:text-lg'>
                            Starte mit einem der KI-Modi und erlebe, wie schnell und
                            präzise medizinische Dokumentation sein kann.
                        </p>
                        <div className='flex flex-col items-center justify-center gap-3 px-2 pt-4 sm:flex-row sm:gap-4 sm:px-0'>
                            <Button
                                asChild
                                className='w-full px-6 py-4 text-base sm:w-auto sm:px-8 sm:py-6 sm:text-lg'
                                size="lg"
                            >
                                <Link
                                    className="flex items-center justify-center gap-2"
                                    href="/aiscribe"
                                >
                                    <Brain className="h-5 w-5" />
                                    Jetzt starten
                                </Link>
                            </Button>
                            <Button
                                asChild
                                className='w-full px-6 py-4 text-base sm:w-auto sm:px-8 sm:py-6 sm:text-lg'
                                size="lg"
                                variant="outline"
                            >
                                <Link
                                    className="flex items-center justify-center gap-2"
                                    href="/templates"
                                >
                                    <FileText className="h-5 w-5" />
                                    Textbausteine ansehen
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
