export type { CountryLayerCount } from "./partnerCountriesData";
export {
  getCountryBreakdownFromPartner,
  getCountryTotalFromPartner,
  getFilterableCountryNames,
  getPartnerDataSnapshot,
  loadPartnerCountriesData,
  type PartnerCountriesFile,
} from "./partnerCountriesData";
export {
  getCountryBreakdownFromMap,
  getCountrySensorBreakdownFromMap,
  getCountrySensorContributorBreakdownFromMap,
  getCountrySensorPlatformCountryBreakdownFromMap,
  getCountrySensorTotalFromMap,
  getCountryShipBreakdownFromMap,
  getCountryShipContributorBreakdownFromMap,
  getCountryShipPlatformCountryBreakdownFromMap,
  getCountryShipTotalFromMap,
  getCountryTotalFromMap,
  groupPlatformCountryRows,
} from "./countryMapCounts";
export type {
  CountryContributorCount,
  PlatformCountryCount,
  PlatformWithCountries,
} from "./countryMapCounts";

/** Partner export totals (ISO rollup). Report card / legacy. */
export { getCountryTotalFromPartner as getCountryTotal } from "./partnerCountriesData";
export { getCountryBreakdownFromPartner as getCountryNetworkBreakdown } from "./partnerCountriesData";
