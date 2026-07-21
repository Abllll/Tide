import { Check, Headphones, Search, SlidersHorizontal, Sparkles, Waves } from "lucide-react";
import { RippleMark } from "@/components/BrandMarks";
import type { PortfolioDemoScene } from "@/components/SettingsPopover";

export type PairStage = "searching" | "found" | "connected";
export type LibraryDemoStep = "search" | "filter-open" | "filter-applied" | "reorder-open" | "reorder-applied" | "playlist";

interface PortfolioDemoOverlayProps {
  scene: PortfolioDemoScene | null;
  pairStage: PairStage;
  futureStage: "article" | "narration" | "ready";
}

export function PortfolioDemoOverlay({ scene, pairStage, futureStage }: PortfolioDemoOverlayProps) {
  if (scene === "identity") {
    return <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[#fcfcfb] tide-identity-scene"><div className="text-center"><RippleMark className="mx-auto h-8 w-8 text-[#1f5678] tide-identity-ripple" /><h2 className="tide-display mt-7 text-6xl text-[#193e57]">Tide</h2><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.42em] text-[#7290a0]">Prepare the sound beneath the surface.</p></div></div>;
  }

  if (scene === "pair") {
    const copy = pairStage === "searching" ? ["Searching for your device", "Keep your compatible earpiece nearby."] : pairStage === "found" ? ["Tide OpenSwim found", "A compatible device is ready to pair."] : ["Tide OpenSwim connected", "Your offline library is ready to sync."];
    return <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#0a3554]/20 backdrop-blur-[2px]"><div className="w-[min(22rem,calc(100%-2rem))] rounded-[2rem] border border-white/45 bg-[#123e5f]/92 p-7 text-center text-white shadow-[0_20px_55px_rgba(0,36,65,.35)] backdrop-blur-md"><div className={`mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/15 text-[#c9f8f2] ${pairStage === "searching" ? "animate-pulse" : ""}`}>{pairStage === "connected" ? <Check className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}</div><p className="mt-5 text-sm font-semibold text-white">{copy[0]}</p><p className="mt-2 text-xs text-white/75">{copy[1]}</p>{pairStage === "searching" && <div className="mx-auto mt-5 h-1.5 w-28 overflow-hidden rounded-full bg-white/20"><div className="h-full w-1/2 rounded-full bg-[#c9f8f2] tide-search-sweep" /></div>}</div></div>;
  }

  if (scene === "future") {
    const copy = futureStage === "article" ? ["Article added", "Preparing a quiet read for later."] : futureStage === "narration" ? ["Narration preview", "Exploring an optional spoken-audio layer."] : ["Ready for the library", "Concept preview — not a live feature."];
    return <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#0a3554]/15"><div className="w-[min(24rem,calc(100%-2rem))] rounded-[2rem] border border-white/50 bg-[#123e5f]/80 p-7 text-center text-white shadow-[0_20px_55px_rgba(0,25,50,.35)] backdrop-blur-md"><Sparkles className="mx-auto h-6 w-6 text-[#c9f8f2]" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.32em] text-white/60">Future exploration</p><h2 className="tide-display mt-3 text-3xl">{copy[0]}</h2><p className="mt-3 text-sm text-white/80">{copy[1]}</p></div></div>;
  }

  return null;
}

export function LibraryDemoToolbar({ step }: { step: LibraryDemoStep }) {
  const isFilter = step === "filter-open" || step === "filter-applied";
  const isReorder = step === "reorder-open" || step === "reorder-applied";
  const active = (value: "search" | "filter" | "reorder") => (value === "search" && step === "search") || (value === "filter" && isFilter) || (value === "reorder" && isReorder) ? "border-white/80 bg-white/25 text-white" : "border-white/25 bg-white/10 text-white/70";
  return <div className="mb-5 space-y-3"><div className="relative flex flex-wrap gap-2"><div className={`flex h-9 min-w-40 items-center gap-2 rounded-full border px-3 text-xs transition-all duration-500 ${active("search")}`}><Search className="h-3.5 w-3.5" /><span>{step === "search" ? "motion" : "Search library"}</span></div><div className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-all duration-500 ${active("filter")}`}><SlidersHorizontal className="h-3.5 w-3.5" /><span>{step === "filter-applied" ? "Interaction design" : "Filter"}</span></div><div className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-all duration-500 ${active("reorder")}`}><Waves className="h-3.5 w-3.5" /><span>{step === "reorder-applied" ? "Recently added" : "Reorder"}</span></div>{step === "filter-open" && <div className="absolute left-[10.6rem] top-11 z-10 w-44 rounded-[1rem] border border-white/60 bg-[#174769]/95 p-1.5 text-xs text-white shadow-xl tide-library-menu"><div className="rounded-lg px-3 py-2 text-white/65">All media</div><div className="rounded-lg bg-white/18 px-3 py-2">Interaction design</div><div className="rounded-lg px-3 py-2 text-white/65">Design systems</div></div>}{step === "reorder-open" && <div className="absolute left-[18.4rem] top-11 z-10 w-40 rounded-[1rem] border border-white/60 bg-[#174769]/95 p-1.5 text-xs text-white shadow-xl tide-library-menu"><div className="rounded-lg bg-white/18 px-3 py-2">Recently added</div><div className="rounded-lg px-3 py-2 text-white/65">Title A–Z</div><div className="rounded-lg px-3 py-2 text-white/65">Shortest first</div></div>}</div>{step === "playlist" && <div className="rounded-[1.25rem] border border-white/45 bg-white/15 px-4 py-3 text-sm text-white tide-playlist-reveal"><span className="font-medium">Interaction patterns · saved set</span><span className="ml-2 text-white/65">3 items · ready to sync</span></div>}</div>;
}
