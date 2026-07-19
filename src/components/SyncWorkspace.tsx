import { ArrowRight, FolderOpen, Headphones } from "lucide-react";
import type { AudioFile, UsbDevice } from "@/types";

interface SyncWorkspaceProps {
  files: AudioFile[];
  device: UsbDevice;
  status: string;
}

export function SyncWorkspace({ files, device, status }: SyncWorkspaceProps) {
  const localCount = files.filter(file => file.state === "local" || file.state === "syncing").length;
  const syncedCount = files.filter(file => file.state === "synced").length;
  const isReady = syncedCount > 0 && syncedCount === files.length && !status.toLowerCase().includes("syncing");

  return <div className="mb-8 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
    <div className="rounded-[1.5rem] border border-white/45 bg-white/12 p-5 text-[#eafaff] shadow-[0_12px_28px_rgba(0,27,55,.16)] backdrop-blur-sm"><div className="flex items-center gap-3"><FolderOpen className="h-5 w-5" /><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-white/65">Local folder</p><p className="mt-1 text-sm font-medium">{localCount} file{localCount === 1 ? "" : "s"} ready</p></div></div></div>
    <div className="flex flex-col items-center gap-1 text-center text-white"><ArrowRight className="h-6 w-6 animate-pulse" /><span className="max-w-32 text-[10px] font-semibold uppercase tracking-[.18em] text-white/70">{status || "Syncing"}</span></div>
    <div className={`rounded-[1.5rem] border border-white/45 bg-white/12 p-5 text-[#eafaff] shadow-[0_12px_28px_rgba(0,27,55,.16)] backdrop-blur-sm ${isReady ? "tide-device-ready" : ""}`}><div className="flex items-center gap-3"><Headphones className="h-5 w-5" /><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-white/65">Earpiece folder</p><p className="mt-1 text-sm font-medium">{device.name} · {syncedCount} synced</p></div></div></div>
  </div>;
}
