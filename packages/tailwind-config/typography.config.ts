const typographyConfig = (theme: (path: string) => string) => ({
  DEFAULT: {
          css: {
            color: "var(--foreground) ",
            h1: {
              color: "var(--foreground)",
            },
            h2: {
              color: "var(--foreground)",
            },
            h3: {
              color: "var(--foreground)",
            },
            strong: {
              color: "var(--foreground)",
            },
            a: {
              color: "var(--foreground)",
              "&:hover": {
                color: "var(--foreground)",
              },
            },
          },
        },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
});

export default typographyConfig;
