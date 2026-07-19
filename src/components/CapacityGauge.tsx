import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { WaterScene } from "@/components/WaterScene";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  justSynced: boolean;
}

const LOW_SPACE_THRESHOLD = 0.9;

export function CapacityGauge({ device, justSynced }: CapacityGaugeProps) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");

  useEffect(() => {
    const handleVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  if (!device) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground shadow-sm">
        <div className="h-14 w-20 shrink-0 rounded-lg bg-muted-foreground/10" />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const usedFraction = 1 - device.available_space_gb / device.total_space_gb;
  const isLow = usedFraction >= LOW_SPACE_THRESHOLD;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium shadow-sm transition-transform duration-300 ${
        isLow ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      } ${justSynced ? "scale-105" : "scale-100"}`}
    >
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg">
        <Canvas frameloop={frameloop} dpr={[1, 1.5]}>
          <WaterScene fillFraction={usedFraction} tone={isLow ? "low" : "healthy"} variant="panel" />
        </Canvas>
      </div>
      <span>
        {device.name} · {device.available_space_gb.toFixed(1)} GB free
        {isLow ? " · low space" : ""}
      </span>
    </div>
  );
}
