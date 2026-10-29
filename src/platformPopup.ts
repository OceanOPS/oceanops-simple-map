import type Graphic from "@arcgis/core/Graphic.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import CustomContent from "@arcgis/core/popup/content/CustomContent.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import {
  formatGoosObservingNetworksDisplay,
  goosObservingNetworkFromAttrs,
  colocatedClusterPopupTitle,
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
  STACK_MEMBERS_JSON_FIELD,
  stackNetworkLabels,
  type MooringStackLayerId,
} from "./mooringStacks";
import {
  parseColocatedMembersFromAttrs,
  type ColocatedPlatformMember,
} from "./colocatedPlatforms";
type StackPopupView = MapView | SceneView;

let stackPopupView: StackPopupView | null = null;
const stackPopupCleanups = new WeakMap<Graphic, () => void>();

/** Lets stack pagination sync the Esri popup title with the active platform. */
export function bindStackPopupView(view: StackPopupView): void {
  stackPopupView = view;
}

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

function goosPassportIdFromMember(member: ColocatedPlatformMember): string {
  const wigos = (member.wigos_ref ?? "").trim();
  if (wigos) return escapeHtml(wigos);
  if (member.ptf_id != null) return escapeHtml(String(member.ptf_id));
  return "—";
}

function memberAttrsForOperatedBy(member: ColocatedPlatformMember): Record<string, unknown> {
  return {
    country_name: member.country_name,
    country_iso_reporting: member.country_iso_reporting,
  };
}

function stackMemberGroupKey(member: ColocatedPlatformMember): string {
  const wigos = (member.wigos_ref ?? "").trim();
  if (wigos) return `w:${wigos}`;
  const ref = member.ptf_ref.trim();
  if (ref) return `r:${ref}`;
  if (member.ptf_id != null) return `id:${member.ptf_id}`;
  return `layer:${member.layer_id}:${ref}`;
}

function dedupeGoosNetworkTokens(networkStrings: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of networkStrings) {
    for (const part of raw.split(/\s*[,;/]\s*/)) {
      const token = part.replace(/\s*\((?:closed|not operational)\)\s*$/i, "").trim();
      if (!token || seen.has(token)) continue;
      seen.add(token);
      ordered.push(token);
    }
  }
  return ordered;
}

function groupStackMembers(members: ColocatedPlatformMember[]): ColocatedPlatformMember[][] {
  const order: string[] = [];
  const byKey = new Map<string, ColocatedPlatformMember[]>();
  for (const member of members) {
    const key = stackMemberGroupKey(member);
    if (!byKey.has(key)) order.push(key);
    const list = byKey.get(key) ?? [];
    list.push(member);
    byKey.set(key, list);
  }
  return order.map((key) => byKey.get(key)!);
}

/** Networks this platform is drawn on (map layer), not the whole stack pin. */
function mooringMaskForMemberGroup(group: ColocatedPlatformMember[]): number {
  let mask = 0;
  for (const member of group) {
    mask |= visibleMooringMaskForLayer(member.layer_id);
  }
  return mask;
}

/** OceanSITES rows: passport networks only — no “(not operational)” (editorial). */
function groupIsOceanSitesOnly(group: ColocatedPlatformMember[]): boolean {
  return group.length > 0 && group.every((m) => m.layer_id === "oceansites");
}

function goosNetworksForMemberGroup(group: ColocatedPlatformMember[]): string {
  const tokens = dedupeGoosNetworkTokens(
    group.map((m) => m.goos_networks ?? "").filter(Boolean)
  );
  if (tokens.length === 0) {
    const names: string[] = [];
    for (const member of group) {
      names.push(goosObservingNetworkFromAttrs(undefined, member.layer_id));
    }
    return [...new Set(names)].join(", ");
  }
  if (groupIsOceanSitesOnly(group)) {
    return tokens.join(", ");
  }
  const layerMask = mooringMaskForMemberGroup(group);
  return formatGoosObservingNetworksDisplay(tokens.join(", "), layerMask);
}

function platformRefForGroup(group: ColocatedPlatformMember[]): string {
  return [
    ...new Set(group.map((m) => m.ptf_ref.trim()).filter(Boolean)),
  ].join(" / ");
}

function stackGroupPageInnerHtml(group: ColocatedPlatformMember[]): string {
  const passport = goosPassportIdFromMember(group[0]!);
  const operatedBy = formatOperatedByHtml(memberAttrsForOperatedBy(group[0]!));
  const networks = goosNetworksForMemberGroup(group);
  const primaryRef = group[0]?.ptf_ref.trim() ?? "";

  return `<dl class="o-map-popup-meta">
            <div class="o-map-popup-meta-row">
              <dt>GOOS Passport ID</dt>
              <dd>${passport}</dd>
            </div>
            <div class="o-map-popup-meta-row">
              <dt>Operated by</dt>
              <dd>${operatedBy}</dd>
            </div>
            <div class="o-map-popup-meta-row">
              <dt>GOOS Observing Network(s)</dt>
              <dd>${escapeHtml(networks || "—")}</dd>
            </div>
          </dl>
          ${moreAtOceanOpsHtml(primaryRef)}`;
}

function mountMooringStackPaginatedPopup(
  root: HTMLElement,
  groups: ColocatedPlatformMember[][],
  graphic: Graphic
): () => void {
  const pageCount = groups.length;
  let pageIndex = 0;

  root.className =
    "o-map-popup o-map-popup--inspect o-map-popup--stack o-map-popup--stack-paged";
  root.tabIndex = 0;

  const pageEl = document.createElement("section");
  pageEl.className = "o-map-popup-stack-page";
  pageEl.setAttribute("role", "region");

  const navEl = document.createElement("nav");
  navEl.className = "o-map-popup-stack-nav";
  navEl.setAttribute("aria-label", "Platforms at this location");
  navEl.hidden = pageCount <= 1;

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "o-map-popup-stack-nav-btn";
  prevBtn.textContent = "‹ Prev";
  prevBtn.setAttribute("aria-label", "Previous platform");

  const statusEl = document.createElement("span");
  statusEl.className = "o-map-popup-stack-nav-status";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "o-map-popup-stack-nav-btn";
  nextBtn.textContent = "Next ›";
  nextBtn.setAttribute("aria-label", "Next platform");

  navEl.append(prevBtn, statusEl, nextBtn);
  if (pageCount > 1) {
    root.append(navEl, pageEl);
  } else {
    root.append(pageEl);
  }

  const renderPage = () => {
    const group = groups[pageIndex]!;
    const platformNumber = pageIndex + 1;
    const refLabel = platformRefForGroup(group);
    pageEl.setAttribute(
      "aria-label",
      pageCount > 1
        ? `${refLabel || "Platform"} (${platformNumber} of ${pageCount})`
        : refLabel || "Platform"
    );
    pageEl.innerHTML = stackGroupPageInnerHtml(group);

    if (pageCount > 1) {
      const refPart = refLabel || "Platform";
      statusEl.textContent = `${refPart} · ${platformNumber} / ${pageCount}`;
      prevBtn.disabled = pageIndex <= 0;
      nextBtn.disabled = pageIndex >= pageCount - 1;
    }

    requestAnimationFrame(() => {
      stackPopupView?.container
        ?.querySelector(".esri-popup")
        ?.dispatchEvent(new Event("o-stack-popup-layout"));
    });
  };

  const goToPage = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= pageCount) return;
    pageIndex = nextIndex;
    renderPage();
  };

  const onPrev = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    goToPage(pageIndex - 1);
  };

  const onNext = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    goToPage(pageIndex + 1);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (pageCount <= 1) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToPage(pageIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToPage(pageIndex + 1);
    }
  };

  prevBtn.addEventListener("click", onPrev);
  nextBtn.addEventListener("click", onNext);
  root.addEventListener("keydown", onKeyDown);

  renderPage();

  return () => {
    prevBtn.removeEventListener("click", onPrev);
    nextBtn.removeEventListener("click", onNext);
    root.removeEventListener("keydown", onKeyDown);
    stackPopupCleanups.delete(graphic);
  };
}

const mooringStackCustomContent = new CustomContent({
  outFields: ["*", STACK_MEMBERS_JSON_FIELD],
  creator: (event) => {
    const graphic = event?.graphic;
    if (!graphic) return "";

    const attrs = graphic.attributes as Record<string, unknown>;
    const members = parseColocatedMembersFromAttrs(attrs);
    if (members.length === 0) {
      const stackMask = Number(attrs.stack_mask ?? 0);
      const ptfRef = String(attrs.ptf_ref ?? "").trim();
      const network = goosNetworksFromStackAttrs(attrs, stackMask);
      return inspectPopupBodyHtml(attrs, network, ptfRef);
    }

    const groups = groupStackMembers(members);
    const root = document.createElement("div");
    const cleanup = mountMooringStackPaginatedPopup(root, groups, graphic);
    stackPopupCleanups.set(graphic, cleanup);
    return root;
  },
  destroyer: (event) => {
    const graphic = event?.graphic;
    if (!graphic) return;
    stackPopupCleanups.get(graphic)?.();
  },
});

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
    title: ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
      const members = parseColocatedMembersFromAttrs(graphic.attributes);
      if (members.length >= 2) {
        return colocatedClusterPopupTitle(members);
      }
      if (members.length === 1) {
        const only = members[0]!;
        return platformInspectPopupTitle(
          only.layer_id,
          only.ptf_ref,
          graphic.attributes
        );
      }
      return stackInspectPopupTitle(
        Number(graphic.attributes?.stack_mask ?? 0),
        String(graphic.attributes?.ptf_ref ?? ""),
        graphic.attributes
      );
    },
    content: [mooringStackCustomContent],
  });
}

/** Paginated inspect popup for any co-located platform points (GLOSS, moorings, …). */
export const colocatedPlatformsPopupTemplate = mooringStackPopupTemplate;

/** @deprecated Use platformInspectPopupContent via platformPointPopupTemplate */
export function platformPopupContent(cat: { id: string }) {
  return platformInspectPopupContent(cat.id);
}

export function mooringStackInspectPopupContent() {
  return mooringStackCustomContent;
}

/** @deprecated Use mooringStackInspectPopupContent via mooringStackPopupTemplate */
export function mooringStackPopupContent() {
  return mooringStackInspectPopupContent();
}
