import { Trash2, Clock, Download, HardDrive, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RippleMark } from "@/components/BrandMarks";
import type { AudioFile, AudioState } from "@/types";

interface LibraryListProps {
  files: AudioFile[];
  selectedFiles: Set<string>;
  onFileClick: (fileId: string, shiftKey: boolean) => void;
  onDelete: () => void;
  isReordering?: boolean;
}

const STATE_CONFIG: Record<
  AudioState,
  { icon: typeof Clock; className: string; tooltip: string }
> = {
  queued: {
    icon: Clock,
    className: "bg-muted text-muted-foreground",
    tooltip: "Waiting to be added to your offline library",
  },
  downloading: {
    icon: Download,
    className: "bg-primary/15 text-primary",
    tooltip: "Preparing media for offline listening",
  },
  local: {
    icon: HardDrive,
    className: "bg-secondary text-secondary-foreground",
    tooltip: "In your offline library and ready to sync",
  },
  syncing: {
    icon: RefreshCw,
    className: "bg-primary/15 text-primary animate-pulse",
    tooltip: "Preparing the connected device",
  },
  synced: {
    icon: CheckCircle,
    className: "bg-primary text-primary-foreground",
    tooltip: "Available in your offline library and on the device",
  },
};

function StateBadge({ state }: { state: AudioState }) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  return (
    <div
      className={`w-8 h-8 rounded-xl flex items-center justify-center ${config.className}`}
      title={config.tooltip}
    >
      <Icon className="w-[18px] h-[18px]" />
    </div>
  );
}

export function LibraryList({ files, selectedFiles, onFileClick, onDelete, isReordering = false }: LibraryListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 h-8">
        <div className="text-xs font-semibold uppercase tracking-[.14em] text-white/75">Offline collection</div>
        {selectedFiles.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/75">{selectedFiles.size} selected</span>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
          </div>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {files.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-white/80 flex flex-col items-center gap-2">
            <RippleMark className="h-8 w-8 text-primary" />
            <div className="font-medium text-white">Pull it in, take it under.</div>
            <div>Add a supported media link above to begin your offline library.</div>
          </div>
        ) : (
          files.map((file, index) => (
            <div
              key={file.id}
              style={isReordering ? { animationDelay: `${index * 90}ms` } : undefined}
              className={`border-b last:border-b-0 border-border/60 cursor-pointer transition-colors ${isReordering ? "tide-library-reorder" : ""} ${
                selectedFiles.has(file.id) ? "bg-[#8ed2e4]/25" : "hover:bg-white/55"
              }`}
              onClick={(e) => onFileClick(file.id, e.shiftKey)}
            >
              <div className="px-3 py-2.5 flex items-center gap-2.5">
                <StateBadge state={file.state} />
                <span className="text-sm text-white flex-1">{file.filename}</span>
              </div>
              {file.download_log && (
                <div className="px-3 pb-2.5 pl-[48px]">
                  <div className="text-[11px] font-mono text-white/70 bg-white/10 px-3 py-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                    {file.download_log}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
