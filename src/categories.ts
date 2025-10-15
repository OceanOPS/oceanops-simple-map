export type LayerKind = "point" | "image" | "line";
export type Shape = "circle" | "square" | "triangle" ;

export type Category =
  | { id: string; label: string; color: string; type: "image"; imagePath: string }
  | { id: string; label: string; color: string; type: "line" }
  | { id: string; label: string; color: string; type: "point"; shape?: Shape };

export const categories = [
  { id: 'anibos',                      label: 'Animal borne sensors - AniBOS',         color: '#ffffffff', type: 'point', shape: 'circle' },
  { id: 'argo',                        label: 'Profiling floats - Argo',      color: '#043c70ff', type: 'point', shape: 'circle' },
  { id: 'drifting_buoys',               label: 'Drifting buoys - DBCP',        color: '#4ed1f1ff', type: 'point', shape: 'circle' },
  { id: 'fvon',                      label: 'FVON',         color: '#9d39e0ff', type: 'point', shape: 'circle'  },
  { id: 'gloss',                      label: 'Sea level gauges - GLOSS',         color: '#53ceffff', type: 'point', shape: 'square' },
  { id: 'goship',                      label: 'Repeated transects - GO-SHIP',         color: '#b94b4bff', type: 'line' },
  { id: 'hf_radars',                      label: 'HF radars',         color: '#ca0033ff', type: 'point', shape: 'square'  },
  { id: 'moored_buoys',                 label: 'Moored Buoys',          color: '#FFD700', type: 'point', shape: 'square' },
  { id: 'oceansites',                      label: 'OceanSITES',         color: '#37b92cff', type: 'point', shape: 'square'  },
  { id: 'ship_meteo',                        label: 'Ship based meteorological - SOT',                 color: '#8B0000', type: 'image', imagePath: '/img/ship_yellow.png' },
  { id: 'ship_oceano',                        label: 'Ship based oceanographic – SOT',                 color: '#f09d21ff', type: 'line' },
  { id: 'tsunami_buoys',                      label: 'Tsunami buoys - DBCP',         color: '#fcff55ff', type: 'point', shape: 'triangle'  },
];
