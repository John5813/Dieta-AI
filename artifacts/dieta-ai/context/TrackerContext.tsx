import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { normalizeDateKey, todayStr } from "@/lib/date";
import { TRACKER_KEYS } from "@/lib/storageKeys";

/** A food saved for one-tap adding (favorite or user-created). */
export interface SavedFood {
  id: string;
  name: string;
  emoji?: string;
  portion?: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeIngredient {
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** User-made food; a recipe keeps its ingredients and stores per-portion totals. */
export interface CustomFood extends SavedFood {
  ingredients?: RecipeIngredient[];
  /** Portions the ingredient totals were divided into. */
  servings?: number;
}

export interface FastingState {
  /** Epoch ms when the current fast began; absent when not fasting. */
  startedAt?: number;
  targetHours: number;
  history: Array<{ start: number; end: number; targetHours: number }>;
}

export interface BodyMeasurement {
  date: string;
  waist?: number;
  hips?: number;
  chest?: number;
  arm?: number;
  thigh?: number;
  neck?: number;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  uri: string;
  weight?: number;
}

const DEFAULT_FASTING: FastingState = { targetHours: 16, history: [] };

/** Keeps a name-keyed favorite from being saved twice. */
export function foodKey(name: string): string {
  return name.trim().toLowerCase();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** State mirrored to one AsyncStorage key; reloads when AppContext's dataVersion changes. */
function useStored<T>(key: string, initial: T, version: number, normalize?: (raw: T) => T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setValue(initial);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as T;
          setValue(normalize ? normalize(parsed) : parsed);
        } catch {
          setValue(initial);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const update = (updater: (prev: T) => T) => {
    setValue((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  return [value, update] as const;
}

function normalizeDateMap(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (Number.isFinite(v) && v > 0) out[normalizeDateKey(k)] = v;
  }
  return out;
}

interface TrackerContextType {
  waterByDate: Record<string, number>;
  /** Adds (or with a negative value removes) ml of water; never below zero. */
  addWater: (ml: number, date?: string) => void;

  favorites: SavedFood[];
  isFavorite: (name: string) => boolean;
  toggleFavorite: (food: Omit<SavedFood, "id">) => void;

  customFoods: CustomFood[];
  saveCustomFood: (food: Omit<CustomFood, "id"> & { id?: string }) => void;
  removeCustomFood: (id: string) => void;

  fasting: FastingState;
  startFast: (targetHours?: number) => void;
  endFast: () => void;
  setFastTarget: (hours: number) => void;

  measurements: BodyMeasurement[];
  saveMeasurement: (m: BodyMeasurement) => void;
  removeMeasurement: (date: string) => void;

  photos: ProgressPhoto[];
  addPhoto: (p: Omit<ProgressPhoto, "id">) => void;
  removePhoto: (id: string) => void;
}

const TrackerContext = createContext<TrackerContextType | null>(null);

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const { dataVersion } = useApp();
  const [waterByDate, setWater] = useStored<Record<string, number>>(
    TRACKER_KEYS.water,
    {},
    dataVersion,
    normalizeDateMap,
  );
  const [favorites, setFavorites] = useStored<SavedFood[]>(TRACKER_KEYS.favorites, [], dataVersion);
  const [customFoods, setCustomFoods] = useStored<CustomFood[]>(TRACKER_KEYS.customFoods, [], dataVersion);
  const [fasting, setFasting] = useStored<FastingState>(TRACKER_KEYS.fasting, DEFAULT_FASTING, dataVersion);
  const [measurements, setMeasurements] = useStored<BodyMeasurement[]>(
    TRACKER_KEYS.measurements,
    [],
    dataVersion,
  );
  const [photos, setPhotos] = useStored<ProgressPhoto[]>(TRACKER_KEYS.photos, [], dataVersion);

  const addWater = (ml: number, date?: string) => {
    const key = date ?? todayStr();
    setWater((prev) => {
      const next = Math.max(0, Math.round((prev[key] ?? 0) + ml));
      if (next === (prev[key] ?? 0)) return prev;
      const copy = { ...prev };
      if (next === 0) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const isFavorite = (name: string) => favorites.some((f) => foodKey(f.name) === foodKey(name));
  const toggleFavorite = (food: Omit<SavedFood, "id">) => {
    setFavorites((prev) => {
      const k = foodKey(food.name);
      if (prev.some((f) => foodKey(f.name) === k)) return prev.filter((f) => foodKey(f.name) !== k);
      return [{ ...food, id: newId("fav") }, ...prev];
    });
  };

  const saveCustomFood = (food: Omit<CustomFood, "id"> & { id?: string }) => {
    setCustomFoods((prev) => {
      if (food.id && prev.some((f) => f.id === food.id)) {
        return prev.map((f) => (f.id === food.id ? ({ ...food, id: f.id } as CustomFood) : f));
      }
      return [{ ...food, id: newId("cf") } as CustomFood, ...prev];
    });
  };
  const removeCustomFood = (id: string) => setCustomFoods((prev) => prev.filter((f) => f.id !== id));

  const startFast = (targetHours?: number) =>
    setFasting((prev) => ({ ...prev, startedAt: Date.now(), targetHours: targetHours ?? prev.targetHours }));
  const endFast = () =>
    setFasting((prev) => {
      if (!prev.startedAt) return prev;
      const entry = { start: prev.startedAt, end: Date.now(), targetHours: prev.targetHours };
      return { targetHours: prev.targetHours, history: [entry, ...prev.history].slice(0, 60) };
    });
  const setFastTarget = (hours: number) => setFasting((prev) => ({ ...prev, targetHours: hours }));

  const saveMeasurement = (m: BodyMeasurement) =>
    setMeasurements((prev) =>
      [...prev.filter((x) => x.date !== m.date), m].sort((a, b) => (a.date < b.date ? -1 : 1)),
    );
  const removeMeasurement = (date: string) => setMeasurements((prev) => prev.filter((x) => x.date !== date));

  const addPhoto = (p: Omit<ProgressPhoto, "id">) =>
    setPhotos((prev) => [...prev, { ...p, id: newId("ph") }].sort((a, b) => (a.date < b.date ? -1 : 1)));
  const removePhoto = (id: string) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  return (
    <TrackerContext.Provider
      value={{
        waterByDate,
        addWater,
        favorites,
        isFavorite,
        toggleFavorite,
        customFoods,
        saveCustomFood,
        removeCustomFood,
        fasting,
        startFast,
        endFast,
        setFastTarget,
        measurements,
        saveMeasurement,
        removeMeasurement,
        photos,
        addPhoto,
        removePhoto,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker(): TrackerContextType {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error("useTracker must be used inside TrackerProvider");
  return ctx;
}
