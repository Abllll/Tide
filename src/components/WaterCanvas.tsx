import { useEffect, useRef } from "react";

interface WaterCanvasProps {
  fillFraction: number;
  tone: "healthy" | "low";
  width: number;
  height: number;
  className?: string;
}

const TONES: Record<"healthy" | "low", { top: string; bottom: string; highlight: string }> = {
  healthy: { top: "#5fd4c8", bottom: "#0f6f6a", highlight: "rgba(255,255,255,0.55)" },
  low: { top: "#f2a08a", bottom: "#c04a34", highlight: "rgba(255,255,255,0.45)" },
};

export function WaterCanvas({ fillFraction, tone, width, height, className }: WaterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef(fillFraction);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(true);

  useEffect(() => {
    fillRef.current = fillFraction;
  }, [fillFraction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = TONES[tone];
    let start: number | null = null;

    const waveLayers = [
      { amp: height * 0.035, speed: 1.6, phase: 0, alpha: 1 },
      { amp: height * 0.02, speed: 2.3, phase: 2, alpha: 0.6 },
      { amp: height * 0.012, speed: 3.1, phase: 4, alpha: 0.4 },
    ];

    const draw = (timestamp: number) => {
      if (start === null) start = timestamp;
      const t = (timestamp - start) / 1000;

      ctx.clearRect(0, 0, width, height);

      const level = height * (1 - fillRef.current);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 4) {
        let y = level;
        for (const layer of waveLayers) {
          y += Math.sin((x / width) * Math.PI * 2 + t * layer.speed + layer.phase) * layer.amp * layer.alpha;
        }
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.clip();

      const gradient = ctx.createLinearGradient(0, level, 0, height);
      gradient.addColorStop(0, colors.top);
      gradient.addColorStop(1, colors.bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const y = level + Math.sin((x / width) * Math.PI * 2 + t * waveLayers[0].speed) * waveLayers[0].amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        runningRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else if (!runningRef.current) {
        runningRef.current = true;
        start = null;
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tone, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={className}
      aria-hidden="true"
    />
  );
}
