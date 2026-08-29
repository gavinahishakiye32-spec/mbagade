"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Search, Upload, Play, Pause } from "lucide-react";
import type { SoundView } from "@/types";
import { apiFetch } from "@/components/api-client";
import { Button, Input, Modal, Spinner, toast } from "@/components/ui";
import { formatCount } from "@/lib/utils";

interface SoundPickerProps {
  open: boolean;
  onClose: () => void;
  selected: string | null;
  onSelect: (sound: SoundView | null) => void;
}

/**
 * TikTok-style sound library picker. Browse + preview platform sounds, or
 * upload your own audio clip and register it for everyone to use.
 */
export function SoundPicker({ open, onClose, selected, onSelect }: SoundPickerProps) {
  const [query, setQuery] = useState("");
  const [sounds, setSounds] = useState<SoundView[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async (reset = false, nextCursor?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: "20" });
      if (query) p.set("q", query);
      if (nextCursor) p.set("cursor", nextCursor);
      const d = await apiFetch<{ items: SoundView[]; nextCursor: string | null }>(`/api/sounds?${p}`);
      setSounds((prev) => (reset ? d.items : [...prev, ...d.items]));
      setCursor(d.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePreview = (sound: SoundView) => {
    if (playingId === sound.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    audioRef.current = new Audio(sound.audioUrl);
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.play().catch(() => {});
    setPlayingId(sound.id);
  };

  const choose = (sound: SoundView) => {
    onSelect(sound);
    onClose();
  };

  const uploadOwn = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "sounds");
      const upload = await apiFetch<{ key: string }>("/api/media/upload", { method: "POST", body: form });
      const defaultTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "My sound";
      const sound = await apiFetch<SoundView>(`/api/sounds`, {
        method: "POST",
        body: JSON.stringify({ title: defaultTitle.slice(0, 140), artist: "You", audioKey: upload.key, durationSec: 0 }),
      });
      onSelect(sound);
      setSounds((prev) => [sound, ...prev]);
      onClose();
      toast("Sound uploaded");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Sounds" wide>
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search sounds, artists…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) load(true);
            }}
            onKeyDown={(e) => e.key === "Enter" && load(true)}
          />
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-primary hover:bg-surface-2">
          <Upload size={16} />
          {uploading ? "Uploading…" : "Upload your own sound"}
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadOwn(f);
            }}
          />
        </label>

        {loading && sounds.length === 0 ? (
          <Spinner className="mx-auto my-8" />
        ) : error && sounds.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{error}</p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {sounds.map((s) => {
              const active = selected === s.id;
              const isPlaying = playingId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => choose(s)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    active ? "border-primary bg-primary/10" : "border-border hover:bg-surface-2"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePreview(s);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text"
                    aria-label={isPlaying ? "Pause preview" : "Play preview"}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {s.title}
                      {s.official && <span className="ml-1 text-primary">✓</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {s.artist || "Original"} · {formatCount(s.usesCount)} uses
                    </p>
                  </div>
                  {active && <span className="shrink-0 text-xs font-bold text-primary">Selected</span>}
                </button>
              );
            })}
            {cursor && !loading && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => load(false, cursor)}>Load more</Button>
              </div>
            )}
            {sounds.length === 0 && !loading && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted">
                <Music2 size={32} />
                <p className="text-sm">No sounds found. Upload your own to get started!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
