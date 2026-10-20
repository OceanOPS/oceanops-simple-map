import type { CountryName } from "./countryFilters";

/**
 * Editorial copy (GOOS Status Report #131) — countries that fund or host OceanOPS.
 * Shown in the country metrics modal below International Cooperation.
 */
export const OCEANOPS_COUNTRY_CONTRIBUTIONS: Partial<
  Record<CountryName, string>
> = {
  AUSTRALIA:
    "Australia contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo, OceanSITES, VOS, ASAP, OceanTraX, MB and DB networks.",
  CANADA:
    "Canada contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo, MB and DB networks.",
  CHINA:
    "China contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo network.",
  EUROPE:
    "The European Union contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo, MB, DB, VOS, ASAP, SOCONET and GO-SHIP networks through Euro-Argo ERIC, EUMETNET and European Commission-funded projects, including AMRIT, Euro-GOSHIP, TRICUSO and TRUSTED.",
  FRANCE:
    "France hosts OceanOPS staff and IT infrastructure, contributes to OceanOPS coordination and monitoring activities, and provides specific support for the Argo, OceanSITES and OceanGliders networks.",
  GERMANY:
    "Germany contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo network.",
  INDIA:
    "India contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo network.",
  ITALY:
    "Italy contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo network.",
  JAPAN:
    "Japan contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo network.",
  "NEW ZEALAND":
    "New Zealand contributes to OceanOPS coordination and monitoring activities and provides specific support for the MB, DB, VOS, ASAP and OceanTraX networks.",
  "SOUTH AFRICA":
    "South Africa contributes to OceanOPS coordination and monitoring activities and provides specific support for the MB and DB networks.",
  UK:
    "The United Kingdom contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo network.",
  USA:
    "The United States contributes to OceanOPS coordination and monitoring activities and provides specific support for the Argo, VOS, ASAP, OceanTraX, MB, DB, OceanGliders, SOCONET, OceanSITES and GO-SHIP networks.",
};

export function getOceanOpsCountryContribution(
  country: CountryName
): string | undefined {
  return OCEANOPS_COUNTRY_CONTRIBUTIONS[country];
}
