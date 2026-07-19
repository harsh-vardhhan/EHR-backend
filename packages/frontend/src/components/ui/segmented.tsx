import * as React from "react"
import { cn } from "../../lib/utils"

interface Option {
  label: React.ReactNode
  value: string
}

interface SegmentedProps {
  options: (Option | string)[]
  value: string
  onChange: (value: string) => void
  block?: boolean
  size?: "small" | "default" | "large"
  className?: string
}

export function Segmented({
  options,
  value,
  onChange,
  block = false,
  size = "default",
  className,
}: SegmentedProps) {
  const normOptions = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  )

  return (
    <div
      className={cn(
        "h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground select-none",
        block ? "flex w-full" : "inline-flex",
        size === "small" && "h-7 text-[10px]",
        size === "large" && "h-11 text-base",
        className
      )}
    >
      {normOptions.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
              block && "flex-1 min-w-0",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-background/50 hover:text-foreground/80",
              size === "small" ? "px-1.5 py-0.5 text-[10px]" : size === "large" ? "px-4 py-1.5 text-base" : "px-3 py-1 text-xs"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
export default Segmented
