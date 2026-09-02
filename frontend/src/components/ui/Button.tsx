import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { motion, HTMLMotionProps } from "motion/react"

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref"> {
  asChild?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    // Use motion wrapper if not asChild to allow easy hover physics
    if (asChild) {
      return (
        <Comp
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-zinc-950 text-white px-6 py-3 font-medium transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none group",
            className
          )}
          ref={ref as any}
          {...(props as any)}
        >
          {children as React.ReactNode}
        </Comp>
      )
    }

    return (
      <motion.button
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-zinc-950 text-white px-6 py-3 font-medium transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none group active:scale-[0.98]",
          className
        )}
        whileTap={{ scale: 0.98 }}
        ref={ref as any}
        {...props}
      >
        <span className="mr-2">{children as React.ReactNode}</span>
        {icon && (
          <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-apple ease-apple group-hover:translate-x-1 group-hover:-translate-y-[1px] group-hover:scale-105">
            {icon as React.ReactNode}
          </span>
        )}
      </motion.button>
    )
  }
)
Button.displayName = "Button"

export { Button }
