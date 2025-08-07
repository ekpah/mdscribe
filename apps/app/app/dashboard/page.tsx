import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/design-system/components/ui/avatar';
import { Badge } from '@repo/design-system/components/ui/badge';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { QueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BookmarkIcon,
  Brain,
  ClipboardCheck,
  ExternalLinkIcon,
  FileCheck,
  FileText,
  Heart,
  PlusIcon,
  SearchIcon,
  Settings,
  Star,
  Stethoscope,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

import { orpc } from '@/lib/orpc';
import { LiveTime } from './_components/LiveTime';

export default async function DashboardPage() {
  // Get the session and user data
  const [session, subscriptions] = await Promise.all([
    auth.api.getSession({
      headers: await headers(),
    }),
    auth.api.listActiveSubscriptions({
      headers: await headers(),
    }),
  ]).catch((_e) => {
    throw redirect('/sign-in');
  });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const activeSubscription = subscriptions.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const queryClient = new QueryClient();

  const data = await queryClient.fetchQuery(orpc.getUsage.queryOptions());

  const currentUsage = data?.usage?.count || 0;

  // Calculate monthly usage limit (same logic as subscription card)
  const monthlyUsageLimit = activeSubscription ? 500 : 50;
  const remainingGenerations = Math.max(0, monthlyUsageLimit - currentUsage);

  // Get user's favorite templates (top 5)
  const favoriteTemplates = await queryClient.fetchQuery(
    orpc.user.templates.favourites.queryOptions()
  );

  // Get user's own templates (top 3)
  const userTemplates = await queryClient.fetchQuery(
    orpc.user.templates.authored.queryOptions()
  );

  const aiFunctions = [
    {
      title: 'Notfall Anamnese',
      description:
        'Erstellen Sie professionelle Anamnese-Dokumentation für Notfallpatienten',
      icon: Heart,
      href: '/aiscribe/er',
      color: 'text-solarized-red',
      bgColor: 'bg-solarized-red/10',
      borderColor: 'border-solarized-red/20',
    },
    {
      title: 'Entlassungsbrief',
      description:
        'Erstellen Sie professionelle Entlassungsbriefe für Ihre Patienten',
      icon: FileCheck,
      href: '/aiscribe/discharge',
      color: 'text-solarized-blue',
      bgColor: 'bg-solarized-blue/10',
      borderColor: 'border-solarized-blue/20',
    },
    {
      title: 'Prozedur-Dokumentation',
      description:
        'Erstellen Sie professionelle Dokumentationen für medizinische Eingriffe',
      icon: ClipboardCheck,
      href: '/aiscribe/procedures',
      color: 'text-solarized-orange',
      bgColor: 'bg-solarized-orange/10',
      borderColor: 'border-solarized-orange/20',
    },
    {
      title: 'ICU Verlegungsbrief',
      description:
        'Erstellen Sie professionelle Verlegungsbriefe für Ihre ICU-Patienten',
      icon: Stethoscope,
      href: '/aiscribe/icu',
      color: 'text-solarized-green',
      bgColor: 'bg-solarized-green/10',
      borderColor: 'border-solarized-green/20',
    },
    {
      title: 'Ambulante Konsultation',
      description:
        'Erstellen Sie Dokumentationen für ambulante Patientenbesuche',
      icon: FileText,
      href: '/aiscribe/outpatient',
      color: 'text-solarized-violet',
      bgColor: 'bg-solarized-violet/10',
      borderColor: 'border-solarized-violet/20',
    },
  ];

  // Mock recent activity data
  const recentActivity = [
    {
      id: 1,
      type: 'template_created',
      title: 'Entlassungsbrief Kardiologie erstellt',
      time: '2 Stunden',
      icon: FileText,
    },
    {
      id: 2,
      type: 'ai_generation',
      title: 'KI-Anamnese für Notfallpatient generiert',
      time: '4 Stunden',
      icon: Brain,
    },
    {
      id: 3,
      type: 'template_shared',
      title: 'Template favorisiert',
      time: '1 Tag',
      icon: Star,
    },
  ];

  return (
    <div className="h-full w-screen overflow-y-auto bg-gradient-to-br from-solarized-base3 via-solarized-base2 to-solarized-base2">
      <div className="container mx-auto max-w-7xl space-y-6 p-4 pb-16 sm:p-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-start space-y-4 sm:flex-row sm:items-center sm:space-x-6 sm:space-y-0">
            <div className="relative">
              <Avatar className="h-16 w-16 shadow-lg ring-4 ring-white sm:h-20 sm:w-20">
                <AvatarImage
                  alt={session.user.name || 'User'}
                  src={session.user.image || undefined}
                />
                <AvatarFallback className="bg-gradient-to-br from-solarized-blue to-solarized-violet font-bold text-lg text-solarized-base3 sm:text-xl">
                  {session.user.name?.charAt(0) ||
                    session.user.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="-bottom-1 -right-1 absolute h-4 w-4 rounded-full border-2 border-white bg-green-500 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="mb-2 font-bold text-2xl text-solarized-base03 sm:text-3xl lg:text-4xl">
                Willkommen zurück, {session.user.name || session.user.email}!
              </h1>
              <p className="mb-1 text-base text-solarized-base01 sm:text-lg">
                Bereit für einen produktiven Tag in der medizinischen
                Dokumentation?
              </p>
              <div className="flex flex-col gap-2 text-solarized-base1 text-xs sm:flex-row sm:items-center sm:gap-4 sm:text-sm">
                <LiveTime />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Link href="/profile">
              <Button
                className="w-full gap-2 bg-transparent sm:w-auto"
                size="sm"
                variant="outline"
              >
                <Settings className="h-4 w-4" />
                Profil bearbeiten
              </Button>
            </Link>
            <Link href="/aiscribe">
              <Button
                className="w-full gap-2 bg-solarized-blue text-white hover:bg-solarized-blue/90 sm:w-auto"
                size="sm"
              >
                <Zap className="h-4 w-4" />
                KI starten
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
          <Card className="border-solarized-blue/30 bg-solarized-base3 shadow-lg transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-solarized-base03 text-xs sm:text-sm">
                Favoriten
              </CardTitle>
              <BookmarkIcon className="h-4 w-4 text-solarized-blue sm:h-5 sm:w-5" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-solarized-base03 text-xl sm:text-3xl">
                {favoriteTemplates.length}
              </div>
              <p className="text-solarized-base01 text-xs">
                Gespeicherte Templates
              </p>
            </CardContent>
          </Card>

          <Card className="border-solarized-green/30 bg-solarized-base3 shadow-lg transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-solarized-base03 text-xs sm:text-sm">
                Erstellt
              </CardTitle>
              <PlusIcon className="h-4 w-4 text-solarized-green sm:h-5 sm:w-5" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-solarized-base03 text-xl sm:text-3xl">
                {userTemplates.length}
              </div>
              <p className="text-solarized-base01 text-xs">Eigene Templates</p>
            </CardContent>
          </Card>

          <Card className="border-solarized-violet/30 bg-solarized-base3 shadow-lg transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-solarized-base03 text-xs sm:text-sm">
                KI-Generierungen
              </CardTitle>
              <Brain className="h-4 w-4 text-solarized-violet sm:h-5 sm:w-5" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-solarized-base03 text-xl sm:text-3xl">
                {remainingGenerations}
                <span className="font-normal text-sm text-solarized-base01">
                  {' '}
                  / {monthlyUsageLimit}
                </span>
              </div>
              <p className="text-solarized-base01 text-xs">
                Verfügbare Generierungen
              </p>
            </CardContent>
          </Card>

          <Card className="border-solarized-orange/30 bg-solarized-base3 shadow-lg transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-solarized-base03 text-xs sm:text-sm">
                KI-Generierungen
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-solarized-orange sm:h-5 sm:w-5" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-solarized-base03 text-xl sm:text-3xl">
                {currentUsage}
              </div>
              <p className="text-solarized-base01 text-xs">
                KI-Generierungen in diesem Monat
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Functions Section */}
        <Card className="border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-bold text-solarized-base03 text-xl sm:text-2xl">
                <Brain className="h-5 w-5 text-solarized-violet sm:h-6 sm:w-6" />
                KI-Funktionen
              </CardTitle>
              <CardDescription className="text-solarized-base01">
                Nutzen Sie KI-gestützte Dokumentation für verschiedene
                medizinische Bereiche
              </CardDescription>
            </div>
            <Link href="/aiscribe">
              <Button className="w-full gap-2 border-0 bg-solarized-blue text-white hover:bg-solarized-blue/90 sm:w-auto">
                <ExternalLinkIcon className="h-4 w-4" />
                Alle Funktionen
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {aiFunctions.map((func) => (
                <Link href={func.href} key={func.href}>
                  <Card className="group h-full cursor-pointer border-solarized-base1 bg-solarized-base3 transition-all duration-200 hover:scale-105 hover:shadow-xl">
                    <CardHeader className="pb-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className={`inline-flex rounded-lg border-2 p-3 ${func.bgColor} ${func.borderColor}`}
                        >
                          <func.icon className={`h-6 w-6 ${func.color}`} />
                        </div>
                      </div>
                      <CardTitle className="text-lg text-solarized-base03 transition-colors group-hover:text-solarized-blue">
                        {func.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-solarized-base01">
                        {func.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center font-medium text-sm text-solarized-blue transition-transform group-hover:translate-x-1">
                        Jetzt verwenden
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates and Activity Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Favorite Templates */}
          <div className="lg:col-span-2">
            <Card className="h-full border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-bold text-2xl text-solarized-base03">
                    <Star className="h-6 w-6 text-solarized-yellow" />
                    Meine Favoriten
                  </CardTitle>
                  <CardDescription className="text-solarized-base01">
                    Ihre am häufigsten verwendeten Templates
                  </CardDescription>
                </div>
                <Link href="/templates">
                  <Button
                    className="gap-2 bg-transparent"
                    size="sm"
                    variant="outline"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                    Alle anzeigen
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {favoriteTemplates.length > 0 ? (
                    favoriteTemplates.map((template) => (
                      <Card
                        className="border border-solarized-base2 transition-all duration-200 hover:shadow-md"
                        key={template.id}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <Badge className="text-xs" variant="secondary">
                                  {template.category}
                                </Badge>
                                <Badge className="text-xs" variant="outline">
                                  <Heart className="mr-1 h-3 w-3" />
                                  {template._count.favouriteOf}
                                </Badge>
                              </div>
                              <h3 className="mb-1 font-semibold text-solarized-base03">
                                {template.title}
                              </h3>
                              <p className="mb-2 line-clamp-2 text-sm text-solarized-base01">
                                {template.content.substring(0, 100)}...
                              </p>
                            </div>
                            <Link href={`/templates/${template.id}`}>
                              <Button
                                className="gap-1"
                                size="sm"
                                variant="ghost"
                              >
                                <ExternalLinkIcon className="h-3 w-3" />
                                Öffnen
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="border-2 border-solarized-base1 border-dashed">
                      <CardContent className="p-8 text-center">
                        <BookmarkIcon className="mx-auto mb-4 h-12 w-12 text-solarized-base2" />
                        <h3 className="mb-2 font-semibold text-solarized-base03">
                          Noch keine Favoriten
                        </h3>
                        <p className="mb-4 text-sm text-solarized-base01">
                          Markieren Sie Templates als Favoriten, um sie hier
                          schnell zu finden.
                        </p>
                        <Link href="/templates">
                          <Button className="gap-2">
                            <SearchIcon className="h-4 w-4" />
                            Templates durchsuchen
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <Card className="h-full border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-solarized-base03 text-xl">
                  <Activity className="h-5 w-5 text-solarized-green" />
                  Letzte Aktivität
                </CardTitle>
                <CardDescription className="text-solarized-base01">
                  Ihre neuesten Aktionen im Überblick
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      className="flex items-start gap-3 rounded-lg bg-solarized-base2 p-3 transition-colors hover:bg-solarized-base1"
                      key={activity.id}
                    >
                      <div className="rounded-full bg-solarized-base3 p-2 shadow-sm">
                        <activity.icon className="h-4 w-4 text-solarized-blue" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm text-solarized-base03">
                          {activity.title}
                        </p>
                        <p className="text-solarized-base1 text-xs">
                          vor {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* My Templates Section */}
                <div className="mt-6 border-solarized-base1 border-t pt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-solarized-base03">
                      Meine Templates
                    </h3>
                    <Link href="/templates/create">
                      <Button
                        className="gap-1 bg-transparent"
                        size="sm"
                        variant="outline"
                      >
                        <PlusIcon className="h-3 w-3" />
                        Neu
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {userTemplates.length > 0 ? (
                      userTemplates.map((template) => (
                        <div
                          className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-solarized-base2"
                          key={template.id}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm text-solarized-base03">
                              {template.title}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge className="text-xs" variant="secondary">
                                {template.category}
                              </Badge>
                              <span className="text-solarized-base1 text-xs">
                                {template._count.favouriteOf} ♥
                              </span>
                            </div>
                          </div>
                          <Link href={`/templates/${template.id}`}>
                            <Button
                              className="h-8 w-8 p-0"
                              size="sm"
                              variant="ghost"
                            >
                              <ExternalLinkIcon className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center">
                        <PlusIcon className="mx-auto mb-2 h-8 w-8 text-solarized-base2" />
                        <p className="mb-2 text-sm text-solarized-base01">
                          Noch keine eigenen Templates
                        </p>
                        <Link href="/templates/create">
                          <Button className="gap-1" size="sm">
                            <PlusIcon className="h-3 w-3" />
                            Erstellen
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
