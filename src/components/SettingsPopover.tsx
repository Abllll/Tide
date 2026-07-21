import { useEffect, useRef, useState } from "react";
import { Settings, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PortfolioDemoScene = "identity" | "import" | "library" | "pair" | "sync" | "future";

interface SettingsPopoverProps {
  storagePath: string;
  onChangeStorage: () => void;
  previewEnabled: boolean;
  onPreviewEnabledChange: (enabled: boolean) => void;
  previewFill: number;
  onPreviewFillChange: (fill: number) => void;
  onPlayScene: (scene: PortfolioDemoScene) => void;
  onEndDemo: () => void;
}

export function SettingsPopover({ storagePath, onChangeStorage, previewEnabled, onPreviewEnabledChange, previewFill, onPreviewFillChange, onPlayScene, onEndDemo }: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-[#174769]"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-[1.25rem] border border-white/80 bg-white/90 p-4 text-popover-foreground shadow-xl backdrop-blur-md">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Local storage</div>
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm">{storagePath || "Loading..."}</span>
            <Button variant="secondary" size="sm" onClick={onChangeStorage}>
              <Folder className="w-4 h-4 mr-1.5" />
              Change
            </Button>
          </div>
          <div className="mt-4 border-t border-[#174769]/10 pt-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Portfolio scenes</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["identity", "01 · Identity"],
                ["import", "02 · Import"],
                ["library", "03 · Library"],
                ["pair", "04 · Pair device"],
                ["sync", "05 · Sync"],
                ["future", "06 · Future"],
              ] as const).map(([scene, label]) => <Button key={scene} variant="secondary" size="sm" className="justify-start text-xs" onClick={() => { setOpen(false); onPlayScene(scene); }}>{label}</Button>)}
            </div>
            <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => { setOpen(false); onEndDemo(); }}>Reset preview</Button>
          </div>
          <details className="mt-4 border-t border-[#174769]/10 pt-3 text-xs">
            <summary className="cursor-pointer font-medium text-[#52768b]">Preview controls</summary>
            <label className="mt-3 flex items-center justify-between gap-3 text-[#174769]"><span>Simulate earpiece</span><input type="checkbox" checked={previewEnabled} onChange={event => onPreviewEnabledChange(event.target.checked)} /></label>
            {previewEnabled && <label className="mt-3 block text-[#52768b]">Storage fullness · {previewFill}%<input className="mt-2 w-full accent-[#4b9bc0]" type="range" min="5" max="98" value={previewFill} onChange={event => onPreviewFillChange(Number(event.target.value))} /></label>}
          </details>
        </div>
      )}
    </div>
  );
}
