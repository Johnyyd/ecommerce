import { toast, type ToasterProps } from "sonner"

export type ToastType = "success" | "error" | "warning" | "info" | "loading" | "promise"

interface ToastOptions {
  duration?: number
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
}

export function useToast() {
  const showToast = (type: ToastType, message: string, options?: ToastOptions) => {
    const toastOptions: Partial<ToasterProps["toastOptions"]> = {
      duration: options?.duration,
      description: options?.description,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      onDismiss: options?.onDismiss,
    } as Partial<ToasterProps["toastOptions"]>

    switch (type) {
      case "success":
        return toast.success(message, toastOptions)
      case "error":
        return toast.error(message, toastOptions)
      case "warning":
        return toast.warning(message, toastOptions)
      case "info":
        return toast.info(message, toastOptions)
      case "loading":
        return toast.loading(message, toastOptions)
      case "promise":
        return toast.promise(Promise.resolve(), {
          loading: message,
          success: options?.description || "Success",
          error: "Failed",
        })
      default:
        return toast(message, toastOptions)
    }
  }

  const success = (message: string, options?: ToastOptions) => showToast("success", message, options)
  const error = (message: string, options?: ToastOptions) => showToast("error", message, options)
  const warning = (message: string, options?: ToastOptions) => showToast("warning", message, options)
  const info = (message: string, options?: ToastOptions) => showToast("info", message, options)
  const loading = (message: string, options?: ToastOptions) => showToast("loading", message, options)
  const dismiss = (toastId?: string | number) => toast.dismiss(toastId)

  return {
    toast: showToast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
  }
}