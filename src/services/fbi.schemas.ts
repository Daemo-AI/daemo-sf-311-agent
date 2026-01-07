// src/services/fbi.schemas.ts
import { z } from "zod";

// =============================================================================
//  1. GEOGRAPHIC ENUMS
// =============================================================================

export const StateAbbrEnum = z
  .enum([
    "AK",
    "AL",
    "AR",
    "AZ",
    "CA",
    "CO",
    "CT",
    "DC",
    "DE",
    "FL",
    "GA",
    "HI",
    "IA",
    "ID",
    "IL",
    "IN",
    "KS",
    "KY",
    "LA",
    "MA",
    "MD",
    "ME",
    "MI",
    "MN",
    "MO",
    "MS",
    "MT",
    "NC",
    "ND",
    "NE",
    "NH",
    "NJ",
    "NM",
    "NV",
    "NY",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VA",
    "VI",
    "VT",
    "WA",
    "WI",
    "WV",
    "WY",
  ])
  .describe("Two-letter state abbreviation.");

export const RegionEnum = z
  .enum(["M", "N", "S", "W"])
  .describe("Region Codes: M (Midwest), N (Northeast), S (South), W (West)");

// NIBRS Estimation uses Integer IDs for states, not Abbrs.
// Mapping derived from Swagger HTML <option value="1">name: Alaska</option>
export const NibsEstStateIdEnum = z
  .enum([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "30",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "50",
    "51",
    "52",
    "53",
    "54",
    "55",
    "56",
    "57",
    "98",
    "99",
  ])
  .describe(
    "Numeric State ID for Estimation endpoints. 1=AK, 6=CA, 38=NY, 48=TX, 51=VA, etc.",
  );

// =============================================================================
//  2. OFFENSE CODE ENUMS
// =============================================================================

// SRS (Summary Reporting System) Offenses
export const SRSOffenseEnum = z
  .enum(["V", "P", "HOM", "RPE", "ROB", "ASS", "BUR", "LAR", "MVT", "ARS"])
  .describe(
    "SRS Offense Codes: V (Violent), P (Property), HOM (Homicide), RPE (Rape), ROB (Robbery), ASS (Assault), BUR (Burglary), LAR (Larceny), MVT (Motor Vehicle Theft), ARS (Arson)",
  );

// Supplemental Property Offenses
export const SupplementalOffenseEnum = z
  .enum(["NB", "NL", "NMVT", "NROB"])
  .describe(
    "Supplemental Codes: NB (Burglary), NL (Larceny), NMVT (Motor Vehicle Theft), NROB (Robbery)",
  );

// Arrest Offense Codes (Complete List from Swagger)
export const ArrestOffenseEnum = z
  .enum([
    "all",
    "11",
    "12",
    "30",
    "50",
    "55",
    "60",
    "70",
    "90",
    "150",
    "260",
    "35A",
    "35B",
    "310",
    "110",
    "101",
    "330",
    "290",
    "158",
    "157",
    "160",
    "159",
    "156",
    "153",
    "152",
    "155",
    "154",
    "151",
    "280",
    "200",
    "180",
    "190",
    "173",
    "171",
    "172",
    "170",
    "102",
    "270",
    "250",
    "140",
    "142",
    "141",
    "143",
    "23",
    "20",
    "240",
    "210",
    "300",
    "220",
    "230",
  ])
  .describe(
    "Arrest Codes: all, 11 (Murder), 12 (Negligent Manslaughter), 30 (Robbery), 50 (Assault-Not Spec), 55 (Simple Assault), 60 (Burglary), 70 (Larceny), 90 (Vehicle Theft), 150 (Drug Abuse), 260 (DUI), 110 (Arson), 101 (Commercial Sex), 290 (Disorderly Conduct), 35A (Drug Violations), 35B (Drug Equipment), 200 (Embezzlement), 180 (Forgery), 190 (Fraud), 170 (Gambling), 140 (Prostitution), 23 (Rape), 240 (Sex Offenses), 230 (Weapons)",
  );

// NIBRS Offense Codes (Complete List from Swagger)
export const NIBRSOffenseEnum = z
  .enum([
    "09A",
    "09B",
    "09C",
    "100",
    "11A",
    "11B",
    "11C",
    "11D",
    "120",
    "13A",
    "13B",
    "13C",
    "200",
    "210",
    "220",
    "23A",
    "23B",
    "23C",
    "23D",
    "23E",
    "23F",
    "23G",
    "23H",
    "23*",
    "240",
    "250",
    "26A",
    "26B",
    "26C",
    "26D",
    "26E",
    "26F",
    "26G",
    "26H",
    "270",
    "280",
    "290",
    "30A",
    "30B",
    "30C",
    "30D",
    "35A",
    "35B",
    "360",
    "36A",
    "36B",
    "370",
    "39A",
    "39B",
    "39C",
    "39D",
    "40A",
    "40B",
    "40C",
    "49A",
    "49B",
    "49C",
    "510",
    "520",
    "521",
    "522",
    "526",
    "58A",
    "58B",
    "61A",
    "61B",
    "64A",
    "64B",
    "720",
  ])
  .describe(
    "NIBRS Codes: 09A (Murder), 09B (Negligent Manslaughter), 100 (Kidnapping), 11A (Rape), 120 (Robbery), 13A (Aggravated Assault), 13B (Simple Assault), 13C (Intimidation), 200 (Arson), 220 (Burglary), 23A-H (Larceny Types), 240 (Motor Vehicle Theft), 35A (Drug Violations), 35B (Drug Equipment), 520 (Weapon Laws), 64A (Human Trafficking - Sex), 720 (Animal Cruelty)",
  );

// Bias Codes (Complete List from Swagger)
export const BiasEnum = z
  .enum([
    "all",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16", // Race
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29", // Religion
    "31",
    "32",
    "33", // Ethnicity
    "41",
    "42",
    "43",
    "44",
    "45", // Sexual Orientation
    "51",
    "52", // Disability
    "61",
    "62",
    "71",
    "72",
    "81",
    "82",
    "83",
    "84",
    "85",
  ])
  .describe(
    "Bias Codes: all, 12 (Anti-Black), 14 (Anti-Asian), 21 (Anti-Jewish), 24 (Anti-Islamic), 32 (Anti-Hispanic), 41 (Anti-Gay Male), 61 (Anti-Male), 71 (Anti-Transgender)",
  );

// =============================================================================
//  3. INPUT SCHEMAS (Grouped by Capability)
// =============================================================================

export const GetAgenciesInput = z.object({
  stateAbbr: StateAbbrEnum.describe(
    "Two-letter state abbreviation (e.g., CA, NY, VA)",
  ),
});

export const GetSummarizedCrimeInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z
    .string()
    .optional()
    .describe("Agency ORI (required for level='agency')"),
  offense: SRSOffenseEnum,
  fromYear: z.number().int().default(1985),
  toYear: z.number().int().default(2025),
});

export const GetNIBRSCrimeInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z.string().optional(),
  offense: NIBRSOffenseEnum,
  fromYear: z.number().int().default(1991),
  toYear: z.number().int().default(2025),
});

export const GetArrestInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z.string().optional(),
  offense: ArrestOffenseEnum,
  fromYear: z.number().int().default(1985),
  toYear: z.number().int().default(2025),
});

// NIBRS Estimation Input - Note the unique constraints from the docs
export const GetNIBRSEstimationInput = z.object({
  level: z.enum(["national", "state", "region"]),
  stateId: NibsEstStateIdEnum.optional().describe(
    "Numeric State ID (Required for level='state')",
  ),
  regionCode: RegionEnum.optional().describe(
    "Region Code (Required for level='region')",
  ),
  offense: NIBRSOffenseEnum,
  year: z.number().int().describe("Single Year (YYYY)"),
});

export const GetHateCrimeInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z.string().optional(),
  bias: BiasEnum.optional().describe(
    "Optional bias filter (e.g. '12' for Anti-Black)",
  ),
  fromYear: z.number().int().default(1991),
  toYear: z.number().int().default(2025),
});

export const GetSupplementalInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z.string().optional(),
  offense: SupplementalOffenseEnum,
  fromYear: z.number().int().default(1985),
  toYear: z.number().int().default(2025),
});

export const GetSHRInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z.string().optional(),
  fromYear: z.number().int().default(1985),
  toYear: z.number().int().default(2025),
});

export const GetPEInput = z.object({
  level: z.enum(["national", "state", "agency"]),
  stateAbbr: StateAbbrEnum.optional(),
  ori: z.string().optional(),
  fromYear: z.number().int().default(2000),
  toYear: z.number().int().default(2025),
});

export const GetParticipationInput = z.object({
  level: z.enum(["national", "state"]),
  stateAbbr: StateAbbrEnum.optional(),
  collection: z.enum(["uof", "uof-fed", "uof-fed-agency"]),
  year: z.number().int().default(2024),
  quarter: z.enum(["1", "2", "3", "4"]).optional(),
});

// =============================================================================
//  4. OUTPUT SCHEMAS
// =============================================================================

export const AgencyListOutput = z.array(
  z.object({
    ori: z.string(),
    agency_name: z.string(),
    agency_type_name: z.string(),
    state_abbr: z.string(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    is_nibrs: z.boolean().optional(),
  }),
);

// Flexible output for trends
export const TrendOutput = z.object({
  title: z.string(),
  data: z.array(
    z.object({
      period: z.string(),
      count: z.number(),
      rate: z.number().optional().nullable(),
    }),
  ),
  coverage: z.number().optional().nullable(),
});

// Complex output for Hate Crimes and SHR which return demographics
export const DetailedStatsOutput = z.object({
  total_count: z.number(),
  breakdown: z
    .record(z.string(), z.any())
    .optional()
    .describe("Demographics or subtypes"),
  trend_data: z.array(z.object({ period: z.string(), count: z.number() })),
});
