// src/services/nibrs.schemas.ts
// Zod schemas for NIBRS BigQuery data functions

import { z } from "zod";

// =============================================================================
//  HELPER: Handle null/empty string -> undefined coercion
//  LLMs often pass `null` instead of omitting optional params, and sometimes
//  pass empty strings for enum fields. These helpers make schemas more lenient.
// =============================================================================

/** Coerce null or empty string to undefined for optional string fields */
const optionalString = z
  .string()
  .nullish()
  .transform((val) => (val === null || val === "" ? undefined : val));

/** Coerce null or empty string to undefined for optional number fields */
const optionalInt = z
  .number()
  .int()
  .nullish()
  .transform((val) => (val === null ? undefined : val));

/** Create an optional enum that handles null and empty string by returning undefined */
function optionalEnumWithDefault<T extends [string, ...string[]]>(
  values: T,
  defaultValue: T[number]
) {
  return z
    .enum(values)
    .nullish()
    .transform((val) => (val === null || val === "" || val === undefined ? undefined : val))
    .pipe(z.enum(values).default(defaultValue as T[number]));
}

/** Create an optional enum that just handles null/empty (no default) */
function optionalEnum<T extends [string, ...string[]]>(values: T) {
  return z
    .enum(values)
    .nullish()
    .transform((val) => (val === null || val === "" ? undefined : val))
    .optional();
}

// =============================================================================
//  1. GEOGRAPHIC & REFERENCE ENUMS
// =============================================================================

export const StateAbbrEnum = z
  .enum([
    "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL",
    "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA",
    "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE",
    "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VA", "VI", "VT", "WA", "WI",
    "WV", "WY",
  ])
  .describe("Two-letter state abbreviation");

export const AgencyTypeEnum = z
  .enum([
    "City",
    "County",
    "State Police",
    "University or College",
    "Tribal",
    "Federal",
    "Other",
  ])
  .describe("Type of law enforcement agency");

// =============================================================================
//  2. OFFENSE CODE ENUMS (Based on NIBRS UCR codes in BigQuery)
// =============================================================================

export const UCROffenseCodeEnum = z
  .enum([
    // Crimes Against Persons
    "09A", // Murder and Nonnegligent Manslaughter
    "09B", // Negligent Manslaughter
    "09C", // Justifiable Homicide
    "100", // Kidnapping/Abduction
    "11A", // Rape
    "11B", // Sodomy
    "11C", // Sexual Assault With An Object
    "11D", // Fondling
    "120", // Robbery
    "13A", // Aggravated Assault
    "13B", // Simple Assault
    "13C", // Intimidation
    // Crimes Against Property
    "200", // Arson
    "210", // Extortion/Blackmail
    "220", // Burglary/Breaking & Entering
    "23A", // Pocket-picking
    "23B", // Purse-snatching
    "23C", // Shoplifting
    "23D", // Theft From Building
    "23E", // Theft From Coin-Operated Machine
    "23F", // Theft From Motor Vehicle
    "23G", // Theft of Motor Vehicle Parts
    "23H", // All Other Larceny
    "240", // Motor Vehicle Theft
    "250", // Counterfeiting/Forgery
    "26A", // False Pretenses/Swindle/Confidence Game
    "26B", // Credit Card/ATM Fraud
    "26C", // Impersonation
    "26D", // Welfare Fraud
    "26E", // Wire Fraud
    "26F", // Identity Theft
    "26G", // Hacking/Computer Invasion
    "26H", // Money Laundering
    "270", // Embezzlement
    "280", // Stolen Property Offenses
    "290", // Destruction/Damage/Vandalism
    // Crimes Against Society
    "35A", // Drug/Narcotic Violations
    "35B", // Drug Equipment Violations
    "36A", // Incest
    "36B", // Statutory Rape
    "370", // Pornography/Obscene Material
    "39A", // Betting/Wagering
    "39B", // Operating/Promoting Gambling
    "39C", // Gambling Equipment Violations
    "39D", // Sports Tampering
    "40A", // Prostitution
    "40B", // Assisting/Promoting Prostitution
    "40C", // Purchasing Prostitution
    "510", // Bribery
    "520", // Weapon Law Violations
    "521", // Firearm Act Violation
    "522", // Explosives
    "526", // Weapon Offense - Use/Possession
    "58A", // Animal Cruelty - Intentional
    "58B", // Animal Cruelty - Neglect
    "61A", // Human Trafficking - Commercial Sex
    "61B", // Human Trafficking - Involuntary Servitude
    "64A", // Human Trafficking - Commercial Sex Acts
    "64B", // Human Trafficking - Involuntary Servitude (64B)
    "720", // Animal Cruelty
    "90A", // Bad Checks
    "90B", // Curfew/Loitering/Vagrancy
    "90C", // Disorderly Conduct
    "90D", // Driving Under the Influence
    "90E", // Drunkenness
    "90F", // Family Offenses - Nonviolent
    "90G", // Liquor Law Violations
    "90H", // Peeping Tom
    "90I", // Runaway
    "90J", // Trespass of Real Property
    "90Z", // All Other Offenses
  ])
  .describe("UCR offense code from NIBRS");

export const LocationTypeEnum = z
  .enum([
    "01", // Air/Bus/Train Terminal
    "02", // Bank/Savings and Loan
    "03", // Bar/Nightclub
    "04", // Church/Synagogue/Temple/Mosque
    "05", // Commercial/Office Building
    "06", // Construction Site
    "07", // Convenience Store
    "08", // Department/Discount Store
    "09", // Drug Store/Doctor's Office/Hospital
    "10", // Field/Woods
    "11", // Government/Public Building
    "12", // Grocery/Supermarket
    "13", // Highway/Road/Alley/Street/Sidewalk
    "14", // Hotel/Motel/Etc.
    "15", // Jail/Prison/Penitentiary/Corrections Facility
    "16", // Lake/Waterway/Beach
    "17", // Liquor Store
    "18", // Parking/Drop Lot/Garage
    "19", // Rental Storage Facility
    "20", // Residence/Home
    "21", // Restaurant
    "22", // School/College
    "23", // Service/Gas Station
    "24", // Specialty Store
    "25", // Other/Unknown
    "37", // Abandoned/Condemned Structure
    "38", // Amusement Park
    "39", // Arena/Stadium/Fairgrounds/Coliseum
    "40", // ATM Separate from Bank
    "41", // Auto Dealership New/Used
    "42", // Camp/Campground
    "44", // Daycare Facility
    "45", // Dock/Wharf/Freight/Modal Terminal
    "46", // Farm Facility
    "47", // Gambling Facility/Casino/Race Track
    "48", // Industrial Site
    "49", // Military Installation
    "50", // Park/Playground
    "51", // Rest Area
    "52", // School - College/University
    "53", // School - Elementary/Secondary
    "54", // Shelter - Mission/Homeless
    "55", // Shopping Mall
    "56", // Tribal Lands
    "57", // Community Center
    "58", // Cyberspace
  ])
  .describe("Location type code");

export const BiasMotivationEnum = z
  .enum([
    "11", // Anti-White
    "12", // Anti-Black or African American
    "13", // Anti-American Indian or Alaska Native
    "14", // Anti-Asian
    "15", // Anti-Multiple Races, Group
    "16", // Anti-Native Hawaiian or Other Pacific Islander
    "21", // Anti-Jewish
    "22", // Anti-Catholic
    "23", // Anti-Protestant
    "24", // Anti-Islamic (Muslim)
    "25", // Anti-Other Religion
    "26", // Anti-Multiple Religions, Group
    "27", // Anti-Atheism/Agnosticism
    "28", // Anti-Mormon
    "29", // Anti-Jehovah's Witness
    "31", // Anti-Arab
    "32", // Anti-Hispanic or Latino
    "33", // Anti-Other Race/Ethnicity/Ancestry
    "41", // Anti-Gay (Male)
    "42", // Anti-Lesbian
    "43", // Anti-Lesbian, Gay, Bisexual, or Transgender
    "44", // Anti-Heterosexual
    "45", // Anti-Bisexual
    "51", // Anti-Physical Disability
    "52", // Anti-Mental Disability
    "61", // Anti-Male
    "62", // Anti-Female
    "71", // Anti-Transgender
    "72", // Anti-Gender Non-Conforming
    "81", // Anti-Eastern Orthodox
    "82", // Anti-Other Christian
    "83", // Anti-Buddhist
    "84", // Anti-Hindu
    "85", // Anti-Sikh
    "88", // None (no bias)
    "99", // Unknown
  ])
  .describe("Bias motivation code for hate crimes");

export const WeaponForceEnum = z
  .enum([
    "11", // Firearm (type not stated)
    "12", // Handgun
    "13", // Rifle
    "14", // Shotgun
    "15", // Other Firearm
    "20", // Knife/Cutting Instrument
    "30", // Blunt Object
    "35", // Motor Vehicle
    "40", // Personal Weapons
    "50", // Poison
    "60", // Explosives
    "65", // Fire/Incendiary Device
    "70", // Drugs/Narcotics/Sleeping Pills
    "85", // Asphyxiation
    "90", // Other
    "95", // Unknown
    "99", // None
  ])
  .describe("Weapon/Force type code");

export const VictimTypeEnum = z
  .enum([
    "B", // Business
    "F", // Financial Institution
    "G", // Government
    "I", // Individual
    "L", // Law Enforcement Officer
    "O", // Other
    "R", // Religious Organization
    "S", // Society/Public
    "U", // Unknown
  ])
  .describe("Type of victim");

export const SexEnum = z
  .enum(["M", "F", "U", "X"])
  .describe("Sex: M=Male, F=Female, U=Unknown, X=Nonbinary");

export const RaceEnum = z
  .enum(["A", "B", "I", "P", "U", "W"])
  .describe("Race: A=Asian, B=Black, I=American Indian, P=Pacific Islander, U=Unknown, W=White");

export const EthnicityEnum = z
  .enum(["H", "N", "U"])
  .describe("Ethnicity: H=Hispanic, N=Not Hispanic, U=Unknown");

export const InjuryTypeEnum = z
  .enum([
    "B", // Apparent Broken Bones
    "I", // Possible Internal Injury
    "L", // Severe Laceration
    "M", // Apparent Minor Injury
    "N", // None
    "O", // Other Major Injury
    "T", // Loss of Teeth
    "U", // Unconsciousness
  ])
  .describe("Type of injury to victim");

export const RelationshipEnum = z
  .enum([
    "AQ", // Acquaintance
    "BG", // Boyfriend/Girlfriend
    "CF", // Child of Boyfriend/Girlfriend
    "CH", // Child
    "EE", // Employee
    "ER", // Employer
    "ES", // Ex-Spouse
    "FR", // Friend
    "HR", // Homosexual Relationship
    "NE", // Neighbor
    "OF", // Otherwise Known
    "OK", // Other Known
    "PA", // Parent
    "RU", // Relationship Unknown
    "SB", // Sibling
    "SE", // Stepchild
    "SP", // Spouse
    "SS", // Stepsibling
    "ST", // Stepparent
    "UN", // Unknown
    "VO", // Victim Was Offender
    "XS", // Ex-Boyfriend/Ex-Girlfriend
  ])
  .describe("Victim's relationship to offender");

export const ClearanceTypeEnum = z
  .enum([
    "A", // Cleared by Arrest
    "B", // Cleared by Exceptional Means - Death of Offender
    "C", // Cleared by Exceptional Means - Prosecution Declined
    "D", // Cleared by Exceptional Means - Extradition Denied
    "E", // Cleared by Exceptional Means - Victim Refused to Cooperate
    "J", // Cleared by Exceptional Means - Juvenile/No Custody
    "N", // Not Applicable
    "O", // Cleared by Exceptional Means - Other
  ])
  .describe("Exceptional clearance type");

// =============================================================================
//  3. INPUT SCHEMAS
// =============================================================================

// --- Agency Search ---
export const SearchAgenciesInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state abbreviation"),
  county: optionalString.describe("Filter by county name (partial match)"),
  agencyName: optionalString.describe("Filter by agency name (partial match)"),
  agencyType: optionalString.describe("Filter by agency type"),
  nibrsOnly: z.boolean().nullish().transform(val => val ?? false).describe("Only return NIBRS-participating agencies"),
  limit: z.number().nullish().transform(val => val ?? 100).describe("Maximum results to return"),
});

// --- Incident Counts ---
export const GetIncidentCountsInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by specific agency ORI"),
  fromYear: optionalInt.describe("Start year (inclusive)"),
  toYear: optionalInt.describe("End year (inclusive)"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by specific offense code"),
  groupBy: optionalEnumWithDefault(
    ["state", "year", "agency", "offense", "state_year", "offense_year", "agency_year"],
    "year"
  ).describe("How to group the results"),
  limit: z.number().nullish().transform(val => val ?? 1000).describe("Maximum results"),
});

// --- Offense Summary ---
export const GetOffenseSummaryInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  locationType: optionalEnum(LocationTypeEnum.options).describe("Filter by location type"),
  biasMotivation: optionalEnum(BiasMotivationEnum.options).describe("Filter by bias motivation (hate crimes)"),
  groupBy: optionalEnumWithDefault(
    ["offense", "location", "weapon", "bias", "offense_year"],
    "offense"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 100),
});

// --- Victim Demographics ---
export const GetVictimDemographicsInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  victimType: optionalEnum(VictimTypeEnum.options).describe("Filter by victim type (I=Individual, B=Business, etc.)"),
  groupBy: optionalEnumWithDefault(
    ["sex", "race", "ethnicity", "age_group", "victim_type", "sex_race"],
    "sex"
  ).describe("How to group demographic results"),
  limit: z.number().nullish().transform(val => val ?? 100),
});

// --- Arrestee Demographics ---
export const GetArresteeDemographicsInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalString.describe("Filter by UCR arrest offense code"),
  groupBy: optionalEnumWithDefault(
    ["sex", "race", "ethnicity", "age_group", "sex_race", "arrest_type"],
    "sex"
  ).describe("How to group demographic results"),
  limit: z.number().nullish().transform(val => val ?? 100),
});

// --- Crime Trends (Time Series) ---
export const GetCrimeTrendsInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  fromYear: z.number().int().describe("Start year"),
  toYear: z.number().int().describe("End year"),
  granularity: optionalEnumWithDefault(["year", "month"], "year").describe("Time granularity for trend data"),
});

// --- Weapon Analysis ---
export const GetWeaponAnalysisInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  groupBy: optionalEnumWithDefault(
    ["weapon", "weapon_offense", "weapon_year"],
    "weapon"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 50),
});

// --- Bias Motivation Analysis (Hate Crimes) ---
export const GetBiasAnalysisInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  biasMotivation: optionalEnum(BiasMotivationEnum.options).describe("Filter by specific bias motivation"),
  groupBy: optionalEnumWithDefault(
    ["bias", "bias_offense", "bias_year", "bias_state"],
    "bias"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 50),
});

// --- Location Type Analysis ---
export const GetLocationAnalysisInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  groupBy: optionalEnumWithDefault(
    ["location", "location_offense", "location_year"],
    "location"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 50),
});

// --- Victim Injury Analysis ---
export const GetInjuryAnalysisInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  groupBy: optionalEnumWithDefault(
    ["injury", "injury_offense", "injury_year"],
    "injury"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 50),
});

// --- Victim-Offender Relationship ---
export const GetRelationshipAnalysisInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  groupBy: optionalEnumWithDefault(
    ["relationship", "relationship_offense", "relationship_year"],
    "relationship"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 50),
});

// --- Clearance Analysis ---
export const GetClearanceAnalysisInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  groupBy: optionalEnumWithDefault(
    ["clearance_type", "state", "year", "state_year"],
    "clearance_type"
  ).describe("How to group results"),
  limit: z.number().nullish().transform(val => val ?? 100),
});

// --- Time Patterns (Hour of Day) ---
export const GetTimePatternInput = z.object({
  stateAbbr: optionalEnum(StateAbbrEnum.options).describe("Filter by state"),
  ori: optionalString.describe("Filter by agency ORI"),
  fromYear: optionalInt.describe("Start year"),
  toYear: optionalInt.describe("End year"),
  offenseCode: optionalEnum(UCROffenseCodeEnum.options).describe("Filter by offense code"),
  groupBy: optionalEnumWithDefault(
    ["hour", "hour_offense", "month"],
    "hour"
  ).describe("How to group time patterns"),
  limit: z.number().nullish().transform(val => val ?? 50),
});

// --- Custom Query ---
export const ExecuteCustomQueryInput = z.object({
  sql: z
    .string()
    .describe(
      "Custom SQL query to execute. Must be SELECT only. Available tables: agencies, administrative_segment, offense_segment, victim_segment, arrestee_segment. All in dataset 'nibrs_data'."
    ),
  limit: z.number().nullish().transform(val => val ?? 1000).describe("Maximum rows to return (capped at 10000)"),
});

// =============================================================================
//  4. OUTPUT SCHEMAS
// =============================================================================

export const AgencyOutput = z.object({
  ori: z.string(),
  agency_name: z.string(),
  agency_type_name: z.string().nullable(),
  state_abbr: z.string(),
  state_name: z.string().nullable(),
  counties: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  is_nibrs: z.boolean().nullable(),
  nibrs_start_date: z.string().nullable(),
});

export const AgencyListOutput = z.object({
  agencies: z.array(AgencyOutput),
  total_count: z.number(),
});

export const CountResultOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  total_rows: z.number(),
  query_info: z.string().optional(),
});

export const TrendDataPoint = z.object({
  period: z.string(),
  count: z.number(),
  rate: z.number().nullable().optional(),
});

export const TrendOutput = z.object({
  title: z.string(),
  data: z.array(TrendDataPoint),
  total_count: z.number(),
});

export const DemographicOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  total_count: z.number(),
});

export const CustomQueryOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
  columns: z.array(z.string()),
  truncated: z.boolean(),
});
