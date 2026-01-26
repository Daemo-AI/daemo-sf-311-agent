// src/services/nibrs.schemas.ts
// Zod schemas for NIBRS BigQuery functions

import { z } from "zod";

// =============================================================================
//  CUSTOM QUERY INPUT/OUTPUT SCHEMAS
// =============================================================================

export const ExecuteCustomQueryInput = z.object({
  sql: z
    .string()
    .describe(
      "Custom SQL query to execute against the NIBRS BigQuery database. Must be SELECT only. Available tables: agencies, administrative_segment, offense_segment, victim_segment, arrestee_segment, law_enforcement_employees. All in dataset 'daemo-daemon-testing.nibrs_data'.",
    ),
  limit: z
    .number()
    .nullish()
    .transform((val) => val ?? 10000)
    .describe("Maximum rows to return (capped at 10000)"),
});

export const CustomQueryOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
  columns: z.array(z.string()),
  truncated: z.boolean(),
});

// =============================================================================
//  CATEGORY 1: CORE AGGREGATION
// =============================================================================

export const GetOffenseCountsInput = z.object({
  offense_codes: z
    .array(z.string())
    .nullish()
    .describe(
      "Filter by specific UCR offense codes (e.g., ['09A', '120']). If not provided, returns all offenses.",
    ),
  state_abbr: z
    .string()
    .nullish()
    .describe(
      "Filter by state abbreviation (e.g., 'CA', 'NY'). If not provided, returns all states.",
    ),
  ori: z
    .string()
    .nullish()
    .describe(
      "Filter by specific agency ORI code. If not provided, returns all agencies.",
    ),
  start_date: z
    .string()
    .nullish()
    .describe(
      "Filter incidents on or after this date (format: 'YYYY-MM-DD'). Affects which incidents are included in counts.",
    ),
  end_date: z
    .string()
    .nullish()
    .describe(
      "Filter incidents on or before this date (format: 'YYYY-MM-DD'). Affects which incidents are included in counts.",
    ),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe(
      "Filter by data year. Defaults to 2024. This determines which year's data to analyze.",
    ),
  weapon_involved: z
    .boolean()
    .nullish()
    .describe(
      "If true, only includes offenses where a weapon was involved. If false or not provided, includes all offenses regardless of weapon.",
    ),
  location_types: z
    .array(z.string())
    .nullish()
    .describe(
      "Filter by location types (e.g., ['14', '20'] for 'Residence/Home', 'Street/Highway'). Only includes offenses at these locations.",
    ),
  bias_motivation: z
    .array(z.string())
    .nullish()
    .describe(
      "Filter by bias motivation codes for hate crimes. Only includes offenses with these bias motivations.",
    ),
  group_by: z
    .array(z.string())
    .nullish()
    .describe(
      "Fields to group results by (e.g., ['state_abbr', 'ucr_offense_code']). Valid values: 'state_abbr', 'ucr_offense_code', 'data_year', 'ori', 'agency_name'. Determines how results are aggregated.",
    ),
});

export const GetOffenseCountsOutput = z.object({
  results: z.array(
    z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  ),
  row_count: z.number(),
});

export const GetOffenseRatesInput = z.object({
  offense_codes: z
    .array(z.string())
    .nullish()
    .describe(
      "Filter by specific UCR offense codes. If not provided, calculates rates for all offenses combined.",
    ),
  state_abbr: z
    .string()
    .nullish()
    .describe("Filter by state. If not provided, returns all states."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe(
      "Year to calculate rates for. Defaults to 2024. Must be 2024 or earlier for valid population data.",
    ),
  min_population: z
    .number()
    .nullish()
    .describe(
      "Only include agencies with population >= this value. Useful for filtering to large cities (e.g., 100000).",
    ),
  group_by: z
    .enum(["state", "agency", "region"])
    .describe(
      "How to aggregate rates: 'state' for state-level rates, 'agency' for city/agency-level rates, 'region' for regional aggregation.",
    ),
});

export const GetOffenseRatesOutput = z.object({
  results: z.array(
    z.object({
      offense_count: z.number(),
      total_population: z.number(),
      rate_per_100k: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetIncidentDetailsInput = z.object({
  state_abbr: z
    .string()
    .nullish()
    .describe("Filter by state. If not provided, searches all states."),
  ori: z
    .string()
    .nullish()
    .describe("Filter by specific agency ORI code."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to search. Defaults to 2024."),
  min_victims: z
    .number()
    .nullish()
    .describe(
      "Only return incidents with at least this many victims. Use for mass casualty events (e.g., 4 for mass shootings).",
    ),
  min_offenses: z
    .number()
    .nullish()
    .describe(
      "Only return incidents with at least this many offense segments.",
    ),
  offense_codes: z
    .array(z.string())
    .nullish()
    .describe(
      "Only return incidents containing at least one of these offense codes.",
    ),
});

export const GetIncidentDetailsOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
});

export const GetClearanceStatsInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  ori: z.string().nullish().describe("Filter by specific agency."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
  group_by: z
    .enum(["state", "agency", "offense_code"])
    .describe(
      "How to group clearance statistics: by state, agency, or offense type.",
    ),
});

export const GetClearanceStatsOutput = z.object({
  results: z.array(
    z.object({
      total_incidents: z.number(),
      incidents_with_arrests: z.number(),
      clearance_rate_pct: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetAgencyListInput = z.object({
  state_abbr: z.string().nullish().describe("Filter by state."),
  min_population: z
    .number()
    .nullish()
    .describe(
      "Minimum population threshold. Only returns agencies with population >= this value.",
    ),
  max_population: z
    .number()
    .nullish()
    .describe(
      "Maximum population threshold. Only returns agencies with population <= this value.",
    ),
  agency_type: z
    .string()
    .nullish()
    .describe(
      "Filter by agency type (e.g., 'City', 'County', 'State Police').",
    ),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to get population data from."),
});

export const GetAgencyListOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
});

// =============================================================================
//  CATEGORY 2: TEMPORAL ANALYSIS
// =============================================================================

export const GetOffensesByTimeOfDayInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetOffensesByTimeOfDayOutput = z.object({
  results: z.array(
    z.object({
      hour_of_day: z.number(),
      offense_count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetOffensesByDayOfWeekInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetOffensesByDayOfWeekOutput = z.object({
  results: z.array(
    z.object({
      day_of_week: z.number(),
      day_name: z.string(),
      offense_count: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetOffensesByMonthInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetOffensesByMonthOutput = z.object({
  results: z.array(
    z.object({
      month_num: z.number(),
      month_name: z.string(),
      offense_count: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetYearOverYearTrendsInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  ori: z.string().nullish().describe("Filter by specific agency."),
  start_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2020)
    .describe("Starting year for trend analysis."),
  end_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Ending year for trend analysis."),
  include_rates: z
    .boolean()
    .nullish()
    .transform((val) => val ?? false)
    .describe(
      "If true, calculates per-capita rates in addition to raw counts. Requires valid population data.",
    ),
});

export const GetYearOverYearTrendsOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
});

// =============================================================================
//  CATEGORY 3: DEMOGRAPHIC ANALYSIS
// =============================================================================

export const GetVictimDemographicsInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
  group_by: z
    .array(z.string())
    .describe(
      "Fields to group by: 'sex_of_victim', 'race_of_victim', 'age_of_victim', 'ethnicity'. Determines which demographic dimensions to analyze.",
    ),
});

export const GetVictimDemographicsOutput = z.object({
  results: z.array(
    z.object({
      victim_count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetArresteeDemographicsInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
  group_by: z
    .array(z.string())
    .describe(
      "Fields to group by: 'sex_of_arrestee', 'race_of_arrestee', 'age_of_arrestee', 'ethnicity'. Determines which demographic dimensions to analyze.",
    ),
  juvenile_only: z
    .boolean()
    .nullish()
    .describe("If true, only includes arrestees under 18 years old."),
});

export const GetArresteeDemographicsOutput = z.object({
  results: z.array(
    z.object({
      arrestee_count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetVictimOffenderRelationshipsInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetVictimOffenderRelationshipsOutput = z.object({
  results: z.array(
    z.object({
      relationship: z.string(),
      count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetInjuryTypesInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetInjuryTypesOutput = z.object({
  results: z.array(
    z.object({
      injury_type: z.string(),
      count: z.number(),
    }),
  ),
  row_count: z.number(),
});

// =============================================================================
//  CATEGORY 4: WEAPON & LOCATION
// =============================================================================

export const GetWeaponInvolvementInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetWeaponInvolvementOutput = z.object({
  results: z.array(
    z.object({
      weapon_type: z.string(),
      offense_count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetLocationTypesInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
});

export const GetLocationTypesOutput = z.object({
  results: z.array(
    z.object({
      location_type: z.string(),
      offense_count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

// =============================================================================
//  CATEGORY 5: COMPARISON & RANKING
// =============================================================================

export const RankAgenciesByCrimeInput = z.object({
  offense_codes: z
    .array(z.string())
    .nullish()
    .describe(
      "Filter by specific offense codes. If not provided, ranks by total crime.",
    ),
  state_abbr: z
    .string()
    .nullish()
    .describe("Filter by state. If not provided, ranks all agencies nationally."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to rank."),
  min_population: z
    .number()
    .nullish()
    .describe(
      "Minimum population to include. Useful for comparing similar-sized cities (e.g., 100000 for cities over 100k).",
    ),
  metric: z
    .enum(["total_count", "rate_per_100k"])
    .describe(
      "'total_count' ranks by absolute number of offenses. 'rate_per_100k' ranks by per-capita rate (recommended for fair comparison).",
    ),
  limit: z
    .number()
    .nullish()
    .transform((val) => val ?? 20)
    .describe("Number of top agencies to return."),
});

export const RankAgenciesByCrimeOutput = z.object({
  results: z.array(
    z.object({
      agency_name: z.string(),
      state_abbr: z.string(),
      population: z.number(),
      offense_count: z.number(),
      rate_per_100k: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const CompareAgenciesInput = z.object({
  ori_list: z
    .array(z.string())
    .describe(
      "List of agency ORI codes to compare. Use searchAgencies to find ORI codes.",
    ),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to compare."),
});

export const CompareAgenciesOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
});

export const GetPeerComparisonInput = z.object({
  ori: z.string().describe("Target agency ORI code to compare."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to compare."),
  population_range_pct: z
    .number()
    .nullish()
    .transform((val) => val ?? 20)
    .describe(
      "Percentage range for peer selection (default 20 means ±20% population). Larger values include more peers but less similar cities.",
    ),
});

export const GetPeerComparisonOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
});

// =============================================================================
//  CATEGORY 6: SPECIALIZED
// =============================================================================

export const GetHateCrimeStatsInput = z.object({
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
  exclude_no_bias: z
    .boolean()
    .nullish()
    .transform((val) => val ?? true)
    .describe(
      "If true (default), excludes offenses with no bias motivation (code '88'). Set to false to see all offenses including non-hate crimes.",
    ),
});

export const GetHateCrimeStatsOutput = z.object({
  results: z.array(
    z.object({
      bias_motivation: z.string(),
      offense_count: z.number(),
      pct_of_total: z.number(),
    }),
  ),
  row_count: z.number(),
});

export const GetArrestStatsInput = z.object({
  offense_codes: z.array(z.string()).nullish().describe("Filter by offenses."),
  state_abbr: z.string().nullish().describe("Filter by state."),
  data_year: z
    .number()
    .nullish()
    .transform((val) => val ?? 2024)
    .describe("Year to analyze."),
  arrest_type: z
    .string()
    .nullish()
    .describe(
      "Filter by arrest type: 'O' (On-View), 'S' (Summoned/Cited), 'T' (Taken into Custody).",
    ),
  group_by: z
    .array(z.string())
    .nullish()
    .describe(
      "Fields to group by (e.g., ['ucr_arrest_offense_code', 'state_abbr']). Determines how arrest statistics are aggregated.",
    ),
});

export const GetArrestStatsOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
});

// =============================================================================
//  HELPER FUNCTIONS
// =============================================================================

export const SearchAgenciesInput = z.object({
  search_term: z
    .string()
    .describe(
      "Search term to find agencies. Searches in agency name, county, and state name.",
    ),
  state_abbr: z
    .string()
    .nullish()
    .describe("Optional: restrict search to specific state."),
  limit: z
    .number()
    .nullish()
    .transform((val) => val ?? 20)
    .describe("Maximum number of results to return."),
});

export const SearchAgenciesOutput = z.object({
  results: z.array(
    z.object({
      ori: z.string(),
      agency_name: z.string(),
      state_abbr: z.string(),
      state_name: z.string(),
      counties: z.string().nullable(),
      agency_type_name: z.string(),
    }),
  ),
  row_count: z.number(),
});
