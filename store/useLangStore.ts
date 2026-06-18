import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "ko" | "en";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

// 선택한 언어를 로컬스토리지에 보관 (새로고침해도 유지)
export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "ko",
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === "ko" ? "en" : "ko" }),
    }),
    { name: "netflix-lang-storage" },
  ),
);

// 푸터 표시 라벨 ↔ 내부 코드 매핑
export const LANG_LABELS: Record<Lang, string> = {
  ko: "한국어",
  en: "English",
};

export const labelToLang = (label: string): Lang =>
  label === "English" ? "en" : "ko";
