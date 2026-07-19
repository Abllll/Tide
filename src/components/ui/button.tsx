import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.35rem] text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b9bc0]/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-white/50 bg-gradient-to-br from-[#d7f5f3]/80 via-[#80d2e6]/72 to-[#398bb7]/72 text-white shadow-[0_10px_25px_rgba(67,157,192,.2),inset_0_1px_1px_rgba(255,255,255,.8)] backdrop-blur-md hover:-translate-y-0.5",
        destructive: "bg-[#e98979] text-white shadow-[0_10px_22px_rgba(210,98,80,.25)] hover:-translate-y-0.5",
        outline: "border border-white/70 bg-white/65 shadow-[0_8px_20px_rgba(81,151,182,.13)] hover:bg-white",
        secondary: "bg-gradient-to-br from-[#f6d5ae] via-[#c7edf0] to-[#90cfe5] text-[#174769] shadow-[0_8px_20px_rgba(81,151,182,.18)] hover:-translate-y-0.5",
        ghost: "bg-white/45 hover:bg-white/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3.5",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
