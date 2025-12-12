import { env } from '@repo/env';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { VercelToolbar } from '@vercel/toolbar/next';
import type { ThemeProviderProps } from 'next-themes';
import { Toaster } from '../components/ui/sonner';
import { ThemeProvider } from './theme';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { TooltipProvider } from '../components/ui/tooltip';
type DesignSystemProviderProperties = ThemeProviderProps;

export const DesignSystemProvider = ({
  children,
  ...properties
}: DesignSystemProviderProperties) => (
  <ThemeProvider {...properties}>
    <TooltipProvider>{children}</TooltipProvider>
    <Toaster />
    <VercelAnalytics />
    <SpeedInsights />
    {env.NODE_ENV === 'development' && <VercelToolbar />}
  </ThemeProvider>
);
