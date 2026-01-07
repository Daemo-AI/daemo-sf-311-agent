// src/services/fbi.schemas.ts
import { z } from "zod";

// --- Enums based on FBI Docs ---

// Common SRS Offense Codes
export const SRSOffenseEnum = z
  .enum(["V", "P", "HOM", "RPE", "ROB", "ASS", "BUR", "LAR", "MVT", "ARS"])
  .describe(
    "SRS Offense Code: V (Violent), P (Property), HOM (Homicide), RPE (Rape), ROB (Robbery), ASS (Assault), BUR (Burglary), LAR (Larceny), MVT (Motor Vehicle Theft), ARS (Arson)",
  );

// Common NIBRS Offense Codes (Subset for brevity, AI can infer others based on description)
export const NIBRSOffenseEnum = z
  .enum([
    "09A",
    "09B",
    "11A",
    "120",
    "13A",
    "13B",
    "220",
    "23A",
    "23B",
    "23H",
    "240",
    "26A",
    "26F",
    "35A",
    "520",
  ])
  .describe(
    "NIBRS Code: 09A (Murder), 13A (Aggravated Assault), 120 (Robbery), 220 (Burglary), 23H (Larceny), 240 (Motor Vehicle Theft), 35A (Drug Violations), 520 (Weapon Laws)",
  );

export const StateAbbrEnum = z.enum([
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
  "VT",
  "WA",
  "WI",
  "WV",
  "WY",
]);

// --- INPUT SCHEMAS ---

export const GetAgenciesByStateInput = z.object({
  stateAbbr: StateAbbrEnum.describe(
    "Two-letter state abbreviation (e.g., CA, NY, VA)",
  ),
});

export const GetSummarizedDataInput = z.object({
  stateAbbr: StateAbbrEnum.describe("Two-letter state abbreviation"),
  offense: SRSOffenseEnum.describe(
    "The SRS offense code to analyze (e.g., 'V' for Violent Crime)",
  ),
  fromYear: z.number().int().min(1960).max(2024).describe("Start Year (YYYY)"),
  toYear: z.number().int().min(1960).max(2024).describe("End Year (YYYY)"),
});

export const GetNationalNibrsInput = z.object({
  offense: NIBRSOffenseEnum.describe(
    "The NIBRS offense code (e.g., '13A' for Aggravated Assault)",
  ),
  fromYear: z.number().int().min(1990).max(2024).describe("Start Year (YYYY)"),
  toYear: z.number().int().min(1990).max(2024).describe("End Year (YYYY)"),
});

export const GetHateCrimeInput = z.object({
  stateAbbr: StateAbbrEnum.optional().describe(
    "Optional state abbreviation to filter by",
  ),
  biasCode: z
    .string()
    .optional()
    .describe(
      "Optional Bias Code (e.g., '12' for Anti-Black, '82' for Anti-Jewish)",
    ),
  fromYear: z.number().int().min(1991).max(2024).describe("Start Year (YYYY)"),
  toYear: z.number().int().min(1991).max(2024).describe("End Year (YYYY)"),
});

export const GetArrestDataInput = z.object({
  stateAbbr: StateAbbrEnum.describe("Two-letter state abbreviation"),
  offense: z.string().default("all").describe("Arrest offense code or 'all'"),
  fromYear: z.number().int().min(2000).max(2024).describe("Start Year (YYYY)"),
  toYear: z.number().int().min(2000).max(2024).describe("End Year (YYYY)"),
});

// --- OUTPUT SCHEMAS ---

export const AgencyOutputSchema = z.array(
  z.object({
    ori: z.string(),
    agency_name: z.string(),
    agency_type_name: z.string(),
    state_abbr: z.string(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
  }),
);

// Generic data point for graphs/trends
export const TrendOutputSchema = z.object({
  title: z.string(),
  data: z.array(
    z.object({
      year: z.string(), // Normalized from API key keys
      count: z.number(),
      rate: z.number().optional(),
    }),
  ),
});

export const HateCrimeOutputSchema = z.object({
  victim_types: z.record(z.string(), z.number()).optional(),
  offense_types: z.record(z.string(), z.number()).optional(),
  location_types: z.record(z.string(), z.number()).optional(),
  bias_motivation: z.record(z.string(), z.number()).optional(),
});
