/** GeoJSON field on moored_buoys (oceanops-data-exports/sql/moored_buoys.sql). */
export const MBN_GOOS_TIER_FIELD = "mbn_goos_tier";

/** `coastal` = operational MBN not in GTMBA (regional / coastal-national tier). */
export type MbnGoosTier = "tropical" | "coastal";

export type MbnGoosTierFilter = "all" | "tropical" | "coastal";

/** GTMBA / tropical moored buoys (GOOS tier global arrays, network 1000340). */
export const MBN_NETWORK_GTMBA_ID = 1000340;

let activeMbnGoosTierFilter: MbnGoosTierFilter = "all";

export function getMbnGoosTierFilter(): MbnGoosTierFilter {
  return activeMbnGoosTierFilter;
}

export function setMbnGoosTierFilter(filter: MbnGoosTierFilter): void {
  activeMbnGoosTierFilter = filter;
}

export function mbnGoosTierClause(filter: MbnGoosTierFilter): string {
  if (filter === "all") return "";
  return `${MBN_GOOS_TIER_FIELD} = '${filter}'`;
}

/** Combine country filter with optional MBN GOOS tier filter (moored_buoys layer). */
export function buildMooredBuoyDefinitionExpression(
  countryExpression: string,
  tierFilter: MbnGoosTierFilter = activeMbnGoosTierFilter
): string {
  const tier = mbnGoosTierClause(tierFilter);
  if (!countryExpression && !tier) return "";
  if (!countryExpression) return tier;
  if (!tier) return countryExpression;
  return `(${countryExpression}) AND (${tier})`;
}

export function appendMbnTierToFeatureWhere(
  baseWhere: string,
  tierFilter: MbnGoosTierFilter = activeMbnGoosTierFilter
): string {
  const tier = mbnGoosTierClause(tierFilter);
  if (!tier) return baseWhere;
  if (!baseWhere || baseWhere === "1=1") return tier;
  return `(${baseWhere}) AND (${tier})`;
}

/** `stack_mask` values that include the moored_buoys bit (GeoJSON queries avoid bitwise ops). */
export const MOORED_STACK_MASK_VALUES = [1, 3, 5, 7] as const;

/** Co-located stack pins copy moored anchor props (incl. `mbn_goos_tier`). */
export function buildMooringStackMbnTierClause(
  tierFilter: MbnGoosTierFilter = activeMbnGoosTierFilter
): string {
  const tier = mbnGoosTierClause(tierFilter);
  if (!tier) return "";
  const masks = MOORED_STACK_MASK_VALUES.join(",");
  return `stack_mask IN (${masks}) AND (${tier})`;
}
