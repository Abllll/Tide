import { useState, useEffect, useRef } from "react";
import { Droplet, RefreshCw } from "lucide-react";
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
import { RippleMark } from "@/components/BrandMarks";
import { CapacityGauge } from "@/components/CapacityGauge";
import { SyncWorkspace } from "@/components/SyncWorkspace";
import { SettingsPopover } from "@/components/SettingsPopover";
import { LibraryList } from "@/components/LibraryList";
import type { AudioFile, UsbDevice } from "@/types";

const DEMO_AUDIO_FILES: AudioFile[] = [
  { id: "demo-lap-01", filename: "Open-water breathing technique.mp3", state: "local" },
  { id: "demo-lap-02", filename: "The Daily — Summer playlist.mp3", state: "local" },
  { id: "demo-lap-03", filename: "How to find your flow.mp3", state: "local" },
];

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
  const [mockConnected, setMockConnected] = useState(false);
  const [mockFill, setMockFill] = useState(42);
  const [syncRise, setSyncRise] = useState(false);
  const [isLibraryTransitioning, setIsLibraryTransitioning] = useState(false);
  const [isLibraryView, setIsLibraryView] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<"into" | "out">("into");
  const audioFilesRef = useRef<AudioFile[]>([]);
  const libraryRef = useRef<HTMLElement>(null);
  const connectedDeviceRef = useRef<string | null>(null);

  // Keep ref in sync with state for event listeners
  useEffect(() => {
    audioFilesRef.current = audioFiles;
  }, [audioFiles]);

  // Load initial data and setup listeners
  useEffect(() => {
    Promise.allSettled([loadStoragePath(), loadAudioLibrary(), loadUsbDevices()]);

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

  useEffect(() => {
    const pollDevices = window.setInterval(() => { void loadUsbDevices(); }, 3000);
    return () => window.clearInterval(pollDevices);
  }, []);

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

  const realDevice = usbDevices.find(d => d.id === selectedDevice) ?? null;
  const mockDevice: UsbDevice = {
    id: "tide-preview-device", name: "Tide OpenSwim", mount_point: "", total_space_gb: 8,
    available_space_gb: 8 * (1 - mockFill / 100),
  };
  const currentDevice = mockConnected ? mockDevice : realDevice;
  const usedFraction = currentDevice ? 1 - currentDevice.available_space_gb / currentDevice.total_space_gb : 0.18;
  const waterHeight = syncRise || isLibraryTransitioning || isLibraryView ? 100 : Math.max(33, Math.min(56, Math.round(33 + usedFraction * 23)));
  const waterlineFeather = 72;
  const waterlineTop = 780 * (1 - waterHeight / 100);
  const syncableFiles = audioFiles.filter(file => file.state !== "downloading");
  const syncProgress = syncableFiles.length ? syncableFiles.filter(file => file.state === "synced").length / syncableFiles.length : 0;

  const handleSync = async () => {
    if (!currentDevice) { setSyncStatus("Connect an earpiece before syncing."); return; }
    setSyncRise(true);
    setJustSynced(true);
    window.setTimeout(() => { setSyncRise(false); setJustSynced(false); }, 1100);
    const localFiles = audioFiles.filter(file => file.state === "local");
    if (mockConnected) {
      if (!localFiles.length) { setSyncStatus("Preview device is already in sync ✓"); return; }
      setAudioFiles(files => files.map(file => file.state === "local" ? { ...file, state: "syncing" } : file));
      setSyncStatus(`Syncing ${localFiles.length} file(s) to preview device...`);
      await new Promise(resolve => window.setTimeout(resolve, 1300));
      setAudioFiles(files => files.map(file => file.state === "syncing" ? { ...file, state: "synced" } : file));
      setSyncStatus(`Synced ${localFiles.length} file(s) to preview device ✓`);
      return;
    }
    if (!realDevice) return;
    if (!localFiles.length) { setSyncStatus("Everything is already in sync ✓"); return; }
    setSyncStatus(`Syncing ${localFiles.length} file(s) to ${realDevice.name}...`);
    for (const file of localFiles) {
      setAudioFiles(files => files.map(item => item.id === file.id ? { ...item, state: "syncing" } : item));
      try {
        await invoke("sync_to_usb", { fileId: file.id, filename: file.filename, usbMountPoint: realDevice.mount_point });
        setAudioFiles(files => files.map(item => item.id === file.id ? { ...item, state: "synced" } : item));
      } catch (error) {
        console.error("Sync failed:", error);
        setAudioFiles(files => files.map(item => item.id === file.id ? { ...item, state: "local" } : item));
        setSyncStatus(`Sync failed for "${file.filename}"`);
        return;
      }
    }
    setSyncStatus(`All files synced to ${realDevice.name} ✓`);
  };

  const handleLibraryTransition = () => {
    if (isLibraryTransitioning) return;
    setTransitionDirection("into");
    setIsLibraryTransitioning(true);
    window.setTimeout(() => { setIsLibraryView(true); window.scrollTo({ top: 0, behavior: "smooth" }); }, 850);
    window.setTimeout(() => setIsLibraryTransitioning(false), 1050);
  };

  const handleLandingTransition = () => {
    if (isLibraryTransitioning || !isLibraryView) return;
    setTransitionDirection("out");
    setIsLibraryTransitioning(true);
    window.setTimeout(() => { setIsLibraryView(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, 520);
    window.setTimeout(() => setIsLibraryTransitioning(false), 1080);
  };

  const startRecordingDemo = () => {
    setIsDemoMode(true);
    setMockFill(42);
    setMockConnected(true);
    setSelectedFiles(new Set());
    setAudioFiles(DEMO_AUDIO_FILES.map(file => ({ ...file })));
    setSyncStatus("Preview earpiece connected");
    window.setTimeout(handleLibraryTransition, 260);
  };

  const endRecordingDemo = () => {
    setIsDemoMode(false);
    setMockConnected(false);
    setAudioFiles([]);
    setSyncStatus("");
    setIsLibraryView(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!realDevice || connectedDeviceRef.current === realDevice.id) return;
    connectedDeviceRef.current = realDevice.id;
    handleLibraryTransition();
    const timer = window.setTimeout(handleSync, 980);
    return () => window.clearTimeout(timer);
    // A new device connection is the only event that should trigger this transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realDevice?.id]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (isLibraryTransitioning) { event.preventDefault(); return; }
      if (!isLibraryView && event.deltaY > 18 && window.scrollY < 40) {
        event.preventDefault();
        handleLibraryTransition();
      }
      if (isLibraryView && event.deltaY < -18 && window.scrollY < 18) {
        event.preventDefault();
        handleLandingTransition();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isLibraryTransitioning, isLibraryView]);

  return <div className="relative min-h-screen overflow-x-hidden text-sm text-[#163e5b]">
    <main className="relative isolate z-10"><div className="absolute inset-x-0 bottom-0 z-0 overflow-hidden transition-[top] duration-1000 ease-[cubic-bezier(.22,.8,.22,1)]" style={{ top: `${isLibraryView ? 0 : waterlineTop - waterlineFeather}px` }}><img src="/water/tide-waterline.gif" alt="" className={`h-full w-full object-cover object-top ${isLibraryTransitioning ? transitionDirection === "into" ? "tide-library-plunge" : "tide-library-surface" : ""}`} /></div>{isLibraryView && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-[#3dc7df]/35 via-[#127aa7]/12 to-transparent transition-[height] duration-700" style={{ height: `${Math.max(10, syncProgress * 100)}%` }} />}
      {!isLibraryView && <section className="relative z-10 min-h-[720px] overflow-hidden sm:min-h-[780px]">
        <div className="absolute inset-x-0 top-0 z-0 transition-[height] duration-1000 ease-out" style={{ height: `${100 - waterHeight}%`, background: "linear-gradient(to bottom, #fcfcfb 0, #fcfcfb calc(100% - 72px), rgba(252,252,251,.62) calc(100% - 28px), transparent 100%)" }} />
        <div className={`relative z-20 mx-auto max-w-5xl px-7 pt-7 transition-all duration-700 ease-out ${isLibraryTransitioning ? "pointer-events-none -translate-y-10 opacity-0" : "translate-y-0 opacity-100"}`}>
          <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[.42em] text-[#30536b]"><RippleMark className="h-3.5 w-3.5 text-[#1f5678]" /><div className="hidden items-center gap-10 sm:flex"><button type="button" onClick={handleLibraryTransition} className="transition-opacity hover:opacity-55">Library</button><span>About</span></div><SettingsPopover storagePath={storagePath} onChangeStorage={handleChangeStorage} previewEnabled={mockConnected} onPreviewEnabledChange={setMockConnected} previewFill={mockFill} onPreviewFillChange={setMockFill} demoActive={isDemoMode} onStartDemo={startRecordingDemo} onEndDemo={endRecordingDemo} /></div>
          <div className="mx-auto max-w-3xl pt-24 text-center sm:pt-32"><h1 className="tide-display pl-[.14em] text-[clamp(5.5rem,16vw,10rem)] leading-[.76] tracking-[.14em] text-[#193e57]">Tide</h1><p className="mt-8 text-[10px] font-semibold uppercase tracking-[.48em] text-[#7290a0]">Pull it in, take it under.</p><p className="mt-4 text-sm text-[#52768b]">Turn the videos you’re into right now into swim-ready audio.</p></div>
          <div className="relative mx-auto mt-14 max-w-xl"><div className="flex flex-wrap justify-center gap-2"><Input placeholder="Paste a YouTube or Apple Podcasts link" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddUrl()} className="min-w-[230px] flex-1" /><Select value={speed} onValueChange={setSpeed}><SelectTrigger className="h-11 w-24 rounded-[1.35rem] border border-white/50 bg-gradient-to-br from-[#d7f5f3]/80 via-[#80d2e6]/72 to-[#398bb7]/72 text-white shadow-[0_10px_25px_rgba(67,157,192,.2),inset_0_1px_1px_rgba(255,255,255,.8)] backdrop-blur-md"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1.0">1.0x</SelectItem><SelectItem value="1.25">1.25x</SelectItem><SelectItem value="1.5">1.5x</SelectItem><SelectItem value="2.0">2.0x</SelectItem><SelectItem value="3.0">3.0x</SelectItem></SelectContent></Select></div>{validationMsg && <p className={`mt-2 text-center text-xs ${validationMsg.type === "success" ? "text-[#287da9]" : "text-destructive"}`}>{validationMsg.message}</p>}</div>
        </div>
        <Button style={{ top: `${waterlineTop + 72}px` }} className={`absolute left-1/2 z-10 -translate-x-1/2 transition-all duration-700 ${isLibraryTransitioning ? "translate-y-8 opacity-0" : "translate-y-0 opacity-100"}`} onClick={handleAddUrl}><Droplet />Pull in</Button>
      </section>}
      <section ref={libraryRef} className={`relative z-20 mx-auto max-w-4xl px-4 pb-16 ${isLibraryView ? "min-h-screen pt-16" : "pt-12"}`}><div className="px-2 py-5 sm:px-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.28em] text-[#d7f4f7]/75">Your current</p><h2 className="tide-display mt-2 text-4xl text-white">Library</h2><CapacityGauge device={currentDevice} className="mt-3 text-white" /></div></div>{isLibraryView && currentDevice && <><SyncWorkspace files={audioFiles} device={currentDevice} status={syncStatus} /><div className="mb-8 flex justify-center"><Button className={justSynced ? "scale-105" : ""} onClick={handleSync}><RefreshCw className={syncRise ? "animate-spin" : ""} />Sync files</Button></div></>}{usbDevices.length > 0 && !mockConnected && <Select value={selectedDevice} onValueChange={setSelectedDevice} onOpenChange={open => { if (open) loadUsbDevices(); }}><SelectTrigger className="mb-4 w-52 rounded-full bg-white/20 text-xs text-white backdrop-blur-sm"><SelectValue placeholder="Select earpiece" /></SelectTrigger><SelectContent>{usbDevices.map(device => <SelectItem key={device.id} value={device.id}>{device.name} ({device.available_space_gb.toFixed(1)} GB free)</SelectItem>)}</SelectContent></Select>}<LibraryList files={audioFiles} selectedFiles={selectedFiles} onFileClick={handleFileClick} onDelete={handleDelete} />{syncStatus && <p className={`mt-4 text-xs ${syncStatus.includes("failed") ? "text-[#ffd5cf]" : "text-white/80"}`}>{syncStatus}</p>}</div></section>
    </main>
  </div>;
}

export default App;
