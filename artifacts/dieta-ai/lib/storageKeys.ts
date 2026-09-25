/** AsyncStorage keys owned by AppContext. */
export const CORE_KEYS = [
  "onboarding_complete",
  "user_profile",
  "subscription",
  "diary_entries",
  "burned_by_date",
  "ratsion_plan",
  "exercise_plan",
  "weight_log",
] as const;

/** AsyncStorage keys owned by TrackerContext. */
export const TRACKER_KEYS = {
  water: "water_by_date",
  favorites: "favorite_foods",
  customFoods: "custom_foods",
  fasting: "fasting_state",
  measurements: "body_measurements",
  photos: "progress_photos",
  steps: "steps_by_date",
} as const;

export const ALL_DATA_KEYS: string[] = [...CORE_KEYS, ...Object.values(TRACKER_KEYS)];

/** Backup code and bookkeeping; wiped on reset so an empty app never overwrites the cloud copy. */
export const BACKUP_META_KEYS = ["backup_code", "backup_meta"] as const;
