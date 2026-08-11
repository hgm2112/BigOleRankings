export interface CustomizationPrefs {
  score_chips: boolean
  media_badges: boolean
  stat_chips: boolean
  bg_gradient: boolean
}

export const DEFAULT_CUSTOMIZATION: CustomizationPrefs = {
  score_chips: true,
  media_badges: true,
  stat_chips: true,
  bg_gradient: true,
}

export function mergeCustomization(value: Partial<CustomizationPrefs> | null | undefined): CustomizationPrefs {
  return {
    score_chips: value?.score_chips ?? DEFAULT_CUSTOMIZATION.score_chips,
    media_badges: value?.media_badges ?? DEFAULT_CUSTOMIZATION.media_badges,
    stat_chips: value?.stat_chips ?? DEFAULT_CUSTOMIZATION.stat_chips,
    bg_gradient: value?.bg_gradient ?? DEFAULT_CUSTOMIZATION.bg_gradient,
  }
}
