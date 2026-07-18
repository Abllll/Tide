import { useState, useEffect, useRef } from "react";
import { Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { RippleMark, WaveDivider } from "@/components/BrandMarks";
import { CapacityGauge } from "@/components/CapacityGauge";
import { WaterIntro } from "@/components/WaterIntro";
import { SettingsPopover } from "@/components/SettingsPopover";
import { LibraryList } from "@/components/LibraryList";
import type { AudioFile, UsbDevice } from "@/types";

function App() {
  const [url, setUrl] = useState("");
  const [speed, setSpeed] = useState("1.0");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [storagePath, setStoragePath] = useState("");
  const [validationMsg, setValidationMsg] = useState<{type: string; message: string} | null>(null);
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [justSynced, setJustSynced] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const audioFilesRef = useRef<AudioFile[]>([]);

  // Keep ref in sync with state for event listeners
  useEffect(() => {
    audioFilesRef.current = audioFiles;
  }, [audioFiles]);

  // Load initial data and setup listeners
  useEffect(() => {
    Promise.allSettled([loadStoragePath(), loadAudioLibrary(), loadUsbDevices()]).then(() => {
      setInitialLoadComplete(true);
    });

    // Listeners
    const unlistenProgress = listen<any>("download-progress", (event) => {
      setAudioFiles(prev => prev.map(file => {
        if (file.id !== event.payload.id) return file;

        // Update filename if provided in event and not already updated
        let filename = file.filename;
        if (event.payload.filename && filename === "Downloading...") {
          filename = event.payload.filename;
        }

        return {
          ...file,
          download_log: event.payload.log,
          state: "downloading",
          filename
        };
      }));
    });

    const unlistenComplete = listen<any>("download-complete", (event) => {
      setAudioFiles(prev => prev.map(file =>
        file.id === event.payload.id
          ? { ...file, state: "local" }
          : file
      ));
      loadAudioLibrary(event.payload.id);
    });

    const unlistenSync = listen<any>("sync-complete", (event) => {
      setAudioFiles(prev => prev.map(file =>
        file.id === event.payload.id
          ? { ...file, state: "synced" }
          : file
      ));
      setSyncStatus(`Synced "${event.payload.filename}" to USB device ✓`);
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 700);
      setTimeout(() => setSyncStatus(""), 3000);
    });

    return () => {
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
      unlistenSync.then(fn => fn());
    };
  }, []);

  // Auto-sync logic and Status updates
  useEffect(() => {
    if (!selectedDevice) {
      if (audioFiles.some(f => f.state === "downloading")) {
        // Keep downloading status or clear if needed, but don't show sync status
      } else {
        setSyncStatus("");
      }
      return;
    }

    if (audioFiles.length === 0) {
      setSyncStatus("");
      return;
    }

    const device = usbDevices.find(d => d.id === selectedDevice);
    if (!device) return;

    // 1. Handle Active Syncing State (UI feedback)
    const syncingCount = audioFiles.filter(f => f.state === "syncing").length;
    if (syncingCount > 0) {
      setSyncStatus(`Syncing ${syncingCount} file(s) to ${device.name}...`);
      // We don't return here because we might need to trigger more syncs if new 'local' files appeared
    }

    // 2. Trigger Sync for 'local' files
    const localFiles = audioFiles.filter(f => f.state === "local");
    if (localFiles.length > 0) {
      localFiles.forEach(async (file) => {
        // Immediately mark as syncing to prevent double-triggering
        setAudioFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, state: "syncing" } : f
        ));

        try {
          await invoke("sync_to_usb", {
            fileId: file.id,
            filename: file.filename,
            usbMountPoint: device.mount_point
          });

          // Mark as synced on success
          setAudioFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, state: "synced" } : f
          ));
        } catch (error) {
          console.error("Sync failed:", error);
          setAudioFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, state: "local" } : f
          ));
          setSyncStatus(`Sync failed for "${file.filename}"`);
        }
      });
      return; // State updated, effect will re-run
    }

    // 3. Final Status (All Synced)
    // Only show "All synced" if we are NOT currently syncing anything and everything is synced
    if (syncingCount === 0) {
      const allSynced = audioFiles.every(f => f.state === "synced");
      if (allSynced) {
        setSyncStatus(`All files synced to ${device.name} ✓`);
      } else if (audioFiles.some(f => f.state === "downloading")) {
        // Downloading... status is handled by per-item or ignored here
        setSyncStatus("");
      } else {
        // Mixed state (e.g. queued) or empty
        setSyncStatus("");
      }
    }
  }, [audioFiles, selectedDevice, usbDevices]);

  const loadStoragePath = async () => {
    try {
      const path = await invoke<string>("get_storage_path");
      setStoragePath(path);
    } catch (error) {
      console.error("Failed to get storage path:", error);
    }
  };

  const loadAudioLibrary = async (completedId?: string) => {
    try {
      // Use ref to avoid stale state in event listeners
      const currentFiles = audioFilesRef.current;
      const downloadingFiles = currentFiles.filter(f =>
        (f.state === "downloading" || f.state === "syncing") && f.id !== completedId
      );

      // 1. Get Local Files
      const localFiles = await invoke<AudioFile[]>("get_audio_library");

      // 2. Get USB Files if device selected
      let usbFiles: AudioFile[] = [];
      if (selectedDevice) {
        const device = usbDevices.find(d => d.id === selectedDevice);
        if (device) {
          try {
            usbFiles = await invoke<AudioFile[]>("get_usb_files", { mountPoint: device.mount_point });
          } catch (e) {
            console.error("Failed to get USB files", e);
          }
        }
      }

      // 3. Merge Local and USB
      const fileMap = new Map<string, AudioFile>();

      // Add local files first
      localFiles.forEach(f => {
        fileMap.set(f.filename, f);
      });

      // Process USB files
      usbFiles.forEach(f => {
        if (fileMap.has(f.filename)) {
          // Exists locally and on USB -> Synced
          const local = fileMap.get(f.filename)!;
          fileMap.set(f.filename, { ...local, state: "synced" });
        } else {
          // Only on USB -> Synced
          fileMap.set(f.filename, { ...f, state: "synced" });
        }
      });

      // Convert back to array
      const diskFiles = Array.from(fileMap.values());

      // Merge downloading/syncing files with disk files
      const mergedFiles = [
        ...downloadingFiles,
        ...diskFiles.filter(f => !downloadingFiles.some(df => df.filename === f.filename))
      ];

      setAudioFiles(mergedFiles);
    } catch (error) {
      console.error("Failed to load audio library:", error);
    }
  };

  // Reload library when device selection changes
  useEffect(() => {
    loadAudioLibrary();
  }, [selectedDevice]);

  const loadUsbDevices = async () => {
    try {
      const devices = await invoke<UsbDevice[]>("list_usb_devices");
      setUsbDevices(devices);

      // Auto-select the first device if none is currently selected/valid,
      // so the water indicator reflects a connected device without
      // requiring the user to manually pick one every launch.
      setSelectedDevice(prev => {
        if (prev && devices.find(d => d.id === prev)) return prev;
        return devices.length > 0 ? devices[0].id : "";
      });
    } catch (error) {
      console.error("Failed to list USB devices:", error);
    }
  };

  const handleChangeStorage = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: storagePath,
      });

      if (selected) {
        const path = selected as string;
        await invoke("set_storage_path", { path });
        setStoragePath(path);
        // Reload library from new location
        loadAudioLibrary();
      }
    } catch (error) {
      console.error("Failed to change storage path:", error);
    }
  };

  // URL validation
  useEffect(() => {
    const validateUrl = async () => {
      if (!url.trim()) {
        setValidationMsg(null);
        return;
      }

      try {
        const result = await invoke<any>("validate_url", { url });
        if (result.valid) {
          setValidationMsg({ type: "success", message: result.message });
        } else {
          setValidationMsg({ type: "error", message: result.message });
        }
      } catch (error) {
        console.error("Validation error:", error);
      }
    };

    validateUrl();
  }, [url]);

  // File selection handler
  const handleFileClick = (fileId: string, shiftKey: boolean) => {
    if (shiftKey && lastSelectedId) {
      // Shift+Click: select range
      const startIndex = audioFiles.findIndex((f) => f.id === lastSelectedId);
      const endIndex = audioFiles.findIndex((f) => f.id === fileId);
      const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];

      const newSelected = new Set(selectedFiles);
      for (let i = start; i <= end; i++) {
        newSelected.add(audioFiles[i].id);
      }
      setSelectedFiles(newSelected);
    } else {
      // Regular click: select only this file, deselect all others
      setSelectedFiles(new Set([fileId]));
      setLastSelectedId(fileId);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    // Filter out files that are currently downloading
    const filesToDelete = audioFiles.filter(
      (f) => selectedFiles.has(f.id) && f.state !== "downloading"
    );

    if (filesToDelete.length === 0) {
      alert("Cannot delete files that are currently downloading. Please wait for downloads to complete.");
      return;
    }

    const count = filesToDelete.length;
    const filenames = filesToDelete.map((f) => f.filename);
    const fileIds = filesToDelete.map((f) => f.id);

    const confirmed = window.confirm(
      `Delete ${count} file(s)?\n\n${filenames.join("\n")}\n\nFiles will be removed from:\n✓ Local storage (${storagePath})\n✓ USB device (SHOKZ_DEVICE)`
    );

    if (confirmed) {
      try {
        // Optimistically remove from UI immediately
        setAudioFiles(prev => prev.filter(f => !selectedFiles.has(f.id)));

        // Get USB mount point if selected
        const device = usbDevices.find(d => d.id === selectedDevice);
        const usbMountPoint = device ? device.mount_point : null;

        await invoke("delete_audio_files", {
          fileIds,
          filenames,
          usbMountPoint
        });

        // Only clear selected files that were actually deleted
        const newSelected = new Set(selectedFiles);
        fileIds.forEach(id => newSelected.delete(id));
        setSelectedFiles(newSelected);

        await loadAudioLibrary();
      } catch (error) {
        console.error("Delete failed:", error);
        alert("Failed to delete files: " + error);
      }
    }
  };

  // Add to download queue
  const handleAddUrl = async () => {
    if (!url.trim() || !validationMsg?.type || validationMsg.type !== "success") {
      alert("Please enter a valid YouTube or Apple Podcast URL");
      return;
    }

    try {
      const downloadId = await invoke<string>("download_audio", {
        url,
        speed: parseFloat(speed),
      });

      // Add a temporary entry to the audio library
      const tempFile: AudioFile = {
        id: downloadId,
        filename: "Downloading...",
        state: "downloading",
        download_log: "Starting download...",
      };

      setAudioFiles(prev => [tempFile, ...prev]);
      setUrl(""); // Clear input
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to start download: " + error);
    }
  };

  const currentDevice = usbDevices.find(d => d.id === selectedDevice) ?? null;
  const introFraction = currentDevice
    ? 1 - currentDevice.available_space_gb / currentDevice.total_space_gb
    : 0;

  return (
    <>
      <div className="fixed bottom-1 right-1 z-[100] rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white">
        Tide preview build: 3d-water-r1
      </div>
      {showIntro && (
        <WaterIntro
          targetFraction={introFraction}
          ready={initialLoadComplete}
          onComplete={() => setShowIntro(false)}
        />
      )}
      <div className="min-h-screen bg-background text-sm text-foreground">
      <div className="sticky top-0 z-20 bg-tide-header">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <RippleMark className="h-5 w-5 text-primary" />
              Tide
            </div>
            <SettingsPopover storagePath={storagePath} onChangeStorage={handleChangeStorage} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              className="flex-1 text-sm"
            />
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger className="w-24 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">1.0x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2.0">2.0x</SelectItem>
                <SelectItem value="3.0">3.0x</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddUrl}>
              <Droplet className="w-4 h-4 mr-1.5" />
              Pull in
            </Button>
          </div>
          {validationMsg && (
            <div
              className={`text-xs ${
                validationMsg.type === "success" ? "text-primary" : "text-destructive"
              }`}
            >
              {validationMsg.message}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <CapacityGauge device={currentDevice} justSynced={justSynced} />
            {usbDevices.length > 0 && (
              <Select
                value={selectedDevice}
                onValueChange={setSelectedDevice}
                onOpenChange={(open) => {
                  if (open) loadUsbDevices();
                }}
              >
                <SelectTrigger className="w-44 h-7 text-xs">
                  <SelectValue placeholder="Select earpiece" />
                </SelectTrigger>
                <SelectContent>
                  {usbDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.available_space_gb.toFixed(1)} GB free)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {syncStatus && (
            <div className={`text-xs ${syncStatus.includes("failed") ? "text-destructive" : "text-muted-foreground"}`}>
              {syncStatus}
            </div>
          )}
        </div>
        <WaveDivider />
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <LibraryList
          files={audioFiles}
          selectedFiles={selectedFiles}
          onFileClick={handleFileClick}
          onDelete={handleDelete}
        />
      </div>
      </div>
    </>
  );
}

export default App;
