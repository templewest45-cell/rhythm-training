import { useCallback, useEffect, useRef, useState } from "react";

type CameraMotionOptions = {
  enabled: boolean;
  threshold: number;
  onMotion: (time: number) => void;
};

type CameraMotionState = {
  active: boolean;
  supported: boolean;
  motionLevel: number;
  permission: "idle" | "granted" | "denied";
  error: string | null;
  requestStart: () => Promise<void>;
  stop: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
};

export const useCameraMotion = ({
  enabled,
  threshold,
  onMotion,
}: CameraMotionOptions): CameraMotionState => {
  const [active, setActive] = useState(false);
  const [permission, setPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [motionLevel, setMotionLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const lastMotionRef = useRef(0);
  const onMotionRef = useRef(onMotion);

  useEffect(() => {
    onMotionRef.current = onMotion;
  }, [onMotion]);

  const stop = useCallback(() => {
    setActive(false);
    setMotionLevel(0);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    lastFrameRef.current = null;
  }, []);

  const requestStart = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setError(null);

    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }

      const canvas = canvasRef.current;
      canvas.width = 64;
      canvas.height = 48;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("カメラ解析の準備に失敗しました。");
      }

      lastMotionRef.current = 0;
      lastFrameRef.current = null;

      timerRef.current = window.setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          return;
        }

        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;

        if (!lastFrameRef.current) {
          lastFrameRef.current = new Uint8ClampedArray(frame);
          return;
        }

        let diffTotal = 0;
        for (let index = 0; index < frame.length; index += 4) {
          const current = (frame[index] + frame[index + 1] + frame[index + 2]) / 3;
          const previous =
            (lastFrameRef.current[index] +
              lastFrameRef.current[index + 1] +
              lastFrameRef.current[index + 2]) /
            3;
          diffTotal += Math.abs(current - previous);
        }

        lastFrameRef.current = new Uint8ClampedArray(frame);
        const averageDiff = diffTotal / (frame.length / 4) / 255;
        setMotionLevel(averageDiff);

        const now = performance.now();
        if (averageDiff > threshold && now - lastMotionRef.current > 320) {
          lastMotionRef.current = now;
          onMotionRef.current(now);
        }
      }, 120);

      setPermission("granted");
      setActive(true);
    } catch (caught) {
      setPermission("denied");
      setError(caught instanceof Error ? caught.message : "カメラを開始できませんでした。");
      stop();
    }
  }, [enabled, stop, threshold]);

  useEffect(() => {
    if (!enabled) {
      stop();
    }
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  return {
    active,
    supported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
    motionLevel,
    permission,
    error,
    requestStart,
    stop,
    videoRef,
  };
};
