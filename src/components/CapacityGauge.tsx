import { WaterCanvas } from "@/components/WaterCanvas";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  justSynced: boolean;
}

const LOW_SPACE_THRESHOLD = 0.9;
const TANK_WIDTH = 40;
const TANK_HEIGHT = 24;

export function CapacityGauge({ device, justSynced }: CapacityGaugeProps) {
  if (!device) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <div
          className="rounded-sm bg-muted-foreground/10"
          style={{ width: TANK_WIDTH, height: TANK_HEIGHT }}
        />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const usedFraction = 1 - device.available_space_gb / device.total_space_gb;
  const isLow = usedFraction >= LOW_SPACE_THRESHOLD;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-transform duration-300 ${
        isLow ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      } ${justSynced ? "scale-105" : "scale-100"}`}
    >
      <div className="overflow-hidden rounded-sm" style={{ width: TANK_WIDTH, height: TANK_HEIGHT }}>
        <WaterCanvas
          fillFraction={usedFraction}
          tone={isLow ? "low" : "healthy"}
          width={TANK_WIDTH}
          height={TANK_HEIGHT}
        />
      </div>
      {device.name} · {device.available_space_gb.toFixed(1)} GB free
      {isLow ? " · low space" : ""}
    </div>
  );
}
