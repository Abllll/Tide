export type AudioState =
  | "queued"
  | "downloading"
  | "local"
  | "syncing"
  | "synced";

export interface AudioFile {
  id: string;
  filename: string;
  state: AudioState;
  download_log?: string;
}

export interface UsbDevice {
  id: string;
  name: string;
  space_available: string;
  mount_point: string;
}
