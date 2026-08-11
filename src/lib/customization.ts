export interface CustomizationPrefs {
  score_chips: boolean
  media_badges: boolean
  stat_chips: boolean
  background: string
}

export const DEFAULT_CUSTOMIZATION: CustomizationPrefs = {
  score_chips: true,
  media_badges: true,
  stat_chips: true,
  background: "black",
}

export function mergeCustomization(value: Partial<CustomizationPrefs> | null | undefined): CustomizationPrefs {
  return {
    score_chips: value?.score_chips ?? DEFAULT_CUSTOMIZATION.score_chips,
    media_badges: value?.media_badges ?? DEFAULT_CUSTOMIZATION.media_badges,
    stat_chips: value?.stat_chips ?? DEFAULT_CUSTOMIZATION.stat_chips,
    background: value?.background ?? DEFAULT_CUSTOMIZATION.background,
  }
}

export const BACKGROUND_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: "black", label: "Black", color: "#000000" },
  { key: "charcoal", label: "Charcoal", color: "oklch(0.24 0.015 260)" },
  { key: "navy", label: "Navy", color: "oklch(0.22 0.055 255)" },
  { key: "purple", label: "Deep Purple", color: "oklch(0.22 0.06 290)" },
  { key: "teal", label: "Dark Teal", color: "oklch(0.21 0.05 195)" },
]
