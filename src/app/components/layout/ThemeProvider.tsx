"use client";

import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { initStatus } from "@/hooks/useStatus";
import { restoreMode } from "@/hooks/useMode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { fetchSettings } = useTheme();

  useEffect(() => {
    fetchSettings();
    initStatus();
    restoreMode();
  }, [fetchSettings]);

  return <>{children}</>;
}
