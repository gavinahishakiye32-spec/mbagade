"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Phone, PhoneOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { apiFetch, usePolling } from "@/components/api-client";
import { Avatar, LoadingBlock } from "@/components/ui";

interface CallData {
  call: {
    id: string;
    status: "ringing" | "accepted" | "rejected" | "ended" | "missed" | "cancelled";
    type: "voice" | "video";
    callerId: string;
    calleeBusinessId: string;
  };
  role: "caller" | "callee";
  peer: { name: string; avatarUrl: string | null };
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export default function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = usePolling<CallData>(`/api/calls/${id}`, 5000);
  const [phase, setPhase] = useState<"connecting" | "ringing" | "active" | "ended">("connecting");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const lastSignalId = useRef<string | null>(null);
  const startedRef = useRef(false);

  const data = state.data;

  useEffect(() => {
    if (!data) return;
    if (["ended", "rejected", "missed", "cancelled"].includes(data.call.status)) {
      setPhase("ended");
      cleanup();
      return;
    }
    if (data.role === "caller" && !startedRef.current && data.call.status === "ringing") {
      startedRef.current = true;
      startAsCaller();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // poll signals (offer/answer/candidates)
  useEffect(() => {
    if (!data || phase === "ended") return;
    const t = setInterval(async () => {
      try {
        const d = await apiFetch<{ signals: { id: string; kind: string; data: unknown; fromUserId: string }[]; callStatus: string }>(
          `/api/calls/${id}/signals${lastSignalId.current ? `?after=${lastSignalId.current}` : ""}`
        );
        for (const sig of d.signals) {
          lastSignalId.current = sig.id;
          await handleSignal(sig.kind as "offer" | "answer" | "candidate", sig.data);
        }
        if (d.callStatus === "accepted" && phase !== "active") setPhase("active");
        if (d.callStatus === "ended") {
          setPhase("ended");
          cleanup();
        }
      } catch { /* retry */ }
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data?.role, phase]);

  async function createPeer() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        apiFetch(`/api/calls/${id}/signals`, {
          method: "POST",
          body: JSON.stringify({ kind: "candidate", data: e.candidate.toJSON() }),
        }).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
      setPhase("active");
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setPhase("active");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") setPhase("ended");
    };
    pcRef.current = pc;
    return pc;
  }

  async function getMedia(video: boolean) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      return stream;
    } catch {
      setError("Camera/microphone access denied or unavailable.");
      throw new Error("no-media");
    }
  }

  async function startAsCaller() {
    try {
      const video = data!.call.type === "video";
      const stream = await getMedia(video);
      const pc = await createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await apiFetch(`/api/calls/${id}/signals`, {
        method: "POST",
        body: JSON.stringify({ kind: "offer", data: offer }),
      });
      setPhase("ringing");
    } catch (e) {
      if ((e as Error).message !== "no-media") setError("Could not start the call.");
    }
  }

  async function acceptCall() {
    try {
      const video = data!.call.type === "video";
      const stream = await getMedia(video);
      const pc = await createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // wait for offer if we don't have it yet
      let offerSDP: RTCSessionDescriptionInit | null = null;
      for (let i = 0; i < 10 && !offerSDP; i++) {
        const d = await apiFetch<{ signals: { id: string; kind: string; data: unknown }[] }>(
          `/api/calls/${id}/signals${lastSignalId.current ? `?after=${lastSignalId.current}` : ""}`
        );
        const offerSig = d.signals.find((s) => s.kind === "offer");
        if (offerSig) {
          lastSignalId.current = offerSig.id;
          offerSDP = offerSig.data as RTCSessionDescriptionInit;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!offerSDP) throw new Error("no-offer");

      await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await apiFetch(`/api/calls/${id}/respond`, { method: "POST", body: JSON.stringify({ action: "accept" }) });
      await apiFetch(`/api/calls/${id}/signals`, {
        method: "POST",
        body: JSON.stringify({ kind: "answer", data: answer }),
      });
      setPhase("active");
    } catch (e) {
      if ((e as Error).message !== "no-media") setError("Could not join the call.");
    }
  }

  async function handleSignal(kind: "offer" | "answer" | "candidate", payload: unknown) {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      if (kind === "answer" && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
      } else if (kind === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
      }
    } catch { /* ignore stale signals */ }
  }

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
  }

  const hangUp = async () => {
    try {
      await apiFetch(`/api/calls/${id}/respond`, { method: "POST", body: JSON.stringify({ action: "end" }) });
    } catch { /* ignore */ }
    setPhase("ended");
    cleanup();
  };

  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  if (state.loading && !data) return <LoadingBlock label="Connecting…" />;

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-120px)] max-w-2xl flex-col overflow-hidden rounded-2xl bg-black md:h-[calc(100dvh-88px)]">
      {/* remote video / avatar */}
      <div className="relative flex-1">
        <video ref={remoteVideo} autoPlay playsInline className={`h-full w-full object-cover ${data?.call.type === "video" ? "" : "hidden"}`} />
        {(data?.call.type === "voice" || phase !== "active") && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className={phase === "ringing" ? "pulse-ring rounded-full" : "rounded-full"}>
              <Avatar src={data?.peer.avatarUrl ?? null} name={data?.peer.name ?? "?"} size={110} />
            </div>
            <p className="text-xl font-bold text-white">{data?.peer.name}</p>
            <p className="text-sm text-white/60">
              {phase === "connecting" && "Connecting…"}
              {phase === "ringing" && "Ringing…"}
              {phase === "active" && "Connected"}
              {phase === "ended" && "Call ended"}
            </p>
            {error && <p className="max-w-xs text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {/* local preview */}
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          className="absolute right-3 top-3 h-32 w-24 rounded-xl border border-white/20 object-cover"
        />
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-4 bg-black/80 py-5">
        {data?.role === "callee" && phase === "connecting" ? (
          <>
            <button onClick={hangUp} aria-label="Decline" className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white">
              <PhoneOff size={22} />
            </button>
            <button onClick={acceptCall} aria-label="Accept" className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white pulse-ring">
              <Phone size={22} />
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMic} aria-label={micOn ? "Mute" : "Unmute"} className={`flex h-12 w-12 items-center justify-center rounded-full ${micOn ? "bg-surface-2 text-text" : "bg-danger text-white"}`}>
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={hangUp} aria-label="Hang up" className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white">
              <PhoneOff size={22} />
            </button>
            {data?.call.type === "video" && (
              <button onClick={toggleCam} aria-label={camOn ? "Camera off" : "Camera on"} className={`flex h-12 w-12 items-center justify-center rounded-full ${camOn ? "bg-surface-2 text-text" : "bg-danger text-white"}`}>
                {camOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
              </button>
            )}
          </>
        )}
      </div>

      {phase === "ended" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85">
          <p className="font-semibold text-white">Call ended</p>
          <Link href="/messages" className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary">
            Back to messages
          </Link>
        </div>
      )}
    </div>
  );
}
