"use client"

import { useTheme } from "next-themes"
import { useIsMobile } from "@/hooks/use-mobile"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // 61-g (audit 61-a P2): di mobile (<768px) toast bottom-right full-width
  // menimpa dock navigasi floating + FAB (z-index sonner sangat tinggi,
  // memblokir tap ±4 dtk pada hampir semua aksi). Pindahkan ke top-center
  // di mobile; desktop tetap bottom-right. layout.tsx memanggil <Toaster />
  // tanpa prop position, jadi nilai ini menjadi default yang masih bisa
  // dioverride via props.
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={isMobile ? "top-center" : "bottom-right"}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
