"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { CustomizationPrefs, DEFAULT_CUSTOMIZATION, BACKGROUND_OPTIONS } from "@/lib/customization"

interface CustomizationContextValue {
  prefs: CustomizationPrefs
  setPrefs: (prefs: CustomizationPrefs) => void
}

const CustomizationContext = createContext<CustomizationContextValue>({
  prefs: DEFAULT_CUSTOMIZATION,
  setPrefs: () => {},
})

export function useCustomization() {
  return useContext(CustomizationContext)
}

export function CustomizationProvider({
  prefs: initialPrefs,
  children,
}: {
  prefs: CustomizationPrefs
  children: React.ReactNode
}) {
  const [prefs, setPrefs] = useState<CustomizationPrefs>(initialPrefs)

  useEffect(() => {
    const html = document.documentElement
    for (const bg of BACKGROUND_OPTIONS) {
      html.classList.remove(`bg-${bg.key}`)
    }
    if (prefs.background !== "black") {
      html.classList.add(`bg-${prefs.background}`)
    }
  }, [prefs.background])

  return (
    <CustomizationContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </CustomizationContext.Provider>
  )
}
