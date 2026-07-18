import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { WaterScene } from "@/components/WaterScene";

interface WaterIntroProps {
  targetFraction: number;
  ready: boolean;
  onComplete: () => void;
}

const FLOOR_FRACTION = 0.04;
const RISE_MS = 1200;
const HOLD_MS = 400;
const FADE_MS = 500;
const LOW_SPACE_THRESHOLD = 0.9;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function WaterIntro({ targetFraction, ready, onComplete }: WaterIntroProps) {
  const [fillFraction, setFillFraction] = useState(0);
  const [phase, setPhase] = useState<"waiting" | "rising" | "holding" | "fading">("waiting");
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!ready) return;

    setPhase("rising");
    const target = Math.max(targetFraction, FLOOR_FRACTION);
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / RISE_MS, 1);
      setFillFraction(target * easeOutCubic(t));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase("holding");
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // targetFraction is intentionally captured once here as a snapshot of
    // the fill level at the moment the rise starts, not tracked reactively —
    // and `phase` must stay out of the deps, since setPhase("rising") above
    // would otherwise retrigger this same effect and cancel its own
    // just-scheduled animation frame before it ever fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (phase !== "holding") return;
    const timer = setTimeout(() => setPhase("fading"), HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(onComplete, FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-500 ${
        phase === "fading" ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      }`}
    >
      <Canvas frameloop={frameloop} dpr={[1, 1.5]}>
        <WaterScene
          fillFraction={fillFraction}
          tone={targetFraction >= LOW_SPACE_THRESHOLD ? "low" : "healthy"}
          variant="intro"
        />
      </Canvas>
    </div>
  );
}
