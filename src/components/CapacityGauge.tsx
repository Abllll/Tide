import { HardDrive } from "lucide-react";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  className?: string;
}

const LOW_SPACE_THRESHOLD = 0.9;

export function CapacityGauge({ device, className = "" }: CapacityGaugeProps) {
  if (!device) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <HardDrive className="h-4 w-4" />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const usedFraction = 1 - device.available_space_gb / device.total_space_gb;
  const isLow = usedFraction >= LOW_SPACE_THRESHOLD;

  return (
    <div className={`flex items-center gap-2 text-xs font-medium text-[#174769] ${className}`}>
      <HardDrive className="h-4 w-4" />
      <span>
        {device.name} · {device.available_space_gb.toFixed(1)} GB free
        {isLow && <span className="ml-1.5 inline-flex items-center gap-1 text-[#d86250]"><i className="h-1.5 w-1.5 rounded-full bg-[#d86250]" />low space</span>}
      </span>
    </div>
  );
}
