import { useCallback, useEffect, useRef, useState } from "react";

type MicrophoneBeatOptions = {
  enabled: boolean;
  threshold: number;
  onHit: (time: number) => void;
};

type MicrophoneBeatState = {
  active: boolean;
  supported: boolean;
  level: number;
  permission: "idle" | "granted" | "denied";
  error: string | null;
  requestStart: () => Promise<void>;
  stop: () => void;
};

export const useMicrophoneBeat = ({
  enabled,
  threshold,
  onHit,
}: MicrophoneBeatOptions): MicrophoneBeatState => {
  const [active, setActive] = useState(false);
  const [permission, setPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastHitRef = useRef(0);
  const isRunningRef = useRef(false);
  const onHitRef = useRef(onHit);

  useEffect(() => {
    onHitRef.current = onHit;
  }, [onHit]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    setActive(false);
    setLevel(0);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const monitor = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current || !isRunningRef.current) {
      return;
    }

    const analyser = analyserRef.current;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);

    let sum = 0;
    let peak = 0;
    for (let index = 0; index < buffer.length; index += 1) {
      const normalized = Math.abs(buffer[index] / 128 - 1);
      sum += normalized * normalized;
      peak = Math.max(peak, normalized);
    }
    const rms = Math.sqrt(sum / buffer.length);
    const signalLevel = Math.max(rms, peak * 0.55);
    setLevel(signalLevel);

    const now = performance.now();
    if (signalLevel > threshold && now - lastHitRef.current > 220) {
      lastHitRef.current = now;
      onHitRef.current(now);
    }

    rafRef.current = requestAnimationFrame(monitor);
  }, [threshold]);

  const requestStart = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setError(null);

    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      const audioContext = new AudioContext();
      await audioContext.resume();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.15;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      isRunningRef.current = true;
      lastHitRef.current = 0;
      setPermission("granted");
      setActive(true);
      monitor();
    } catch (caught) {
      setPermission("denied");
      setError(caught instanceof Error ? caught.message : "マイクを開始できませんでした。");
      stop();
    }
  }, [enabled, monitor, stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
    }
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  return {
    active,
    supported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
    level,
    permission,
    error,
    requestStart,
    stop,
  };
};
