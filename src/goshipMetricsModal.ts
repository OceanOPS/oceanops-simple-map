import { createLineStyleRow, getCategoryById, makeNetworkPicto } from "./categorySwatch";
import { closeCountryMetricsModal } from "./countryMetricsModal";
import {
  loadGoshipEditionStats,
  type GoshipEditionStats,
} from "./goshipEditionStats";

const MODAL_ID = "goship-metrics-modal";

function removeExistingModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export function closeGoshipMetricsModal(): void {
  removeExistingModal();
  document.body.classList.remove("o-country-modal-open");
}

const INSPECT_LINE_BASE = "https://www.ocean-ops.org/board/wa/InspectLine?name=";

function goshipLineColor(): string {
  return getCategoryById("goship")?.color ?? "#ee2f2b";
}

function editionSinceYear(periodSince: string): string {
  return periodSince.slice(0, 4);
}

function appendStatLine(list: HTMLElement, text: string): void {
  const item = document.createElement("li");
  item.textContent = text;
  list.appendChild(item);
}

function appendLineStyleStatLine(
  list: HTMLElement,
  style: "solid" | "dash",
  label: string
): void {
  const item = document.createElement("li");
  item.className = "o-country-modal-line-style-stat";
  item.appendChild(createLineStyleRow(goshipLineColor(), style, label));
  list.appendChild(item);
}

function extraCruiseCount(stats: GoshipEditionStats): number {
  return stats.linesWithMultipleCruises.reduce(
    (sum, row) => sum + Math.max(0, row.cruises.length - 1),
    0
  );
}

function sharedCruiseDeduction(stats: GoshipEditionStats): number {
  return stats.sharedCruises.reduce(
    (sum, row) => sum + Math.max(0, row.lines.length - 1),
    0
  );
}

function appendSummary(parent: HTMLElement, stats: GoshipEditionStats): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  heading.className = "o-country-modal-section-title";
  heading.textContent = "Edition window";
  section.appendChild(heading);

  const period = document.createElement("p");
  period.className = "o-country-modal-section-desc";
  period.textContent = `${stats.periodSince} → ${stats.periodUntil}`;
  section.appendChild(period);

  const list = document.createElement("ul");
  list.className = "o-country-modal-list o-country-modal-list--line-style";

  const sinceYear = editionSinceYear(stats.periodSince);

  appendStatLine(
    list,
    `${stats.designLineCount.toLocaleString()} GO-SHIP design lines on map`
  );
  appendLineStyleStatLine(
    list,
    "solid",
    `${stats.sampledLineCount.toLocaleString()} — Sampled since ${sinceYear}`
  );
  appendStatLine(
    list,
    `${stats.distinctCruiseCount.toLocaleString()} distinct cruises on sampled lines (legend counts cruises, not lines)`
  );
  appendLineStyleStatLine(
    list,
    "dash",
    `${stats.unsampledLineCount.toLocaleString()} — Not sampled since ${sinceYear}`
  );
  appendStatLine(
    list,
    `${stats.legendCruiseCount.toLocaleString()} edition cruises (legend count, lead program country)`
  );
  if (stats.lineAssociationCount !== stats.distinctCruiseCount) {
    appendStatLine(
      list,
      `${stats.lineAssociationCount.toLocaleString()} line–cruise links (same cruise can appear on several lines)`
    );
  }

  section.appendChild(list);
  parent.appendChild(section);
}

function appendCountryList(
  parent: HTMLElement,
  stats: GoshipEditionStats
): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  heading.className = "o-country-modal-section-title";
  heading.textContent = "Edition cruises by lead program country";
  section.appendChild(heading);

  const desc = document.createElement("p");
  desc.className = "o-country-modal-section-desc";
  desc.textContent =
    "Partner export counts distinct cruises (not lines), attributed to the lead cruise program country.";
  section.appendChild(desc);

  if (stats.cruisesByCountry.length === 0) {
    const empty = document.createElement("p");
    empty.className = "o-country-modal-empty";
    empty.textContent = "No edition cruises recorded.";
    section.appendChild(empty);
    parent.appendChild(section);
    return;
  }

  const list = document.createElement("ul");
  list.className = "o-country-modal-list";
  for (const row of stats.cruisesByCountry) {
    const item = document.createElement("li");
    item.textContent = `${row.country} (${row.count.toLocaleString()})`;
    list.appendChild(item);
  }
  section.appendChild(list);
  parent.appendChild(section);
}

function appendSampledLines(parent: HTMLElement, stats: GoshipEditionStats): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const headingWrap = document.createElement("div");
  headingWrap.className = "o-country-modal-section-title-row";
  headingWrap.appendChild(
    createLineStyleRow(
      goshipLineColor(),
      "solid",
      "Sampled lines"
    )
  );
  section.appendChild(headingWrap);

  const list = document.createElement("ul");
  list.className = "o-country-modal-line-names";
  for (const lineName of stats.sampledLineNames) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `${INSPECT_LINE_BASE}${encodeURIComponent(lineName)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = lineName;
    item.appendChild(link);
    list.appendChild(item);
  }
  section.appendChild(list);
  parent.appendChild(section);
}

function appendUnsampledLines(parent: HTMLElement, stats: GoshipEditionStats): void {
  if (stats.unsampledLineCount === 0) return;

  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const headingWrap = document.createElement("div");
  headingWrap.className = "o-country-modal-section-title-row";
  headingWrap.appendChild(
    createLineStyleRow(
      goshipLineColor(),
      "dash",
      "Not sampled in edition"
    )
  );
  section.appendChild(headingWrap);

  const list = document.createElement("ul");
  list.className = "o-country-modal-list o-country-modal-list--expandable";

  for (const group of stats.unsampledByStatus) {
    const block = document.createElement("li");
    block.className = "o-country-modal-platform-block";

    const header = document.createElement("div");
    header.className = "o-country-modal-platform-header";

    const label = document.createElement("span");
    label.className = "o-country-modal-network";
    label.textContent = group.status;

    const count = document.createElement("span");
    count.className = "o-legend-count";
    count.textContent = ` (${group.count.toLocaleString()})`;

    header.append(label, count);

    if (group.lineNames.length > 0) {
      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "o-country-modal-expand-btn";
      expandBtn.setAttribute("aria-expanded", "false");
      expandBtn.setAttribute("aria-label", `Show lines for ${group.status}`);
      expandBtn.textContent = "+";
      header.appendChild(expandBtn);

      const children = document.createElement("ul");
      children.className = "o-country-modal-line-names";
      children.hidden = true;

      for (const lineName of group.lineNames) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `${INSPECT_LINE_BASE}${encodeURIComponent(lineName)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = lineName;
        item.appendChild(link);
        children.appendChild(item);
      }

      expandBtn.addEventListener("click", () => {
        const open = block.classList.toggle("open");
        children.hidden = !open;
        expandBtn.setAttribute("aria-expanded", String(open));
        expandBtn.textContent = open ? "−" : "+";
      });

      block.append(header, children);
    } else {
      block.appendChild(header);
    }

    list.appendChild(block);
  }

  section.appendChild(list);
  parent.appendChild(section);
}

function appendLegendVsLinesExplanation(
  parent: HTMLElement,
  stats: GoshipEditionStats
): void {
  if (stats.distinctCruiseCount === stats.sampledLineCount) return;

  const extra = extraCruiseCount(stats);
  const shared = sharedCruiseDeduction(stats);
  const lines = stats.sampledLineCount;
  const cruises = stats.distinctCruiseCount;

  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  heading.className = "o-country-modal-section-title";
  heading.textContent = `Why ${cruises} ≠ ${lines}`;
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "o-country-modal-list";

  appendStatLine(
    list,
    `${lines.toLocaleString()} = sampled lines (solid on map)`
  );
  appendStatLine(
    list,
    `${cruises.toLocaleString()} = distinct edition cruises (legend count)`
  );

  if (extra > 0) {
    const multiDetail = stats.linesWithMultipleCruises
      .map((row) => {
        const dates = row.cruises
          .map((cruise) => cruise.cruise_date || cruise.cruise_ref || "—")
          .join(", ");
        return `${row.lineName} (${dates})`;
      })
      .join("; ");
    appendStatLine(
      list,
      `+${extra.toLocaleString()} extra cruise${extra === 1 ? "" : "s"} — ${multiDetail}`
    );
  }

  if (shared > 0) {
    for (const row of stats.sharedCruises) {
      const deduct = Math.max(0, row.lines.length - 1);
      const details = [row.shipName, row.cruiseDate, row.programCountry].filter(Boolean);
      appendStatLine(
        list,
        `−${deduct.toLocaleString()} shared cruise — ${row.cruiseRef}${details.length > 0 ? ` (${details.join(", ")})` : ""} on lines ${row.lines.join(" + ")}`
      );
    }
  }

  appendStatLine(list, `→ ${lines} + ${extra} − ${shared} = ${cruises}`);

  section.appendChild(list);
  parent.appendChild(section);
}

function appendNotes(parent: HTMLElement, stats: GoshipEditionStats): void {
  appendLegendVsLinesExplanation(parent, stats);
}

export async function openGoshipMetricsModal(
  periodSince: string,
  periodUntil: string
): Promise<void> {
  closeCountryMetricsModal();
  removeExistingModal();
  document.body.classList.add("o-country-modal-open");

  const backdrop = document.createElement("div");
  backdrop.id = MODAL_ID;
  backdrop.className = "o-country-modal-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "o-country-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "o-goship-modal-title");

  const header = document.createElement("div");
  header.className = "o-country-modal-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "o-country-modal-title-wrap";
  const picto = makeNetworkPicto("goship");
  picto.classList.add("o-country-modal-title-flag");
  const title = document.createElement("h2");
  title.id = "o-goship-modal-title";
  title.className = "o-country-modal-title";
  title.textContent = "GO-SHIP edition breakdown";
  titleWrap.append(picto, title);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "o-country-modal-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";

  header.append(titleWrap, closeBtn);

  const body = document.createElement("div");
  body.className = "o-country-modal-body";
  body.innerHTML = `<p class="o-country-modal-loading">Loading breakdown…</p>`;

  dialog.append(header, body);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    closeGoshipMetricsModal();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  document.addEventListener("keydown", onKeyDown);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  closeBtn.focus();

  try {
    const stats = await loadGoshipEditionStats(periodSince, periodUntil);
    body.replaceChildren();
    appendSummary(body, stats);
    appendNotes(body, stats);
    appendCountryList(body, stats);
    appendSampledLines(body, stats);
    appendUnsampledLines(body, stats);
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load GO-SHIP breakdown.</p>`;
  }
}
