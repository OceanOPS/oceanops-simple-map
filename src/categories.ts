export type LayerKind = "point" | "image" | "line";
export type Shape = "circle" | "square" | "triangle" ;

export type Category =
  | { id: string; label: string; color: string; type: "image"; imagePath: string }
  | { id: string; label: string; color: string; type: "line" }
  | { id: string; label: string; color: string; type: "point"; shape?: Shape };

export const categories = [
  { id: 'anibos',                      label: 'Animal borne sensors - AniBOS',         color: '#ffffff', type: 'point', shape: 'circle' },
  { id: 'argo',                        label: 'Profiling floats - Argo',      color: '#2357a7', type: 'point', shape: 'circle' },
  { id: 'drifting_buoys',               label: 'Drifting buoys - DBCP',        color: '#28c3f3', type: 'point', shape: 'circle' },
  { id: 'fvon',                      label: 'FVON',         color: '#9d39e0ff', type: 'point', shape: 'circle'  },
  { id: 'gloss',                      label: 'Sea level gauges - GLOSS',         color: '#faa62d', type: 'point', shape: 'square' },
  { id: 'goship',                      label: 'Repeated transects - GO-SHIP',         color: '#ee2f2b', type: 'line' },
  { id: 'hf_radars',                      label: 'HF radars',         color: '#ffffff', type: 'point', shape: 'square'  },
  { id: 'moored_buoys',                 label: 'Moored Buoys',          color: '#ec2324', type: 'point', shape: 'square' },
  { id: 'oceansites',                      label: 'OceanSITES',         color: '#40a62e', type: 'point', shape: 'square'  },
  { id: 'ship_meteo',                        label: 'Ship based meteorological - SOT',                 color: '#8B0000', type: 'image', imagePath: '/img/ship_yellow.png' },
  { id: 'ship_oceano',                        label: 'Ship based oceanographic – SOT',                 color: '#faa62d', type: 'line' },
  { id: 'tsunami_buoys',                      label: 'Tsunami buoys - DBCP',         color: '#ffff00', type: 'point', shape: 'triangle'  },
  { id: 'oceangliders',                      label: 'OceanGliders',         color: '#71bf44', type: 'point', shape: 'circle'  },
];
