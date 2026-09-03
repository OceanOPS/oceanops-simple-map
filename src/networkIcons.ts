/** GOOS network pictograms (aligned with report-card Partner modal). */
const NETWORK_ICON_FILES: Record<string, string> = {
  vos: "vos.svg",
  asap: "asap.svg",
  soconet: "vos.svg",
  oceantrax: "xbt-soop.svg",
  goship: "go_ship.svg",
  fvon: "fishing_vessels.svg",
  gloss: "gloss.svg",
  oceansites: "ocean_sites.svg",
  moored_buoys: "dbcp_moored.svg",
  tsunami_buoys: "tsunami_buoys.svg",
  hf_radars: "hf_radar.svg",
  drifting_buoys: "dbcp_drifters.svg",
  argo: "argo.svg",
  oceangliders: "ocean_gliders.svg",
  anibos: "ani_bos.svg",
};

const BASE = import.meta.env.BASE_URL;

export function getNetworkIconUrl(layerId: string): string | null {
  const file = NETWORK_ICON_FILES[layerId];
  if (!file) return null;
  return `${BASE}icons/network/${file}`;
}

export function makeNetworkIconImg(layerId: string): HTMLImageElement | null {
  const src = getNetworkIconUrl(layerId);
  if (!src) return null;

  const img = document.createElement("img");
  img.className = "o-network-picto";
  img.src = src;
  img.width = 24;
  img.height = 24;
  img.alt = "";
  img.decoding = "async";
  return img;
}
