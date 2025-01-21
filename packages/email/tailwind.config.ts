const config = {
  theme: {
    extend: {
      colors: {
        border: 'hsl(180 7% 60%)', // base1
        input: 'hsl(180 7% 60%)', // base1
        ring: 'hsl(205 69% 49%)', // blue
        background: 'hsl(44 87% 94%)', // base3
        foreground: 'hsl(196 13% 45%)', // base00
        primary: {
          DEFAULT: 'hsl(205 69% 49%)', // blue
          foreground: 'hsl(44 87% 94%)', // base3
        },
        secondary: {
          DEFAULT: 'hsl(46 42% 88%)', // base2
          foreground: 'hsl(196 13% 45%)', // base00
        },
        destructive: {
          DEFAULT: 'hsl(18 80% 44%)', // orange
          foreground: 'hsl(192 100% 11%)', // base03
        },
        muted: {
          DEFAULT: 'hsl(46 42% 88%)', // base2
          foreground: 'hsl(180 7% 60%)', // base1
        },
        accent: {
          DEFAULT: 'hsl(46 42% 88%)', // base2
          foreground: 'hsl(180 7% 60%)', // base1
        },
        popover: {
          DEFAULT: 'hsl(46 42% 88%)', // base2
          foreground: 'hsl(180 7% 60%)', // base1
        },
        card: {
          DEFAULT: 'hsl(44 87% 94%)', // base3
          foreground: 'hsl(196 13% 45%)', // base00
        },
      },
    },
  },
};

export default config;
