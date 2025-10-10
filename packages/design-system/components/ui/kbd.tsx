import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "../../lib/utils"

const kbdVariants = cva(
  "inline-flex items-center justify-center rounded border font-mono text-xs transition-colors",
  {
    variants: {
      variant: {
        default: "border-input bg-muted text-muted-foreground shadow-xs",
        outline: "border-border bg-background text-foreground",
      },
      size: {
        default: "px-2 py-1",
        sm: "px-1.5 py-0.5 text-[10px]",
        lg: "px-2.5 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface KbdProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof kbdVariants> {}

function Kbd({ className, variant, size, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(kbdVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export interface KbdGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

function KbdGroup({ className, ...props }: KbdGroupProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup, kbdVariants }
