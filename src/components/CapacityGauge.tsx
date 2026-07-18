import { Droplet } from "lucide-react";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  justSynced: boolean;
}

const LOW_SPACE_THRESHOLD_GB = 1;

function parseFreeGb(spaceAvailable: string): number | null {
  const match = spaceAvailable.match(/^([\d.]+)\s*GB/i);
  if (!match) return null;
  return parseFloat(match[1]);
}

export function CapacityGauge({ device, justSynced }: CapacityGaugeProps) {
  if (!device) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Droplet className="h-3.5 w-3.5" />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const freeGb = parseFreeGb(device.space_available);
  const isLow = freeGb !== null && freeGb < LOW_SPACE_THRESHOLD_GB;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform duration-300 ${
        isLow ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      } ${justSynced ? "scale-105" : "scale-100"}`}
    >
      <Droplet className="h-3.5 w-3.5" />
      {device.name} · {device.space_available}
      {isLow ? " · low space" : ""}
    </div>
  );
}
