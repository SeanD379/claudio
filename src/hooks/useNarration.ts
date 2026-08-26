"use client";

import { useEffect, useRef } from "react";
import { usePlayer, type Song } from "./usePlayer";
import { useTheme } from "./useTheme";
import { useTTS } from "./useTTS";

interface NarrationResult {
  narration: string;
}

function isNarrationComplete(text: string): boolean {
  if (!text || text.length < 10) return false;
  const lastChar = text.trim().slice(-1);
  return /[。！？.!?]/.test(lastChar);
}

// 从 MySQL 获取已存储的旁白
async function getStoredNarration(songId: string, language: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/narration?songId=${songId}&language=${language}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.narration || null;
  } catch {
    return null;
  }
}

// 保存旁白到 MySQL
async function saveNarration(song: Song, content: string, language: string, context?: string): Promise<void> {
  try {
    await fetch("/api/narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        songId: song.neteaseId,
        content,
        language,
        context,
        title: song.title,
        artist: song.artist,
        album: song.album,
        coverUrl: song.coverUrl,
      }),
    });
  } catch (err) {
    console.error("[旁白] 保存旁白失败:", err);
  }
}

// 生成旁白（调用 mimo 模型，带重试）
async function generateNarration(song: Song, language: "zh" | "en", retries = 2): Promise<string | null> {
  try {
    const hour = new Date().getHours();
    let timeContext = "";
    if (hour >= 0 && hour < 6) timeContext = "深夜";
    else if (hour >= 6 && hour < 12) timeContext = "上午";
    else if (hour >= 12 && hour < 18) timeContext = "下午";
    else timeContext = "晚上";

    console.log("[旁白] 生成旁白:", song.title, "语言:", language, "时段:", timeContext);
    const res = await fetch("/api/chat/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: song.title,
        artist: song.artist,
        album: song.album,
        language,
        timeContext,
      }),
    });

    if (res.status === 429 && retries > 0) {
      console.log("[旁白] API 限流，1秒后重试...");
      await new Promise(r => setTimeout(r, 1000));
      return generateNarration(song, language, retries - 1);
    }

    if (!res.ok) {
      console.error("[旁白] API 返回错误:", res.status);
      return null;
    }
    const data: NarrationResult = await res.json();
    const narration = data.narration || null;
    if (narration && !isNarrationComplete(narration)) {
      console.warn("[旁白] 旁白不完整，丢弃:", narration.substring(0, 50));
      return null;
    }
    console.log("[旁白] 生成旁白成功:", narration?.substring(0, 50));
    return narration;
  } catch (err) {
    console.error("[旁白] API 请求失败:", err);
    return null;
  }
}

async function fetchTTSAudio(text: string, language: "zh" | "en"): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// 内存旁白缓存（跨组件生命周期）
const narrationCache = new Map<string, string>();
const ttsCache = new Map<string, string>();
const fetchingSet = new Set<string>();

// 限制 TTS 缓存大小，防止内存泄漏
const TTS_CACHE_MAX = 10;
function setTTSCache(key: string, url: string) {
  // 如果缓存满了，删除最早的条目并 revoke URL
  if (ttsCache.size >= TTS_CACHE_MAX) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey) {
      const oldUrl = ttsCache.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      ttsCache.delete(firstKey);
    }
  }
  ttsCache.set(key, url);
}

function cacheKey(id: string, lang: string) {
  return `${id}:${lang}`;
}

// 预缓存单首歌的旁白 + TTS（异步，不阻塞）
async function prefetchOne(song: Song, lang: "zh" | "en") {
  // 旁白功能禁用时跳过预缓存
  if (!useTheme.getState().narrationEnabled) {
    return;
  }

  const id = song.neteaseId;
  const key = cacheKey(id, lang);

  if (narrationCache.has(key)) return;
  if (fetchingSet.has(key)) return;
  fetchingSet.add(key);

  try {
    // 1. 查 MySQL
    const stored = await getStoredNarration(id, lang);
    if (stored) {
      narrationCache.set(key, stored);
      // 异步缓存 TTS
      fetchTTSAudio(stored, lang).then((url) => {
        if (url) setTTSCache(key, url);
      });
      return;
    }

    // 2. 生成新的
    const text = await generateNarration(song, lang);
    if (text) {
      narrationCache.set(key, text);
      saveNarration(song, text, lang, `时段:${new Date().getHours()}h`).catch(() => {});
      // 异步缓存 TTS
      fetchTTSAudio(text, lang).then((url) => {
        if (url) setTTSCache(key, url);
      });
    }
  } catch (e) {
    console.warn("[旁白] 预缓存失败:", song.title, e);
  } finally {
    fetchingSet.delete(key);
  }
}

// 批量预缓存
function prefetchSongs(songs: Song[], lang: "zh" | "en") {
  for (const song of songs) {
    prefetchOne(song, lang);
  }
}

export function useNarration(
  onNarration: (song: Song, narration: string) => void
) {
  const onNarrationRef = useRef(onNarration);
  onNarrationRef.current = onNarration;
  const lastPrefetchSongId = useRef<string | null>(null);

  // 注册 beforePlay — 始终阻塞，旁白先播再放音乐
  useEffect(() => {
    console.log("[旁白] 注册 beforePlay 回调");

    const beforePlay = async (song: Song) => {
      if (!useTheme.getState().narrationEnabled) {
        console.log("[旁白] 旁白已禁用，跳过");
        return;
      }
      if (useTheme.getState().quickSwitch) {
        console.log("[旁白] 快速切歌模式，跳过旁白");
        return;
      }

      const id = song.neteaseId;
      const lang = useTheme.getState().language;
      const key = cacheKey(id, lang);

      // 1. 检查内存缓存
      let narration = narrationCache.get(key) || null;

      // 2. 没有则查 MySQL
      if (!narration) {
        try {
          narration = await getStoredNarration(id, lang);
          if (narration) {
            narrationCache.set(key, narration);
          }
        } catch (e) {
          console.warn("[旁白] MySQL 查询失败:", e);
        }
      }

      // 3. 还没有则生成
      if (!narration) {
        console.log("[旁白] 缓存未命中，生成旁白:", song.title);
        narration = await generateNarration(song, lang);
        if (narration) {
          narrationCache.set(key, narration);
          saveNarration(song, narration, lang, `时段:${new Date().getHours()}h`).catch(() => {});
        }
      } else {
        console.log("[旁白] 缓存命中:", song.title);
      }

      if (!narration) {
        console.log("[旁白] 无旁白内容，跳过:", song.title);
        return;
      }

      // 4. 显示旁白 + 播放 TTS
      console.log("[旁白] 显示旁白:", song.title);
      onNarrationRef.current(song, narration);

      try {
        // 优先用缓存的 TTS 音频
        const cachedAudio = ttsCache.get(key);
        if (cachedAudio) {
          console.log("[旁白] TTS 缓存命中:", song.title);
          await useTTS.getState().speakAndWaitWithAudio(cachedAudio);
        } else {
          console.log("[旁白] TTS 请求 API:", song.title);
          await useTTS.getState().speakAndWait(narration, lang);
        }
        console.log("[旁白] TTS 播放完成:", song.title);
      } catch (e) {
        console.warn("[旁白] TTS 播放失败，继续播放音乐:", e);
      }
    };

    usePlayer.getState().setBeforePlay(beforePlay);
    console.log("[旁白] beforePlay 已注册到 store");

    return () => {
      console.log("[旁白] beforePlay 已移除");
      usePlayer.getState().setBeforePlay(null);
    };
  }, []);

  // 监听 currentSong 变化，预缓存后面 5 首歌的旁白
  useEffect(() => {
    return usePlayer.subscribe((state) => {
      const { currentSong, playlist } = state;
      if (!currentSong || playlist.length === 0) return;

      // 快速去重：只在 currentSong 真正变化时触发
      const songId = currentSong.neteaseId;
      if (songId === lastPrefetchSongId.current) return;
      lastPrefetchSongId.current = songId;

      const idx = playlist.findIndex(
        (s) => s.neteaseId === currentSong.neteaseId
      );
      if (idx === -1) return;

      const lang = useTheme.getState().language;
      const upcoming: Song[] = [];
      for (let i = 1; i <= 5; i++) {
        const next = playlist[(idx + i) % playlist.length];
        if (next) upcoming.push(next);
      }
      console.log("[旁白] 预缓存", upcoming.length, "首歌的旁白");
      prefetchSongs(upcoming, lang);
    });
  }, []);
}
