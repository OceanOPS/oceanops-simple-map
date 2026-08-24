export type { CountryLayerCount } from "./partnerCountriesData";
export {
  getCountryBreakdownFromPartner,
  getCountryTotalFromPartner,
  getFilterableCountryNames,
  getNetworkTotalFromPartner,
  getPartnerDataSnapshot,
  loadPartnerCountriesData,
  type PartnerCountriesFile,
} from "./partnerCountriesData";
export {
  getCountryBreakdownFromMap,
  getCountryLineBreakdownFromPartner,
  getCountryLineCrossCruisePlatformCountryBreakdownFromMap,
  getCountryLineCrossCruiseTotalFromMap,
  getCountryLineDetailsFromMap,
  getCountryLineTotalFromMap,
  getCountryLineTotalFromPartner,
  getCountryProgramTotalFromMap,
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
  CountryLineNetworkDetail,
  CountryContributorCount,
  PlatformCountryCount,
  PlatformWithCountries,
} from "./countryMapCounts";

/** Partner export totals (ISO rollup). Report card / legacy. */
export { getCountryTotalFromPartner as getCountryTotal } from "./partnerCountriesData";
export { getCountryBreakdownFromPartner as getCountryNetworkBreakdown } from "./partnerCountriesData";
