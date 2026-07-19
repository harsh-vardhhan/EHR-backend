/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type ToastType = "success" | "error" | "info" | "warning"

interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

// Global listeners
let listeners: ((toasts: ToastItem[]) => void)[] = []
let toasts: ToastItem[] = []

const notify = () => {
  listeners.forEach((listener) => listener([...toasts]))
}

export const toast = {
  success(message: string, duration = 3000) {
    this.show(message, "success", duration)
  },
  error(message: string, duration = 3000) {
    this.show(message, "error", duration)
  },
  info(message: string, duration = 3000) {
    this.show(message, "info", duration)
  },
  warning(message: string, duration = 3000) {
    this.show(message, "warning", duration)
  },
  show(message: string, type: ToastType = "info", duration = 3000) {
    const id = Math.random().toString(36).substring(2, 9)
    const item: ToastItem = { id, message, type, duration }
    toasts.push(item)
    notify()

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id)
      notify()
    }, duration)
  },
}

export function Toaster() {
  const [activeToasts, setActiveToasts] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    const listener = (newToasts: ToastItem[]) => {
      setActiveToasts(newToasts)
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  if (activeToasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {activeToasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 p-4 rounded-md shadow-md text-sm border font-medium transition-all pointer-events-auto max-w-sm ${
            t.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300"
              : t.type === "error"
              ? "bg-destructive/10 border-destructive/20 text-destructive dark:bg-destructive/20 dark:border-destructive/30 dark:text-red-300"
              : t.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300"
              : "bg-background border-border text-foreground"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
export default toast
