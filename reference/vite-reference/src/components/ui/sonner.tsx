"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// NOTE: We intentionally do NOT depend on `next-themes` here.
// In the Vite + Cloudflare preview sandbox, pulling `next-themes` into the
// optimized-deps graph can resolve React to `null`, causing a hard
// "Cannot read properties of null (reading 'useContext')" crash that takes
// down the entire generated app on mount. Reading the active theme directly
// from the document element (the same `dark` class Tailwind uses) keeps the
// Toaster theme-aware without that fragile dependency.
function useDocumentTheme(): ToasterProps["theme"] {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("system")

  useEffect(() => {
    if (typeof document === "undefined") return

    const read = (): ToasterProps["theme"] =>
      document.documentElement.classList.contains("dark") ? "dark" : "light"

    setTheme(read())

    const observer = new MutationObserver(() => setTheme(read()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
