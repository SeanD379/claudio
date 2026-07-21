"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMode, type AppMode } from "@/hooks/useMode";
import { useNavigation } from "@/hooks/useNavigation";
import { Headphones, Mic, Home } from "lucide-react";

const modes = [
  { id: "listen" as AppMode, label: "听歌", icon: Headphones },
  { id: "ktv" as AppMode, label: "KTV", icon: Mic },
  { id: "home" as const, label: "回到主页", icon: Home },
];

export function ModeSwitcher() {
  const router = useRouter();
  const { mode, setMode, setShowHall } = useMode();
  const { popSourceModule } = useNavigation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleClick = (id: string) => {
    if (id === "home") {
      // 检查是否有来源模块可以返回
      const sourceModule = popSourceModule();
      if (sourceModule && sourceModule !== "home") {
        // 返回到来源模块
        if (sourceModule === "calendar") {
          router.push("/calendar");
          return;
        } else if (sourceModule === "daily") {
          router.push("/recommend/daily");
          return;
        }
      }
      // 默认回到主页
      setMode("listen");
      setShowHall(true);
      localStorage.setItem("claudio-mode", "listen");
      return;
    }
    setMode(id as AppMode);
    if (id === "ktv") setShowHall(false);
  };

  return (
    <div className="relative">
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {modes.map((item) => {
          const isActive = mode === item.id;
          const isHovered = hoveredId === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-200"
              style={{
                color: isActive || isHovered
                  ? "#ffffff"
                  : "rgba(255, 255, 255, 0.6)",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.02em",
              }}
            >
              {(isActive || isHovered) && (
                <motion.div
                  layoutId="mode-active-bg"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: isActive
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(255, 255, 255, 0.08)",
                    boxShadow: isActive
                      ? "0 0 12px rgba(255, 255, 255, 0.1)"
                      : "none",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={14} className="relative z-10" />
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="mode-active-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                  style={{ background: "rgba(255, 255, 255, 0.8)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
