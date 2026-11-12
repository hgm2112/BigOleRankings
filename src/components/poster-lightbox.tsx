"use client"

import { useState } from "react"
import Image from "next/image"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface PosterLightboxProps {
  posterPath: string | null | undefined
  alt: string
  children: React.ReactNode
  className?: string
}

export function PosterLightbox({ posterPath, alt, children, className }: PosterLightboxProps) {
  const [open, setOpen] = useState(false)

  if (!posterPath) {
    return <>{children}</>
  }

  const src = `https://image.tmdb.org/t/p/w780${posterPath}`

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn("cursor-zoom-in", className)}
        aria-label={`View poster for ${alt}`}
      >
        {children}
      </button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 outline-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
          >
            <DialogPrimitive.Title className="sr-only">{alt} poster</DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="absolute right-4 top-4 z-[60] rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus:outline-hidden focus:ring-2 focus:ring-white"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </DialogPrimitive.Close>
            <div
              className="relative h-full max-h-[85vh] w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 768px) 90vw, 800px"
                quality={90}
                className="object-contain"
                priority
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}