import { useEffect, useRef, useState } from "react";
import { Settings, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsPopoverProps {
  storagePath: string;
  onChangeStorage: () => void;
}

export function SettingsPopover({ storagePath, onChangeStorage }: SettingsPopoverProps) {
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
        className="h-8 w-8 text-foreground hover:bg-black/5"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-10 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Local storage</div>
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm">{storagePath || "Loading..."}</span>
            <Button variant="secondary" size="sm" onClick={onChangeStorage}>
              <Folder className="w-4 h-4 mr-1.5" />
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
