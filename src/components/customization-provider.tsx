"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { CustomizationPrefs, DEFAULT_CUSTOMIZATION } from "@/lib/customization"

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
    document.documentElement.classList.toggle("bg-gradient", prefs.bg_gradient)
  }, [prefs.bg_gradient])

  return (
    <CustomizationContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </CustomizationContext.Provider>
  )
}
