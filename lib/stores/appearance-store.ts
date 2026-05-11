"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density  = "comfortable" | "compact";
export type FontSize = "xs" | "sm" | "md" | "lg";

interface AppearanceState {
  density:  Density;
  fontSize: FontSize;
  setDensity:  (d: Density)  => void;
  setFontSize: (f: FontSize) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      density:  "comfortable",
      fontSize: "sm",
      setDensity:  (density)  => set({ density }),
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    { name: "bajaj-appearance" }
  )
);
