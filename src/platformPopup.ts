import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import {
  formatGoosObservingNetworksDisplay,
  goosObservingNetworkFromAttrs,
  platformInspectPopupTitle,
  stackInspectPopupTitle,
  visibleMooringMaskForLayer,
} from "./platformInspect";
import { countryFlagUrl, getIsoCodeForGeoCountry } from "./countryFlags";
import {
  getContributingCountryLabel,
  isDisplayableGeoCountry,
} from "./countryFilters";
import {
  MOORING_STACK_BITS,
  stackNetworkLabels,
  type MooringStackLayerId,
} from "./mooringStacks";

const STACK_LAYER_ORDER: MooringStackLayerId[] = [
  "moored_buoys",
  "oceansites",
  "soconet_moorings",
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOperatedByHtml(attrs: Record<string, unknown>): string {
  const country = String(attrs.country_name ?? "").trim();
  const reportingIso = String(attrs.country_iso_reporting ?? "").trim();
  if (!isDisplayableGeoCountry(country)) return "—";
  const label = getContributingCountryLabel(country, reportingIso);
  const iso =
    reportingIso.toUpperCase() || getIsoCodeForGeoCountry(country)?.toUpperCase();
  if (iso && iso.length === 2) {
    const flag = `<img class="o-legend-country-flag-img o-map-popup-flag" src="${countryFlagUrl(iso)}" width="20" height="15" alt="" loading="lazy" decoding="async">`;
    return `<span class="o-map-popup-country">${flag}<span>${escapeHtml(label)}</span></span>`;
  }
  return escapeHtml(label);
}

function goosPassportId(attrs: Record<string, unknown>): string {
  const wigos = attrs.wigos_ref ?? attrs.wigos_id ?? attrs.wigosId;
  const wigosText = wigos == null ? "" : String(wigos).trim();
  if (wigosText) return escapeHtml(wigosText);

  const fallback = attrs.ptf_id;
  if (fallback == null || fallback === "") return "—";
  return escapeHtml(String(fallback));
}

function moreAtOceanOpsHtml(ptfRef: string): string {
  const ref = ptfRef
    .split("/")
    .map((part) => part.trim())
    .find(Boolean);
  if (!ref) return "";
  const url = `https://www.ocean-ops.org/board/wa/Platform?ref=${encodeURIComponent(ref)}`;
  return `<p class="o-map-popup-footer"><a target="_blank" rel="noopener noreferrer" href="${url}">More at OceanOPS</a></p>`;
}

function inspectPopupBodyHtml(
  attrs: Record<string, unknown>,
  goosNetwork: string,
  ptfRef: string
): string {
  return `<div class="o-map-popup o-map-popup--inspect">
          <dl class="o-map-popup-meta">
            <div class="o-map-popup-meta-row">
              <dt>GOOS Passport ID</dt>
              <dd>${goosPassportId(attrs)}</dd>
            </div>
            <div class="o-map-popup-meta-row">
              <dt>Operated by</dt>
              <dd>${formatOperatedByHtml(attrs)}</dd>
            </div>
            <div class="o-map-popup-meta-row">
              <dt>GOOS Observing Network(s)</dt>
              <dd>${escapeHtml(goosNetwork || "—")}</dd>
            </div>
          </dl>
          ${moreAtOceanOpsHtml(ptfRef)}
          </div>`;
}

function goosNetworksFromStackAttrs(
  attrs: Record<string, unknown>,
  stackMask: number
): string {
  const fromDb = String(attrs.goos_networks ?? "").trim();
  if (fromDb) {
    return formatGoosObservingNetworksDisplay(fromDb, stackMask);
  }

  const names: string[] = [];
  for (const layerId of STACK_LAYER_ORDER) {
    if ((stackMask & MOORING_STACK_BITS[layerId]) === 0) continue;
    names.push(goosObservingNetworkFromAttrs(undefined, layerId));
  }
  const unique = [...new Set(names)];
  return unique.length > 0 ? unique.join("; ") : stackNetworkLabels(stackMask).join("; ");
}

function goosNetworkForPlatformPopup(
  attrs: Record<string, unknown>,
  layerId: string
): string {
  const fromDb = String(attrs.goos_networks ?? "").trim();
  if (fromDb) {
    return formatGoosObservingNetworksDisplay(
      fromDb,
      visibleMooringMaskForLayer(layerId)
    );
  }
  return goosObservingNetworkFromAttrs(attrs, layerId);
}

export function platformPointPopupTemplate(layerId: string): PopupTemplate {
  return new PopupTemplate({
    title: ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) =>
      platformInspectPopupTitle(
        layerId,
        String(graphic.attributes?.ptf_ref ?? ""),
        graphic.attributes
      ),
    content: platformInspectPopupContent(layerId),
  });
}

export function platformInspectPopupContent(layerId: string) {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const ptfRef = String(attrs.ptf_ref ?? "").trim();
    const network = goosNetworkForPlatformPopup(attrs, layerId);
    return inspectPopupBodyHtml(attrs, network, ptfRef);
  };
}

export function mooringStackPopupTemplate(): PopupTemplate {
  return new PopupTemplate({
    title: ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) =>
      stackInspectPopupTitle(
        Number(graphic.attributes?.stack_mask ?? 0),
        String(graphic.attributes?.ptf_ref ?? ""),
        graphic.attributes
      ),
    content: mooringStackInspectPopupContent(),
  });
}

/** @deprecated Use platformInspectPopupContent via platformPointPopupTemplate */
export function platformPopupContent(cat: { id: string }) {
  return platformInspectPopupContent(cat.id);
}

export function mooringStackInspectPopupContent() {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const stackMask = Number(attrs.stack_mask ?? 0);
    const ptfRef = String(attrs.ptf_ref ?? "").trim();
    const network = goosNetworksFromStackAttrs(attrs, stackMask);
    return inspectPopupBodyHtml(attrs, network, ptfRef);
  };
}

/** @deprecated Use mooringStackInspectPopupContent via mooringStackPopupTemplate */
export function mooringStackPopupContent() {
  return mooringStackInspectPopupContent();
}
