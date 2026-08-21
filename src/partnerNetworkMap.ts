/** Partner export network keys → map layer ids (categories). */
export const PARTNER_NETWORK_TO_LAYER: Record<string, string> = {
  driftingBuoys: "drifting_buoys",
  argo: "argo",
  oceanGliders: "oceangliders",
  aniBOS: "anibos",
  fvon: "fvon",
  sotVos: "vos",
  sotAsap: "asap",
  sot: "oceantrax",
  goShip: "goship",
  gloss: "gloss",
  oceanSites: "oceansites",
  mooredBuoys: "moored_buoys",
  tsunamiBuoys: "tsunami_buoys",
  hfRadars: "hf_radars",
};

export const LAYER_TO_PARTNER_NETWORK: Record<string, string> = Object.fromEntries(
  Object.entries(PARTNER_NETWORK_TO_LAYER).map(([k, v]) => [v, k])
);

/** Display order follows partner / report-card network list. */
export const PARTNER_NETWORK_ORDER = Object.keys(PARTNER_NETWORK_TO_LAYER);
