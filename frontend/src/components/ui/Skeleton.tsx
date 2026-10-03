import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type SkeletonVariant = "text" | "circular" | "rectangular" | "image"
export type SkeletonAnimation = "pulse" | "shimmer" | "none"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
  animation?: SkeletonAnimation
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({
  className,
  variant = "rectangular",
  animation = "shimmer",
  width,
  height,
  lines,
  ...props
}: SkeletonProps) {
  const baseClasses = "rounded-lg transition-colors"

  const variantClasses = {
    text: "h-4 w-full max-w-xs",
    circular: "rounded-full",
    rectangular: "rounded-lg",
    image: "rounded-xl",
  }

  const animationClasses = {
    pulse: "animate-pulse",
    shimmer: "skeleton-shimmer",
    none: "",
  }

  const style: React.CSSProperties = {
    width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height: height ? (typeof height === "number" ? `${height}px` : height) : undefined,
  }

  if (lines && variant === "text") {
    return (
      <div className={cn(baseClasses, className)} style={style} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              variantClasses[variant],
              animationClasses[animation],
              "bg-zinc-200/80 dark:bg-zinc-800/80",
              i === lines - 1 && "max-w-[60%]"
            )}
            style={{ width: i === lines - 1 ? undefined : "100%" }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="skeleton"
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        "bg-zinc-200/80 dark:bg-zinc-800/80",
        className
      )}
      style={style}
      {...props}
    />
  )
}

// Pre-built skeleton patterns for common UI components

export function ProductCardSkeleton() {
  return (
    <div className="group flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      <Skeleton variant="image" className="aspect-square w-full" />
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <Skeleton variant="text" lines={1} />
        <Skeleton variant="text" lines={1} className="max-w-[60%]" />
        <div className="flex items-center justify-between mt-auto pt-2">
          <Skeleton variant="text" className="w-24 h-6" />
          <Skeleton variant="circular" className="w-10 h-10" />
        </div>
      </div>
    </div>
  )
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <Skeleton variant="circular" className="w-14 h-14" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="circular" className="w-10 h-10" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rectangular" className="p-6 h-24" />
        ))}
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function ButtonSkeleton() {
  return (
    <Skeleton variant="rectangular" className="h-10 w-32 min-h-touch min-w-touch" />
  )
}

export function ImageSkeleton({ aspectRatio = "1/1" }: { aspectRatio?: string }) {
  return (
    <div className={`aspect-[${aspectRatio}] w-full`}>
      <Skeleton variant="image" className="w-full h-full" />
    </div>
  )
}