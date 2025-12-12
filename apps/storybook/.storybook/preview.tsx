import { Toaster } from '@repo/design-system/components/ui/sonner';
import { TooltipProvider } from '@repo/design-system/components/ui/tooltip';
import { ThemeProvider } from '@repo/design-system/providers/theme';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react';

import '@repo/design-system/styles/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    chromatic: {
      modes: {
        light: {
          theme: 'light',
          className: 'light',
        },
        dark: {
          theme: 'dark',
          className: 'dark',
        },
      },
    },
    backgrounds: {
      values: [
        // 👇 Default values from globals.css
        { name: 'Dark', value: 'hsl(192, 100%, 11%)' }, // --solarized-base03
        { name: 'Light', value: 'hsl(44, 87%, 94%)' }, // --solarized-base3
        // 👇 Secondary backgrounds
        { name: 'Dark Secondary', value: 'hsl(192, 81%, 14%)' }, // --solarized-base02
        { name: 'Light Secondary', value: 'hsl(46, 42%, 88%)' }, // --solarized-base2
      ],
      // 👇 Specify which background is shown by default
      default: 'Light',
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
    (Story) => {
      return (
        <div className="bg-background">
          <ThemeProvider>
            <TooltipProvider>
              <Story />
            </TooltipProvider>
            <Toaster />
          </ThemeProvider>
        </div>
      );
    },
  ],
};

export default preview;
