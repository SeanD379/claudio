"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface SongItem {
  title: string;
  artist: string;
}

interface SongListProps {
  songs: SongItem[];
  onPlaySong: (song: SongItem) => void;
  onPlayAll: () => void;
  onRegenerate: () => void;
}

const VISIBLE_COUNT = 5;
const EXPANDED_MAX_H = "max-h-[260px]";

function SongRow({ song, index, onPlay }: { song: SongItem; index: number; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-elevated transition-colors text-left group/song"
    >
      <span className="w-5 text-xs text-text-muted text-center flex-shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate text-text-primary">
          {song.title}
        </p>
        <p className="text-xs text-text-secondary truncate">{song.artist}</p>
      </div>
      <Play className="w-3.5 h-3.5 text-text-muted flex-shrink-0 opacity-0 group-hover/song:opacity-100 transition-opacity" />
    </button>
  );
}

export function SongList({ songs, onPlaySong, onPlayAll, onRegenerate }: SongListProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = songs.length - VISIBLE_COUNT;
  const showList = expanded ? songs : songs.slice(0, VISIBLE_COUNT);

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--divider)' }}>
      {/* Song list */}
      <div className={expanded ? `${EXPANDED_MAX_H} overflow-y-auto` : ""}>
        <div className="space-y-0.5">
          {showList.map((song, i) => (
            <SongRow
              key={`${song.title}-${song.artist}-${i}`}
              song={song}
              index={i}
              onPlay={() => onPlaySong(song)}
            />
          ))}
        </div>
      </div>

      {/* Expand/Collapse */}
      {songs.length > VISIBLE_COUNT && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              {t("chat.showLess")}
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              {t("chat.showMore", hiddenCount)}
            </>
          )}
        </button>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <motion.button
          onClick={onPlayAll}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-accent text-text-on-accent text-xs font-medium hover:bg-accent-hover transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          {t("chat.playAll")}
        </motion.button>
        <motion.button
          onClick={onRegenerate}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-elevated text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("chat.regenerate")}
        </motion.button>
      </div>
    </div>
  );
}
