import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-black/5 ring-1 ring-black/5 p-1.5 rounded-[2rem]",
          className
        )}
        {...props}
      >
        <div className="bg-white rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] h-full overflow-hidden">
          {children}
        </div>
      </div>
    )
  }
)
Card.displayName = "Card"

export { Card }
