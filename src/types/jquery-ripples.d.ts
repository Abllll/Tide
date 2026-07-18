declare module "jquery.ripples";

interface RipplesOptions {
  imageUrl?: string | null;
  resolution?: number;
  dropRadius?: number;
  perturbance?: number;
  interactive?: boolean;
  crossOrigin?: string;
}

interface JQuery {
  ripples(options?: RipplesOptions): JQuery;
  ripples(method: "destroy"): JQuery;
  ripples(method: "drop", x: number, y: number, radius: number, strength: number): JQuery;
}
