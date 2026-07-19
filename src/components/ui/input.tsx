import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[1.35rem] border border-white/80 bg-white/72 px-4 py-2 text-sm shadow-[0_10px_24px_rgba(71,151,187,.15),inset_0_1px_1px_rgba(255,255,255,.9)] backdrop-blur-sm placeholder:text-[#658399] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63b8d5]/60 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
