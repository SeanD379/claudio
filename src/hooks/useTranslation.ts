"use client";

import { useTheme } from "./useTheme";
import { t, tArr, type TranslationKey, type Lang } from "@/i18n/translations";

export function useTranslation() {
  const lang = useTheme((s) => s.language) as Lang;

  return {
    lang,
    t: (key: TranslationKey, param?: number | Record<string, string>) =>
      t(key, lang, param as never),
    tArr: (key: TranslationKey) => tArr(key, lang),
  };
}
