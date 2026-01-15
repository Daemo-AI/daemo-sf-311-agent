"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps {
  children: React.ReactNode
  side?: "left" | "right"
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    if (open) document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onOpenChange])

  if (!mounted) return null

  return (
    <>
      {React.Children.map(children, child => {
        if (React.isValidElement<SheetContentProps>(child) && child.type === SheetContent) {
          return React.cloneElement(child, { open, onOpenChange })
        }
        return child
      })}
    </>
  )
}

export function SheetContent({ 
  children, 
  side = "right", 
  className,
  open,
  onOpenChange 
}: SheetContentProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !open) return null

  const content = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
        style={{ animation: "sheetFadeIn 0.2s ease-out" }}
      />
      
      {/* Sheet Panel */}
      <div
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-card border-l border-border shadow-2xl",
          side === "right" ? "right-0" : "left-0 border-l-0 border-r",
          "w-[400px] max-w-[90vw]",
          className
        )}
        style={{ 
          animation: side === "right" 
            ? "sheetSlideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)" 
            : "sheetSlideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)" 
        }}
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange?.(false)}
          className="absolute right-4 top-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>
        
        {children}
      </div>
      
      <style>{`
        @keyframes sheetFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheetSlideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes sheetSlideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )

  return createPortal(content, document.body)
}

export function SheetHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-6 py-5 border-b border-border", className)}>
      {children}
    </div>
  )
}

export function SheetTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-lg font-semibold text-foreground", className)}>
      {children}
    </h2>
  )
}

export function SheetDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground mt-1", className)}>
      {children}
    </p>
  )
}
