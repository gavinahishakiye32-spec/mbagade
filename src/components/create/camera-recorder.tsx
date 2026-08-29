"use client";

import { useEffect, useRef, useState } from "react";
import { Video, Camera, Square, FlipHorizontal2 } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * In-app camera / recorder (TikTok-style). Live camera preview with:
 *  - photo capture (single frame → JPEG Blob)
 *  - video recording (MediaRecorder → WebM Blob)
 *  - front/rear camera toggle
 * Emits ready-to-upload File objects to the parent.
 */
export function CameraRecorder({
  onCaptured,
  onCancel,
}: {
  onCaptured: (file: File, type: "photo" | "video") => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStream = async (f: "user" | "environment") => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const constrains: MediaStreamConstraints = {
        video: { facingMode: f, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      // Request audio separately so recording still works when denied.
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioAvailable(true);
      } catch {
        setAudioAvailable(false);
      }
      const videoStream = await navigator.mediaDevices.getUserMedia(constrains);
      const tracks = [...videoStream.getVideoTracks()];
      if (audioStream) tracks.push(...audioStream.getAudioTracks());
      const stream = new MediaStream(tracks);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setError(null);
    } catch {
      setError("Camera not available. Check permissions, or upload a file instead.");
    }
  };

  useEffect(() => {
    startStream(facing);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCaptured(new File([blob], "photo.jpg", { type: "image/jpeg" }), "photo");
    }, "image/jpeg", 0.9);
  };

  const toggleRecording = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    chunksRef.current = [];
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        setRecording(false);
        setElapsed(0);
        onCaptured(new File([blob], `video.${ext}`, { type: blob.type }), "video");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      const start = Date.now();
      intervalRef.current = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    } catch {
      setError("Recording unavailable on this device");
    }
  };

  const switchCamera = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    startStream(next);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {recording && (
          <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {elapsed}s REC
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6">
        <Button variant="secondary" size="icon" aria-label="Switch camera" onClick={switchCamera}>
          <FlipHorizontal2 size={20} />
        </Button>
        <button
          onClick={capturePhoto}
          aria-label="Take photo"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-border bg-surface text-text transition-transform active:scale-95"
        >
          <Camera size={26} />
        </button>
        <Button variant="secondary" size="icon" aria-label="Record video" onClick={toggleRecording}>
          {recording ? <Square size={18} className="text-danger" /> : <Video size={20} />}
        </Button>
      </div>
      <p className="text-center text-xs text-muted">
        {audioAvailable ? "Video will include your microphone audio." : "Microphone unavailable — video will be silent."}
      </p>
      <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
