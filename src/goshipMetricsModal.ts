import { createLineStyleRow, getCategoryById, makeNetworkPicto } from "./categorySwatch";
import { appendCountryFlag } from "./countryFlags";
import { closeCountryMetricsModal } from "./countryMetricsModal";
import { closeSoconetMetricsModal } from "./soconetMetricsModal";
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

const LAST_12_MONTHS = "the last 12 months";

function buildSampledLinesTable(stats: GoshipEditionStats): HTMLTableElement {
  const table = document.createElement("table");
  table.className =
    "o-country-modal-emanuela-table o-country-modal-emanuela-table--goship";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th scope="col">Lines count</th>
      <th scope="col">Lines</th>
      <th scope="col">Operating country</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const row of stats.sampledLinesByCountry) {
    const tr = document.createElement("tr");

    const countCell = document.createElement("td");
    countCell.className = "o-country-modal-emanuela-count";
    countCell.textContent = row.lineCount.toLocaleString();

    const lineCell = document.createElement("td");
    lineCell.className = "o-country-modal-goship-line-name";
    appendGoshipLineNames(lineCell, row.lineNames);

    const countryCell = document.createElement("td");
    countryCell.className = "o-country-modal-emanuela-country";
    const flag = document.createElement("span");
    flag.className = "o-country-modal-contributor-flag";
    flag.setAttribute("title", row.countryLabel);
    flag.setAttribute("aria-label", row.countryLabel);
    appendCountryFlag(flag, row.isoCode, row.countryLabel);
    countryCell.appendChild(flag);

    tr.append(countCell, lineCell, countryCell);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

function appendSummary(parent: HTMLElement, stats: GoshipEditionStats): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const sampledList = document.createElement("ul");
  sampledList.className =
    "o-country-modal-list o-country-modal-list--expandable o-country-modal-list--goship-expandable";

  const block = document.createElement("li");
  block.className = "o-country-modal-platform-block";

  const header = document.createElement("div");
  header.className = "o-country-modal-platform-header";

  const lineLabel = createLineStyleRow(
    goshipLineColor(),
    "solid",
    `${stats.sampledLineCount.toLocaleString()} lines sampled in ${LAST_12_MONTHS}`
  );
  lineLabel.classList.add("o-country-modal-line-style-stat");
  lineLabel.style.flex = "1";

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "o-country-modal-text-expand-btn";
  expandBtn.setAttribute("aria-expanded", "false");
  expandBtn.setAttribute("aria-label", "Show sampled lines by country");
  expandBtn.textContent = "By country";

  header.append(lineLabel, expandBtn);

  const panel = document.createElement("div");
  panel.className = "o-goship-sampled-panel";
  panel.hidden = true;

  if (stats.sampledLinesByCountry.length === 0) {
    const empty = document.createElement("p");
    empty.className = "o-country-modal-empty";
    empty.textContent = "No sampled lines in the last 12 months.";
    panel.appendChild(empty);
  } else {
    panel.appendChild(buildSampledLinesTable(stats));
  }

  expandBtn.addEventListener("click", () => {
    const open = block.classList.toggle("open");
    panel.hidden = !open;
    expandBtn.setAttribute("aria-expanded", String(open));
    expandBtn.textContent = open ? "Hide" : "By country";
    expandBtn.setAttribute(
      "aria-label",
      open ? "Hide sampled lines by country" : "Show sampled lines by country"
    );
  });

  block.append(header, panel);
  sampledList.appendChild(block);
  section.appendChild(sampledList);

  const dashList = document.createElement("ul");
  dashList.className = "o-country-modal-list o-country-modal-list--line-style";
  appendLineStyleStatLine(
    dashList,
    "dash",
    `${stats.unsampledLineCount.toLocaleString()} lines to be sampled in the next decade`
  );
  section.appendChild(dashList);

  parent.appendChild(section);
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

function appendGoshipLineNames(cell: HTMLElement, lineNames: string[]): void {
  lineNames.forEach((lineName, index) => {
    if (index > 0) {
      cell.append(", ");
    }
    const link = document.createElement("a");
    link.href = `${INSPECT_LINE_BASE}${encodeURIComponent(lineName)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = lineName;
    cell.appendChild(link);
  });
}

export async function openGoshipMetricsModal(
  periodSince: string,
  periodUntil: string
): Promise<void> {
  closeCountryMetricsModal();
  closeSoconetMetricsModal();
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
  title.textContent = "GO-SHIP Decadal Reference lines";
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
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load GO-SHIP breakdown.</p>`;
  }
}
