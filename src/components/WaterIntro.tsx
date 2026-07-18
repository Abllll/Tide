import { useEffect, useRef, useState } from "react";
import { WaterCanvas } from "@/components/WaterCanvas";

interface WaterIntroProps {
  targetFraction: number;
  ready: boolean;
  onComplete: () => void;
}

const FLOOR_FRACTION = 0.04;
const RISE_MS = 1200;
const HOLD_MS = 400;
const FADE_MS = 600;
const LOW_SPACE_THRESHOLD = 0.9;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function WaterIntro({ targetFraction, ready, onComplete }: WaterIntroProps) {
  const [fillFraction, setFillFraction] = useState(0);
  const [phase, setPhase] = useState<"waiting" | "rising" | "holding" | "fading">("waiting");
  const rafRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!ready || phase !== "waiting") return;

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
  }, [ready, phase, targetFraction]);

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
      className={`fixed inset-0 z-50 transition-all duration-[600ms] ${
        phase === "fading" ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      }`}
    >
      <WaterCanvas
        fillFraction={fillFraction}
        tone={targetFraction >= LOW_SPACE_THRESHOLD ? "low" : "healthy"}
        width={viewport.w}
        height={viewport.h}
        className="absolute inset-0"
      />
    </div>
  );
}
