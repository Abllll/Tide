import { useEffect, useRef, type ReactNode } from "react";
import $ from "jquery";
import "jquery.ripples";
import { generateHeaderTexture } from "@/lib/generateHeaderTexture";

interface RippleSurfaceProps {
  className?: string;
  children: ReactNode;
}

export function RippleSurface({ className, children }: RippleSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const $el = $(el);
    $el.ripples({
      imageUrl: generateHeaderTexture(),
      resolution: 256,
      dropRadius: 20,
      perturbance: 0.03,
      interactive: true,
    });

    return () => {
      $el.ripples("destroy");
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
