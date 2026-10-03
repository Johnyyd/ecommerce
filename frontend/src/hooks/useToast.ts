import { toast, type ToastT, type ToasterProps } from "sonner"

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
    }

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

// Specialized toasts for common use cases
export function useCartToast() {
  const { success, error, warning } = useToast()

  return {
    addedToCart: (productName: string) =>
      success(`${productName} added to cart`, { duration: 3000 }),
    removedFromCart: (productName: string) =>
      success(`${productName} removed from cart`, { duration: 3000 }),
    quantityUpdated: (productName: string, quantity: number) =>
      success(`${productName} quantity updated to ${quantity}`, { duration: 2000 }),
    cartCleared: () =>
      success("Cart cleared", { duration: 3000 }),
    checkoutFailed: (reason?: string) =>
      error("Checkout failed", { description: reason || "Please try again" }),
    holdExpired: () =>
      warning("Your cart hold has expired", {
        description: "Items have been released back to inventory",
        duration: 5000
      }),
  }
}

export function useAuthToast() {
  const { success, error, info } = useToast()

  return {
    loginSuccess: (name?: string) =>
      success("Welcome back!", { description: name ? `Hello, ${name}` : undefined, duration: 3000 }),
    loginFailed: (reason?: string) =>
      error("Login failed", { description: reason || "Invalid credentials" }),
    registerSuccess: () =>
      success("Account created!", { description: "Welcome to our store", duration: 3000 }),
    registerFailed: (reason?: string) =>
      error("Registration failed", { description: reason }),
    logoutSuccess: () =>
      info("You have been logged out", { duration: 3000 }),
    sessionExpired: () =>
      warning("Session expired", { description: "Please log in again", duration: 5000 }),
  }
}

export function useOrderToast() {
  const { success, error, info } = useToast()

  return {
    orderPlaced: (orderId: string) =>
      success("Order placed successfully!", {
        description: `Order #${orderId.slice(0, 8).toUpperCase()}`,
        duration: 5000
      }),
    orderFailed: (reason?: string) =>
      error("Order failed", { description: reason }),
    paymentSuccess: () =>
      success("Payment successful!", { description: "Your order is confirmed", duration: 5000 }),
    paymentFailed: (reason?: string) =>
      error("Payment failed", { description: reason || "Please try a different payment method" }),
    orderCancelled: (orderId: string) =>
      info("Order cancelled", { description: `Order #${orderId.slice(0, 8).toUpperCase()}`, duration: 3000 }),
  }
}

export function useProductToast() {
  const { success, error } = useToast()

  return {
    created: (productName: string) =>
      success(`${productName} created successfully`, { duration: 3000 }),
    updated: (productName: string) =>
      success(`${productName} updated successfully`, { duration: 3000 }),
    deleted: (productName: string) =>
      success(`${productName} deleted`, { duration: 3000 }),
    createFailed: (reason?: string) =>
      error("Failed to create product", { description: reason }),
    updateFailed: (reason?: string) =>
      error("Failed to update product", { description: reason }),
    deleteFailed: (reason?: string) =>
      error("Failed to delete product", { description: reason }),
  }
}