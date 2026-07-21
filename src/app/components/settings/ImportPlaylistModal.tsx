"use client";

import { useEffect, useState } from "react";
import { X, Music, Check, Loader2, Link, Search, User } from "lucide-react";
import {
  usePlaylists,
  ImportablePlaylist,
} from "@/hooks/usePlaylists";
import { useTranslation } from "@/hooks/useTranslation";
import NeteaseQrLogin from "./NeteaseQrLogin";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabMode = "mine" | "file" | "netease";

export default function ImportPlaylistModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<TabMode>("mine");
  const [available, setAvailable] = useState<ImportablePlaylist[]>([]);
  const [neteasePlaylists, setNeteasePlaylists] = useState<ImportablePlaylist[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { fetchImportable, fetchNeteasePlaylists, importFromExport, importFromNetease } = usePlaylists();
  const { t } = useTranslation();

  const [neteaseUrl, setNeteaseUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSelected(new Set());
    setError("");
    setNeedsLogin(false);

    if (tab === "file") {
      setFetching(true);
      fetchImportable()
        .then((list) => { setAvailable(list); })
        .catch(() => { setAvailable([]); })
        .finally(() => { setFetching(false); });
    } else if (tab === "mine") {
      setFetching(true);
      fetch("/api/user/playlists/netease-mine")
        .then(async (res) => {
          if (res.status === 401) {
            setNeedsLogin(true);
            setNeteasePlaylists([]);
            return;
          }
          if (res.ok) {
            const data = await res.json();
            setNeteasePlaylists(data.playlists || []);
            setNeedsLogin(false);
          }
        })
        .catch(() => { setNeteasePlaylists([]); })
        .finally(() => { setFetching(false); });
    }
  }, [isOpen, tab, fetchImportable]);

  if (!isOpen) return null;

  const handleLoginSuccess = () => {
    setTimeout(() => {
      setFetching(true);
      fetch("/api/user/playlists/netease-mine")
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setNeteasePlaylists(data.playlists || []);
            setNeedsLogin(false);
          }
        })
        .catch(() => {})
        .finally(() => { setFetching(false); });
    }, 500);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportFromFile = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await importFromExport(Array.from(selected));
      onClose();
    } catch {
      // error handled silently — user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleImportSelectedNetease = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      for (const id of selected) {
        await importFromNetease(id.toString());
      }
      onClose();
    } catch {
      // error handled silently — user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromUrl = async () => {
    setError("");
    if (!neteaseUrl.trim()) {
      setError(t("import.enterLink"));
      return;
    }

    let playlistId = neteaseUrl.trim();
    const urlMatch = playlistId.match(/playlist[?&]id=(\d+)/);
    if (urlMatch) {
      playlistId = urlMatch[1];
    }
    if (!/^\d+$/.test(playlistId)) {
      setError(t("import.invalidId"));
      return;
    }

    setImporting(true);
    try {
      await importFromNetease(playlistId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("import.importFailed"));
    } finally {
      setImporting(false);
    }
  };

  const renderPlaylistItem = (pl: ImportablePlaylist, showCheckbox: boolean = true) => {
    const isSelected = selected.has(pl.playlistId);
    return (
      <button
        key={pl.playlistId}
        disabled={pl.imported}
        onClick={() => showCheckbox && toggleSelect(pl.playlistId)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
          pl.imported
            ? "border-border-custom opacity-50 cursor-not-allowed"
            : isSelected
            ? "border-accent bg-accent/10"
            : "border-border-custom hover:border-border-active"
        }`}
      >
        {showCheckbox && (
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
              pl.imported
                ? "border-text-muted bg-surface-elevated"
                : isSelected
                ? "border-accent bg-accent"
                : "border-text-muted"
            }`}
          >
            {(pl.imported || isSelected) && (
              <Check
                className={`w-3 h-3 ${
                  pl.imported
                    ? "text-text-muted"
                    : "text-text-on-accent"
                }`}
              />
            )}
          </div>
        )}
        {pl.coverUrl && (
          <img
            src={pl.coverUrl}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {pl.name}
          </p>
          <p className="text-xs text-text-secondary">
            {t("playlist.songCount", pl.trackCount)}
            {pl.creator && ` · ${pl.creator}`}
            {pl.imported && t("import.imported")}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: 'var(--overlay)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2
            className="text-lg font-normal text-text-primary"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t("import.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
          {(["mine", "file", "netease"] as TabMode[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === tabKey
                  ? "text-accent border-b-2 border-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tabKey === "mine" ? t("import.myPlaylists") : tabKey === "file" ? t("import.localImport") : t("import.linkImport")}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "mine" ? (
            fetching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
              </div>
            ) : needsLogin ? (
              <div className="py-4">
                <p className="text-sm text-center mb-4 text-text-secondary">
                  {t("import.loginHint")}
                </p>
                <NeteaseQrLogin onLoginSuccess={handleLoginSuccess} />
              </div>
            ) : neteasePlaylists.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{t("import.noPlaylists")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {neteasePlaylists.map((pl) => renderPlaylistItem(pl))}
              </div>
            )
          ) : tab === "file" ? (
            fetching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
              </div>
            ) : available.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{t("import.noAvailable")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {available.map((pl) => renderPlaylistItem(pl))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t("import.linkLabel")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={neteaseUrl}
                    onChange={(e) => {
                      setNeteaseUrl(e.target.value);
                      setError("");
                    }}
                    placeholder={t("import.linkPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl border border-border-custom bg-surface-elevated text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-border-active"
                  />
                  <Link className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                </div>
                {error && (
                  <p className="mt-2 text-sm text-accent">{error}</p>
                )}
              </div>

              <div className="bg-surface-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-2">
                  {t("import.supportedFormats")}
                </h3>
                <ul className="text-xs text-text-muted space-y-1">
                  <li>{t("import.formatExample1")}</li>
                  <li>{t("import.formatExample2")}</li>
                </ul>
              </div>

              <div className="bg-accent/5 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Search className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-text-secondary">
                    {t("import.anyPlaylistHint")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6" style={{ borderTop: '1px solid var(--border)' }}>
          {tab === "netease" ? (
            <button
              onClick={handleImportFromUrl}
              disabled={!neteaseUrl.trim() || importing}
              className="w-full py-3 px-4 rounded-xl bg-accent text-text-on-accent font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("import.importing")}
                </>
              ) : (
                t("import.title")
              )}
            </button>
          ) : (
            <button
              onClick={tab === "file" ? handleImportFromFile : handleImportSelectedNetease}
              disabled={selected.size === 0 || loading}
              className="w-full py-3 px-4 rounded-xl bg-accent text-text-on-accent font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("import.importing")}
                </>
              ) : (
                t("import.importSelected", selected.size)
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
