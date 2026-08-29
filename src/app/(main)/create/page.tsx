"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Sparkles, X, Loader2, Camera, Music2 } from "lucide-react";
import { apiFetch } from "@/components/api-client";
import { Button, Label, LinkButton, Select, Textarea, toast, Modal } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { CameraRecorder } from "@/components/create/camera-recorder";
import { SoundPicker } from "@/components/create/sound-picker";
import type { SoundView } from "@/types";

interface ProductOption {
  id: string;
  name: string;
}

export default function CreatePage() {
  const router = useRouter();
  const { user, managedBusinesses } = useSession();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [postAs, setPostAs] = useState<"self" | "business">("self");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [taggedProducts, setTaggedProducts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [sound, setSound] = useState<SoundView | null>(null);

  useEffect(() => {
    if (managedBusinesses.length > 0 && !businessId) setBusinessId(managedBusinesses[0].id);
  }, [managedBusinesses, businessId]);

  // load products for selected business
  useEffect(() => {
    if (!businessId) return;
    apiFetch<{ items: ProductOption[] }>(`/api/products?businessId=${businessId}&limit=50`)
      .then((d) => setProducts(d.items))
      .catch(() => setProducts([]));
  }, [businessId]);

  if (!user) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="mb-4 text-muted">Log in to start creating content.</p>
        <LinkButton href="/login?next=/create">Log in</LinkButton>
      </div>
    );
  }

  const isVideo = files.length === 1 && files[0].type.startsWith("video/");

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).slice(0, 10);
    setFiles(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const onCameraCapture = (file: File) => {
    setFiles([file]);
    setPreviews([URL.createObjectURL(file)]);
    setCameraOpen(false);
  };

  const removeSound = () => setSound(null);

  const uploadMedia = async (): Promise<string[]> => {
    const keys: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "posts");
      const d = await apiFetch<{ key: string; url: string }>("/api/media/upload", { method: "POST", body: form });
      keys.push(d.key);
    }
    return keys;
  };

  const aiCaption = async () => {
    setAiLoading(true);
    try {
      const d = await apiFetch<{ caption: string }>("/api/ai/caption", {
        method: "POST",
        body: JSON.stringify({ businessId, topic: caption.slice(0, 300) }),
      });
      setCaption(d.caption);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setAiLoading(false);
    }
  };

  const publish = async () => {
    if (!caption.trim() && files.length === 0) {
      toast("Add a caption or media first", "error");
      return;
    }
    setPosting(true);
    try {
      let mediaKeys: string[] = [];
      if (files.length > 0) {
        setUploading(true);
        mediaKeys = await uploadMedia();
        setUploading(false);
      }
      const qs = postAs === "business" && businessId ? `?businessId=${businessId}` : "";
      await apiFetch(`/api/posts${qs}`, {
        method: "POST",
        body: JSON.stringify({
          caption,
          mediaKeys,
          soundId: sound?.id ?? null,
          productIds: postAs === "business" ? taggedProducts : [],
        }),
      });
      toast("Posted!");
      router.push(postAs === "business" ? "/" : "/");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setUploading(false);
      setPosting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold">New post</h1>

      <div>
        <Label htmlFor="c-as">Post as</Label>
        <Select
          id="c-as"
          value={postAs}
          onChange={(e) => {
            const v = e.target.value as "self" | "business";
            setPostAs(v);
            setTaggedProducts([]);
          }}
        >
          <option value="self">@{user.username} (personal)</option>
          {managedBusinesses.length > 0 && <option value="business">Business account</option>}
        </Select>

        {postAs === "business" && managedBusinesses.length > 1 && (
          <div className="mt-2">
            <Label htmlFor="c-biz">Choose business</Label>
            <Select id="c-biz" value={businessId ?? ""} onChange={(e) => setBusinessId(e.target.value)}>
              {managedBusinesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* media picker */}
      <div>
        <Label>Media</Label>
        {previews.length === 0 && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setCameraOpen(true)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-surface py-6 text-muted transition-colors hover:border-primary hover:text-primary"
            >
              <Camera size={26} />
              <span className="text-sm font-semibold">Camera</span>
              <span className="text-[11px]">Photo or record video</span>
            </button>
            <button
              onClick={() => setSoundPickerOpen(true)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-surface py-6 text-muted transition-colors hover:border-primary hover:text-primary"
            >
              <Music2 size={26} />
              <span className="text-sm font-semibold">Add sound</span>
              <span className="text-[11px]">{sound ? "Change sound" : "Pick from library"}</span>
            </button>
          </div>
        )}
        {previews.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface py-10 text-muted transition-colors hover:border-primary hover:text-primary">
            <ImagePlus size={32} />
            <span className="text-sm font-medium">Tap to add photos or a video</span>
            <span className="text-xs">Up to 10 photos · 1 video (max 150MB)</span>
            <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
          </label>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                {files[i]?.type.startsWith("video/") ? (
                  <video src={src} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                )}
                <button onClick={() => removeFile(i)} aria-label="Remove" className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                  <X size={13} />
                </button>
              </div>
            ))}
            {!isVideo && previews.length < 10 && (
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border text-muted hover:border-primary hover:text-primary">
                <ImagePlus size={22} />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* caption */}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="c-cap">Caption</Label>
          <button
            onClick={aiCaption}
            disabled={aiLoading}
            className="mb-1.5 flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-50"
            title="Generate a caption with AI"
          >
            {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            AI caption
          </button>
        </div>
        <Textarea id="c-cap" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share something authentic… #hashtags welcome" maxLength={2200} />
        <p className="mt-1 text-right text-xs text-muted">{caption.length}/2200</p>
      </div>

      {/* tag products */}
      {postAs === "business" && products.length > 0 && (
        <div>
          <Label>Tag products</Label>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => {
              const active = taggedProducts.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setTaggedProducts((t) => (active ? t.filter((x) => x !== p.id) : [...t, p.id]))}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}
                >
                  🛍 {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sound && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-3">
          <button
            onClick={() => setSoundPickerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Change sound"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Music2 size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{sound.title}</span>
              <span className="block truncate text-xs text-muted">{sound.artist}</span>
            </span>
          </button>
          <button onClick={removeSound} aria-label="Remove sound" className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
      )}

      <Button size="lg" className="w-full" onClick={publish} loading={posting || uploading}>
        {uploading ? "Uploading media…" : "Publish"}
      </Button>

      <Modal open={cameraOpen} onClose={() => setCameraOpen(false)} title="Camera">
        <CameraRecorder onCaptured={onCameraCapture} onCancel={() => setCameraOpen(false)} />
      </Modal>

      <SoundPicker
        open={soundPickerOpen}
        onClose={() => setSoundPickerOpen(false)}
        selected={sound?.id ?? null}
        onSelect={setSound}
      />
    </div>
  );
}
