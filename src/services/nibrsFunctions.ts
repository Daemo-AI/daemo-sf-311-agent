// src/services/nibrsFunctions.ts
// NIBRS Crime Data Functions using Google BigQuery

import { DaemoFunction } from "daemo-engine";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  SearchAgenciesInput,
  GetIncidentCountsInput,
  GetOffenseSummaryInput,
  GetVictimDemographicsInput,
  GetArresteeDemographicsInput,
  GetCrimeTrendsInput,
  GetWeaponAnalysisInput,
  GetBiasAnalysisInput,
  GetLocationAnalysisInput,
  GetInjuryAnalysisInput,
  GetRelationshipAnalysisInput,
  GetClearanceAnalysisInput,
  GetTimePatternInput,
  ExecuteCustomQueryInput,
  GetVictimsByOffenseInput,
  GetArresteesByOffenseInput,
  GetOffenseDemographicCrossInput,
  GetAttemptedCompletedInput,
  GetIncidentLevelStatsInput,
  AgencyListOutput,
  CountResultOutput,
  TrendOutput,
  DemographicOutput,
  CustomQueryOutput,
} from "./nibrs.schemas";

configDotenv();

const PROJECT_ID = "daemo-daemon-testing";
const DATASET = "nibrs_data";

// UCR Offense code descriptions for friendly output
const UCR_OFFENSE_DESCRIPTIONS: Record<string, string> = {
  "09A": "Murder and Nonnegligent Manslaughter",
  "09B": "Negligent Manslaughter",
  "09C": "Justifiable Homicide",
  "100": "Kidnapping/Abduction",
  "11A": "Rape",
  "11B": "Sodomy",
  "11C": "Sexual Assault With An Object",
  "11D": "Fondling",
  "120": "Robbery",
  "13A": "Aggravated Assault",
  "13B": "Simple Assault",
  "13C": "Intimidation",
  "200": "Arson",
  "210": "Extortion/Blackmail",
  "220": "Burglary/Breaking & Entering",
  "23A": "Pocket-picking",
  "23B": "Purse-snatching",
  "23C": "Shoplifting",
  "23D": "Theft From Building",
  "23E": "Theft From Coin-Operated Machine",
  "23F": "Theft From Motor Vehicle",
  "23G": "Theft of Motor Vehicle Parts",
  "23H": "All Other Larceny",
  "240": "Motor Vehicle Theft",
  "250": "Counterfeiting/Forgery",
  "26A": "False Pretenses/Swindle/Confidence Game",
  "26B": "Credit Card/ATM Fraud",
  "26C": "Impersonation",
  "26D": "Welfare Fraud",
  "26E": "Wire Fraud",
  "26F": "Identity Theft",
  "26G": "Hacking/Computer Invasion",
  "26H": "Money Laundering",
  "270": "Embezzlement",
  "280": "Stolen Property Offenses",
  "290": "Destruction/Damage/Vandalism",
  "35A": "Drug/Narcotic Violations",
  "35B": "Drug Equipment Violations",
  "36A": "Incest",
  "36B": "Statutory Rape",
  "370": "Pornography/Obscene Material",
  "39A": "Betting/Wagering",
  "39B": "Operating/Promoting Gambling",
  "39C": "Gambling Equipment Violations",
  "39D": "Sports Tampering",
  "40A": "Prostitution",
  "40B": "Assisting/Promoting Prostitution",
  "40C": "Purchasing Prostitution",
  "510": "Bribery",
  "520": "Weapon Law Violations",
  "521": "Firearm Act Violation",
  "522": "Explosives",
  "526": "Weapon Offense - Use/Possession",
  "58A": "Animal Cruelty - Intentional",
  "58B": "Animal Cruelty - Neglect",
  "61A": "Human Trafficking - Commercial Sex",
  "61B": "Human Trafficking - Involuntary Servitude",
  "64A": "Human Trafficking - Commercial Sex Acts",
  "64B": "Human Trafficking - Involuntary Servitude",
  "720": "Animal Cruelty",
  "90A": "Bad Checks",
  "90B": "Curfew/Loitering/Vagrancy",
  "90C": "Disorderly Conduct",
  "90D": "Driving Under the Influence",
  "90E": "Drunkenness",
  "90F": "Family Offenses - Nonviolent",
  "90G": "Liquor Law Violations",
  "90H": "Peeping Tom",
  "90I": "Runaway",
  "90J": "Trespass of Real Property",
  "90Z": "All Other Offenses",
};

const LOCATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  "01": "Air/Bus/Train Terminal",
  "02": "Bank/Savings and Loan",
  "03": "Bar/Nightclub",
  "04": "Church/Synagogue/Temple/Mosque",
  "05": "Commercial/Office Building",
  "06": "Construction Site",
  "07": "Convenience Store",
  "08": "Department/Discount Store",
  "09": "Drug Store/Doctor Office/Hospital",
  "10": "Field/Woods",
  "11": "Government/Public Building",
  "12": "Grocery/Supermarket",
  "13": "Highway/Road/Alley/Street/Sidewalk",
  "14": "Hotel/Motel/Etc.",
  "15": "Jail/Prison/Penitentiary",
  "16": "Lake/Waterway/Beach",
  "17": "Liquor Store",
  "18": "Parking/Drop Lot/Garage",
  "19": "Rental Storage Facility",
  "20": "Residence/Home",
  "21": "Restaurant",
  "22": "School/College",
  "23": "Service/Gas Station",
  "24": "Specialty Store",
  "25": "Other/Unknown",
  "37": "Abandoned/Condemned Structure",
  "38": "Amusement Park",
  "39": "Arena/Stadium/Fairgrounds",
  "40": "ATM Separate from Bank",
  "41": "Auto Dealership",
  "42": "Camp/Campground",
  "44": "Daycare Facility",
  "45": "Dock/Wharf/Freight Terminal",
  "46": "Farm Facility",
  "47": "Gambling Facility/Casino",
  "48": "Industrial Site",
  "49": "Military Installation",
  "50": "Park/Playground",
  "51": "Rest Area",
  "52": "School - College/University",
  "53": "School - Elementary/Secondary",
  "54": "Shelter - Mission/Homeless",
  "55": "Shopping Mall",
  "56": "Tribal Lands",
  "57": "Community Center",
  "58": "Cyberspace",
};

const BIAS_DESCRIPTIONS: Record<string, string> = {
  "11": "Anti-White",
  "12": "Anti-Black or African American",
  "13": "Anti-American Indian or Alaska Native",
  "14": "Anti-Asian",
  "15": "Anti-Multiple Races, Group",
  "16": "Anti-Native Hawaiian or Other Pacific Islander",
  "21": "Anti-Jewish",
  "22": "Anti-Catholic",
  "23": "Anti-Protestant",
  "24": "Anti-Islamic (Muslim)",
  "25": "Anti-Other Religion",
  "26": "Anti-Multiple Religions, Group",
  "27": "Anti-Atheism/Agnosticism",
  "28": "Anti-Mormon",
  "29": "Anti-Jehovah's Witness",
  "31": "Anti-Arab",
  "32": "Anti-Hispanic or Latino",
  "33": "Anti-Other Race/Ethnicity/Ancestry",
  "41": "Anti-Gay (Male)",
  "42": "Anti-Lesbian",
  "43": "Anti-Lesbian, Gay, Bisexual, or Transgender",
  "44": "Anti-Heterosexual",
  "45": "Anti-Bisexual",
  "51": "Anti-Physical Disability",
  "52": "Anti-Mental Disability",
  "61": "Anti-Male",
  "62": "Anti-Female",
  "71": "Anti-Transgender",
  "72": "Anti-Gender Non-Conforming",
  "81": "Anti-Eastern Orthodox",
  "82": "Anti-Other Christian",
  "83": "Anti-Buddhist",
  "84": "Anti-Hindu",
  "85": "Anti-Sikh",
  "88": "None (no bias)",
  "99": "Unknown",
};

const WEAPON_DESCRIPTIONS: Record<string, string> = {
  "11": "Firearm (type not stated)",
  "12": "Handgun",
  "13": "Rifle",
  "14": "Shotgun",
  "15": "Other Firearm",
  "20": "Knife/Cutting Instrument",
  "30": "Blunt Object",
  "35": "Motor Vehicle",
  "40": "Personal Weapons (hands, fists, feet)",
  "50": "Poison",
  "60": "Explosives",
  "65": "Fire/Incendiary Device",
  "70": "Drugs/Narcotics/Sleeping Pills",
  "85": "Asphyxiation",
  "90": "Other",
  "95": "Unknown",
  "99": "None",
};

const INJURY_DESCRIPTIONS: Record<string, string> = {
  B: "Apparent Broken Bones",
  I: "Possible Internal Injury",
  L: "Severe Laceration",
  M: "Apparent Minor Injury",
  N: "None",
  O: "Other Major Injury",
  T: "Loss of Teeth",
  U: "Unconsciousness",
};

const RELATIONSHIP_DESCRIPTIONS: Record<string, string> = {
  AQ: "Acquaintance",
  BG: "Boyfriend/Girlfriend",
  CF: "Child of Boyfriend/Girlfriend",
  CH: "Child",
  EE: "Employee",
  ER: "Employer",
  ES: "Ex-Spouse",
  FR: "Friend",
  HR: "Homosexual Relationship",
  NE: "Neighbor",
  OF: "Otherwise Known",
  OK: "Other Known",
  PA: "Parent",
  RU: "Relationship Unknown",
  SB: "Sibling",
  SE: "Stepchild",
  SP: "Spouse",
  SS: "Stepsibling",
  ST: "Stepparent",
  UN: "Unknown",
  VO: "Victim Was Offender",
  XS: "Ex-Boyfriend/Ex-Girlfriend",
};

export class NIBRSCrimeFunctions {
  private bigquery: BigQuery;

  constructor() {
    // Initialize BigQuery client
    // Uses GOOGLE_APPLICATION_CREDENTIALS_JSON env var for service account
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (credentialsJson) {
      try {
        // Remove surrounding quotes if present (from .env parsing)
        const cleanedJson = credentialsJson.replace(/^['"]|['"]$/g, "");
        const credentials = JSON.parse(cleanedJson);
        this.bigquery = new BigQuery({
          projectId: PROJECT_ID,
          credentials: credentials,
        });
        console.log("[BigQuery] Initialized with service account credentials");
      } catch (error: any) {
        console.error(
          "[BigQuery] Failed to parse credentials JSON:",
          error.message,
        );
        console.log(
          "[BigQuery] Falling back to Application Default Credentials",
        );
        this.bigquery = new BigQuery({
          projectId: PROJECT_ID,
        });
      }
    } else {
      // Fallback to default credentials (ADC)
      console.log(
        "[BigQuery] No credentials JSON found, using Application Default Credentials",
      );
      this.bigquery = new BigQuery({
        projectId: PROJECT_ID,
      });
    }
  }

  private async runQuery(sql: string): Promise<any[]> {
    console.log(`[BigQuery] Executing: ${sql.substring(0, 200)}...`);
    try {
      const [rows] = await this.bigquery.query({
        query: sql,
        location: "US",
      });
      return rows;
    } catch (error: any) {
      console.error("[BigQuery] Error:", error.message);
      throw new Error(`BigQuery query failed: ${error.message}`);
    }
  }

  private buildWhereClause(conditions: string[]): string {
    const validConditions = conditions.filter((c) => c.length > 0);
    return validConditions.length > 0
      ? `WHERE ${validConditions.join(" AND ")}`
      : "";
  }

  // =========================================================================
  // AGENCY SEARCH
  // =========================================================================

  @DaemoFunction({
    description:
      "Search for law enforcement agency metadata (names, ORIs, locations). Use this ONLY to find agency ORI identifiers for a specific city/county - NOT for counting agencies or aggregating by state. CRITICAL: This function has pagination limits (max 10000 results per call) and returns partial results. To count how many agencies exist per state, you MUST use Promise.allSettled() to call this function for ALL state codes IN PARALLEL (NOT sequentially in a loop, and NOT Promise.all which fails if any state times out). For crime statistics or comparisons, use getIncidentCounts instead. EXAMPLE for counting agencies by state: const settled = await Promise.allSettled(states.map(async (state) => { const data = await daemo.nibrs_crime_service.searchAgencies(state, undefined, undefined, undefined, undefined, 50000); return { state, count: data?.agencies?.length ?? 0 }; })); const results = settled.filter(r => r.status === 'fulfilled').map(r => r.value);",
    tags: ["nibrs", "agency", "search", "ori", "metadata"],
    category: "NIBRS",
    inputSchema: SearchAgenciesInput,
    outputSchema: AgencyListOutput,
  })
  async searchAgencies(input: z.infer<typeof SearchAgenciesInput>) {
    const conditions: string[] = [];

    if (input.stateAbbr) {
      conditions.push(`state_abbr = '${input.stateAbbr}'`);
    }
    if (input.county) {
      conditions.push(`LOWER(counties) LIKE '%${input.county.toLowerCase()}%'`);
    }
    if (input.agencyName) {
      conditions.push(
        `LOWER(agency_name) LIKE '%${input.agencyName.toLowerCase()}%'`,
      );
    }
    if (input.agencyType) {
      conditions.push(
        `LOWER(agency_type_name) LIKE '%${input.agencyType.toLowerCase()}%'`,
      );
    }
    if (input.nibrsOnly) {
      conditions.push(`is_nibrs = TRUE`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    const sql = `
      SELECT
        ori,
        agency_name,
        agency_type_name,
        state_abbr,
        state_name,
        counties,
        latitude,
        longitude,
        is_nibrs,
        CAST(nibrs_start_date AS STRING) as nibrs_start_date
      FROM \`${PROJECT_ID}.${DATASET}.agencies\`
      ${whereClause}
      ORDER BY state_abbr, agency_name
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);
    return {
      agencies: rows,
      total_count: rows.length,
    };
  }

  // =========================================================================
  // INCIDENT COUNTS
  // =========================================================================

  @DaemoFunction({
    description:
      "Get crime incident counts, rates, and comparisons from NIBRS data. This is the PRIMARY function for: (1) Comparing crime across agencies/cities/departments - use groupBy:'agency', (2) Getting homicide/murder counts by agency - use offenseCode:'09A' with groupBy:'agency', (3) Comparing crime rates between states - use groupBy:'state', (4) Ranking agencies by crime type - use groupBy:'agency' with offenseCode, (5) Year-over-year agency trends - use groupBy:'agency_year'. Returns aggregated counts that can be used to calculate crime rates. PERFORMANCE TIP: When comparing multiple specific agencies (e.g., 5 cities), use Promise.allSettled() to fetch each agency's data in parallel (handles timeouts gracefully): const settled = await Promise.allSettled(oris.map(ori => daemo.nibrs_crime_service.getIncidentCounts({ ori, groupBy: 'offense', fromYear: 2025, toYear: 2025 }))); const results = settled.filter(r => r.status === 'fulfilled').map(r => r.value);",
    tags: [
      "nibrs",
      "incidents",
      "counts",
      "statistics",
      "homicide",
      "murder",
      "crime-rate",
      "compare",
      "comparison",
      "agency-comparison",
      "ranking",
    ],
    category: "NIBRS",
    inputSchema: GetIncidentCountsInput,
    outputSchema: CountResultOutput,
  })
  async getIncidentCounts(input: z.infer<typeof GetIncidentCountsInput>) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`a.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`a.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`a.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 1000, 10000);

    let groupByClause: string;
    let selectClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "state":
        selectClause =
          "ag.state_abbr as state, COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count";
        groupByClause = "GROUP BY ag.state_abbr";
        orderByClause = "ORDER BY incident_count DESC";
        break;
      case "agency":
        selectClause =
          "a.ori, ag.agency_name, COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count";
        groupByClause = "GROUP BY a.ori, ag.agency_name";
        orderByClause = "ORDER BY incident_count DESC";
        break;
      case "offense":
        selectClause =
          "o.ucr_offense_code as offense_code, COUNT(*) as offense_count";
        groupByClause = "GROUP BY o.ucr_offense_code";
        orderByClause = "ORDER BY offense_count DESC";
        break;
      case "state_year":
        selectClause =
          "ag.state_abbr as state, a.data_year as year, COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count";
        groupByClause = "GROUP BY ag.state_abbr, a.data_year";
        orderByClause = "ORDER BY ag.state_abbr, a.data_year";
        break;
      case "offense_year":
        selectClause =
          "o.ucr_offense_code as offense_code, a.data_year as year, COUNT(*) as offense_count";
        groupByClause = "GROUP BY o.ucr_offense_code, a.data_year";
        orderByClause = "ORDER BY o.ucr_offense_code, a.data_year";
        break;
      case "agency_year":
        selectClause =
          "a.ori, ag.agency_name, a.data_year as year, COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count";
        groupByClause = "GROUP BY a.ori, ag.agency_name, a.data_year";
        orderByClause = "ORDER BY ag.agency_name, a.data_year";
        break;
      case "year":
      default:
        selectClause =
          "a.data_year as year, COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count";
        groupByClause = "GROUP BY a.data_year";
        orderByClause = "ORDER BY a.data_year";
        break;
    }

    // Always join agencies table for state filtering and state-based grouping
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number AND a.data_year = o.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add offense descriptions if grouping by offense
    if (input.groupBy === "offense" || input.groupBy === "offense_year") {
      rows.forEach((row: any) => {
        if (row.offense_code) {
          row.offense_description =
            UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
        }
      });
    }

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // OFFENSE SUMMARY
  // =========================================================================

  @DaemoFunction({
    description:
      "Get detailed offense statistics from NIBRS data. Can analyze offenses by type, location, weapon used, or bias motivation. Use this for understanding what types of crimes occur, where they occur, and how they're committed.",
    tags: ["nibrs", "offense", "summary", "statistics"],
    category: "NIBRS",
    inputSchema: GetOffenseSummaryInput,
    outputSchema: CountResultOutput,
  })
  async getOffenseSummary(input: z.infer<typeof GetOffenseSummaryInput>) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`o.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`o.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`o.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }
    if (input.locationType) {
      conditions.push(`o.location_type = '${input.locationType}'`);
    }
    if (input.biasMotivation) {
      conditions.push(`o.bias_motivation = '${input.biasMotivation}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;
    let descriptionMap: Record<string, string> = {};
    let descriptionField: string = "";

    switch (input.groupBy) {
      case "location":
        selectClause = "o.location_type, COUNT(*) as count";
        groupByClause = "GROUP BY o.location_type";
        orderByClause = "ORDER BY count DESC";
        descriptionMap = LOCATION_TYPE_DESCRIPTIONS;
        descriptionField = "location_type";
        break;
      case "weapon":
        selectClause =
          "o.type_weapon_force_involved1 as weapon_code, COUNT(*) as count";
        groupByClause = "GROUP BY o.type_weapon_force_involved1";
        orderByClause = "ORDER BY count DESC";
        descriptionMap = WEAPON_DESCRIPTIONS;
        descriptionField = "weapon_code";
        break;
      case "bias":
        selectClause = "o.bias_motivation, COUNT(*) as count";
        groupByClause = "GROUP BY o.bias_motivation";
        orderByClause = "ORDER BY count DESC";
        descriptionMap = BIAS_DESCRIPTIONS;
        descriptionField = "bias_motivation";
        break;
      case "offense_year":
        selectClause =
          "o.ucr_offense_code as offense_code, o.data_year as year, COUNT(*) as count";
        groupByClause = "GROUP BY o.ucr_offense_code, o.data_year";
        orderByClause = "ORDER BY o.ucr_offense_code, o.data_year";
        descriptionMap = UCR_OFFENSE_DESCRIPTIONS;
        descriptionField = "offense_code";
        break;
      case "offense":
      default:
        selectClause = "o.ucr_offense_code as offense_code, COUNT(*) as count";
        groupByClause = "GROUP BY o.ucr_offense_code";
        orderByClause = "ORDER BY count DESC";
        descriptionMap = UCR_OFFENSE_DESCRIPTIONS;
        descriptionField = "offense_code";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    if (Object.keys(descriptionMap).length > 0) {
      rows.forEach((row: any) => {
        const code = row[descriptionField];
        if (code && descriptionMap[code]) {
          row.description = descriptionMap[code];
        }
      });
    }

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // VICTIM DEMOGRAPHICS
  // =========================================================================

  @DaemoFunction({
    description:
      "Get victim demographic breakdowns (sex, race, age) from NIBRS data. Use this to analyze WHO the victims are - NOT for crime counts or agency comparisons. For crime counts, rates, or comparing agencies, use getIncidentCounts instead.",
    tags: ["nibrs", "victim", "demographics", "sex", "race", "age"],
    category: "NIBRS",
    inputSchema: GetVictimDemographicsInput,
    outputSchema: DemographicOutput,
  })
  async getVictimDemographics(
    input: z.infer<typeof GetVictimDemographicsInput>,
  ) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`v.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`v.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`v.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`v.ucr_offense_code1 = '${input.offenseCode}'`);
    }
    if (input.victimType) {
      conditions.push(`v.type_of_victim = '${input.victimType}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 1000);

    let selectClause: string;
    let groupByClause: string;

    switch (input.groupBy) {
      case "race":
        selectClause = `
          v.race_of_victim as race,
          CASE v.race_of_victim
            WHEN 'A' THEN 'Asian'
            WHEN 'B' THEN 'Black'
            WHEN 'I' THEN 'American Indian/Alaska Native'
            WHEN 'P' THEN 'Native Hawaiian/Pacific Islander'
            WHEN 'W' THEN 'White'
            ELSE 'Unknown'
          END as race_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY v.race_of_victim";
        break;
      case "ethnicity":
        selectClause = `
          v.ethnicity_of_victim as ethnicity,
          CASE v.ethnicity_of_victim
            WHEN 'H' THEN 'Hispanic or Latino'
            WHEN 'N' THEN 'Not Hispanic or Latino'
            ELSE 'Unknown'
          END as ethnicity_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY v.ethnicity_of_victim";
        break;
      case "age_group":
        selectClause = `
          CASE
            WHEN SAFE_CAST(v.age_of_victim AS INT64) < 18 THEN 'Under 18'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 18 AND 24 THEN '18-24'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 25 AND 34 THEN '25-34'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 35 AND 44 THEN '35-44'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 45 AND 54 THEN '45-54'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 55 AND 64 THEN '55-64'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) >= 65 THEN '65+'
            ELSE 'Unknown'
          END as age_group,
          COUNT(*) as count
        `;
        groupByClause = `GROUP BY
          CASE
            WHEN SAFE_CAST(v.age_of_victim AS INT64) < 18 THEN 'Under 18'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 18 AND 24 THEN '18-24'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 25 AND 34 THEN '25-34'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 35 AND 44 THEN '35-44'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 45 AND 54 THEN '45-54'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) BETWEEN 55 AND 64 THEN '55-64'
            WHEN SAFE_CAST(v.age_of_victim AS INT64) >= 65 THEN '65+'
            ELSE 'Unknown'
          END`;
        break;
      case "victim_type":
        selectClause = `
          v.type_of_victim,
          CASE v.type_of_victim
            WHEN 'B' THEN 'Business'
            WHEN 'F' THEN 'Financial Institution'
            WHEN 'G' THEN 'Government'
            WHEN 'I' THEN 'Individual'
            WHEN 'L' THEN 'Law Enforcement Officer'
            WHEN 'O' THEN 'Other'
            WHEN 'R' THEN 'Religious Organization'
            WHEN 'S' THEN 'Society/Public'
            ELSE 'Unknown'
          END as victim_type_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY v.type_of_victim";
        break;
      case "sex_race":
        selectClause = `
          v.sex_of_victim as sex,
          v.race_of_victim as race,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY v.sex_of_victim, v.race_of_victim";
        break;
      case "sex":
      default:
        selectClause = `
          v.sex_of_victim as sex,
          CASE v.sex_of_victim
            WHEN 'M' THEN 'Male'
            WHEN 'F' THEN 'Female'
            WHEN 'X' THEN 'Nonbinary'
            ELSE 'Unknown'
          END as sex_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY v.sex_of_victim";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);
    const totalCount = rows.reduce(
      (sum: number, row: any) => sum + (row.count || 0),
      0,
    );

    return {
      results: rows,
      total_count: totalCount,
    };
  }

  // =========================================================================
  // ARRESTEE DEMOGRAPHICS
  // =========================================================================

  @DaemoFunction({
    description:
      "Get arrestee demographic breakdowns from NIBRS data. Analyze arrestees by sex, race, ethnicity, age group, or arrest type. Use this to understand who is being arrested.",
    tags: ["nibrs", "arrestee", "demographics", "arrest"],
    category: "NIBRS",
    inputSchema: GetArresteeDemographicsInput,
    outputSchema: DemographicOutput,
  })
  async getArresteeDemographics(
    input: z.infer<typeof GetArresteeDemographicsInput>,
  ) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`ar.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`ar.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`ar.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`ar.ucr_arrest_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    let selectClause: string;
    let groupByClause: string;

    switch (input.groupBy) {
      case "race":
        selectClause = `
          ar.race_of_arrestee as race,
          CASE ar.race_of_arrestee
            WHEN 'A' THEN 'Asian'
            WHEN 'B' THEN 'Black'
            WHEN 'I' THEN 'American Indian/Alaska Native'
            WHEN 'P' THEN 'Native Hawaiian/Pacific Islander'
            WHEN 'W' THEN 'White'
            ELSE 'Unknown'
          END as race_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY ar.race_of_arrestee";
        break;
      case "ethnicity":
        selectClause = `
          ar.ethnicity_of_arrestee as ethnicity,
          CASE ar.ethnicity_of_arrestee
            WHEN 'H' THEN 'Hispanic or Latino'
            WHEN 'N' THEN 'Not Hispanic or Latino'
            ELSE 'Unknown'
          END as ethnicity_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY ar.ethnicity_of_arrestee";
        break;
      case "age_group":
        selectClause = `
          CASE
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) < 18 THEN 'Under 18'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 18 AND 24 THEN '18-24'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 25 AND 34 THEN '25-34'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 35 AND 44 THEN '35-44'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 45 AND 54 THEN '45-54'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 55 AND 64 THEN '55-64'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) >= 65 THEN '65+'
            ELSE 'Unknown'
          END as age_group,
          COUNT(*) as count
        `;
        groupByClause = `GROUP BY
          CASE
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) < 18 THEN 'Under 18'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 18 AND 24 THEN '18-24'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 25 AND 34 THEN '25-34'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 35 AND 44 THEN '35-44'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 45 AND 54 THEN '45-54'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) BETWEEN 55 AND 64 THEN '55-64'
            WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) >= 65 THEN '65+'
            ELSE 'Unknown'
          END`;
        break;
      case "sex_race":
        selectClause = `
          ar.sex_of_arrestee as sex,
          ar.race_of_arrestee as race,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY ar.sex_of_arrestee, ar.race_of_arrestee";
        break;
      case "arrest_type":
        selectClause = `
          ar.type_of_arrest,
          CASE ar.type_of_arrest
            WHEN 'O' THEN 'On-View Arrest'
            WHEN 'S' THEN 'Summoned/Cited'
            WHEN 'T' THEN 'Taken Into Custody'
            ELSE 'Unknown'
          END as arrest_type_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY ar.type_of_arrest";
        break;
      case "sex":
      default:
        selectClause = `
          ar.sex_of_arrestee as sex,
          CASE ar.sex_of_arrestee
            WHEN 'M' THEN 'Male'
            WHEN 'F' THEN 'Female'
            WHEN 'X' THEN 'Nonbinary'
            ELSE 'Unknown'
          END as sex_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY ar.sex_of_arrestee";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON ar.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);
    const totalCount = rows.reduce(
      (sum: number, row: any) => sum + (row.count || 0),
      0,
    );

    return {
      results: rows,
      total_count: totalCount,
    };
  }

  // =========================================================================
  // CRIME TRENDS (TIME SERIES)
  // =========================================================================

  @DaemoFunction({
    description:
      "Get crime trend data over time. Returns time-series data showing incident counts by year or month. Use this to analyze how crime rates change over time.",
    tags: ["nibrs", "trends", "time-series", "statistics"],
    category: "NIBRS",
    inputSchema: GetCrimeTrendsInput,
    outputSchema: TrendOutput,
  })
  async getCrimeTrends(input: z.infer<typeof GetCrimeTrendsInput>) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`a.ori = '${input.ori}'`);
    }
    conditions.push(`a.data_year >= ${input.fromYear}`);
    conditions.push(`a.data_year <= ${input.toYear}`);

    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    if (input.granularity === "month") {
      selectClause = `
        FORMAT_DATE('%Y-%m', a.incident_date) as period,
        COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as count
      `;
      groupByClause = "GROUP BY period";
      orderByClause = "ORDER BY period";
    } else {
      selectClause = `
        CAST(a.data_year AS STRING) as period,
        COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as count
      `;
      groupByClause = "GROUP BY a.data_year";
      orderByClause = "ORDER BY a.data_year";
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number AND a.data_year = o.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
    `;

    const rows = await this.runQuery(sql);
    const totalCount = rows.reduce(
      (sum: number, row: any) => sum + (row.count || 0),
      0,
    );

    const title = input.offenseCode
      ? `${UCR_OFFENSE_DESCRIPTIONS[input.offenseCode] || input.offenseCode} Trends`
      : "Crime Trends";

    return {
      title,
      data: rows.map((row: any) => ({
        period: row.period,
        count: row.count,
        rate: null,
      })),
      total_count: totalCount,
    };
  }

  // =========================================================================
  // WEAPON ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze weapon usage in crimes from NIBRS data. Shows what types of weapons are used in offenses. Use this to understand weapon involvement in crimes.",
    tags: ["nibrs", "weapon", "analysis"],
    category: "NIBRS",
    inputSchema: GetWeaponAnalysisInput,
    outputSchema: CountResultOutput,
  })
  async getWeaponAnalysis(input: z.infer<typeof GetWeaponAnalysisInput>) {
    const conditions: string[] = [];
    conditions.push("o.type_weapon_force_involved1 IS NOT NULL");

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`o.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`o.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`o.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 50, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "weapon_offense":
        selectClause =
          "o.type_weapon_force_involved1 as weapon_code, o.ucr_offense_code as offense_code, COUNT(*) as count";
        groupByClause =
          "GROUP BY o.type_weapon_force_involved1, o.ucr_offense_code";
        orderByClause = "ORDER BY count DESC";
        break;
      case "weapon_year":
        selectClause =
          "o.type_weapon_force_involved1 as weapon_code, o.data_year as year, COUNT(*) as count";
        groupByClause = "GROUP BY o.type_weapon_force_involved1, o.data_year";
        orderByClause = "ORDER BY o.data_year, count DESC";
        break;
      case "weapon":
      default:
        selectClause =
          "o.type_weapon_force_involved1 as weapon_code, COUNT(*) as count";
        groupByClause = "GROUP BY o.type_weapon_force_involved1";
        orderByClause = "ORDER BY count DESC";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    rows.forEach((row: any) => {
      if (row.weapon_code) {
        row.weapon_description =
          WEAPON_DESCRIPTIONS[row.weapon_code] || "Unknown";
      }
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // BIAS MOTIVATION ANALYSIS (HATE CRIMES)
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze hate crime bias motivations from NIBRS data. Shows the distribution of bias motivations (racial, religious, sexual orientation, etc.) in crimes. Use this to understand hate crime patterns.",
    tags: ["nibrs", "hate-crime", "bias", "analysis"],
    category: "NIBRS",
    inputSchema: GetBiasAnalysisInput,
    outputSchema: CountResultOutput,
  })
  async getBiasAnalysis(input: z.infer<typeof GetBiasAnalysisInput>) {
    const conditions: string[] = [];
    conditions.push("o.bias_motivation IS NOT NULL");
    conditions.push("o.bias_motivation != '88'"); // Exclude "None (no bias)"

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`o.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`o.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`o.data_year <= ${input.toYear}`);
    }
    if (input.biasMotivation) {
      conditions.push(`o.bias_motivation = '${input.biasMotivation}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 50, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "bias_offense":
        selectClause =
          "o.bias_motivation, o.ucr_offense_code as offense_code, COUNT(*) as count";
        groupByClause = "GROUP BY o.bias_motivation, o.ucr_offense_code";
        orderByClause = "ORDER BY count DESC";
        break;
      case "bias_year":
        selectClause =
          "o.bias_motivation, o.data_year as year, COUNT(*) as count";
        groupByClause = "GROUP BY o.bias_motivation, o.data_year";
        orderByClause = "ORDER BY o.data_year, count DESC";
        break;
      case "bias_state":
        selectClause =
          "o.bias_motivation, ag.state_abbr as state, COUNT(*) as count";
        groupByClause = "GROUP BY o.bias_motivation, ag.state_abbr";
        orderByClause = "ORDER BY count DESC";
        break;
      case "bias":
      default:
        selectClause = "o.bias_motivation, COUNT(*) as count";
        groupByClause = "GROUP BY o.bias_motivation";
        orderByClause = "ORDER BY count DESC";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    rows.forEach((row: any) => {
      if (row.bias_motivation) {
        row.bias_description =
          BIAS_DESCRIPTIONS[row.bias_motivation] || "Unknown";
      }
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // LOCATION TYPE ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze where crimes occur by location type from NIBRS data. Shows distribution of offenses across different location types (residence, street, bar, etc.). Use this to understand crime geography.",
    tags: ["nibrs", "location", "analysis"],
    category: "NIBRS",
    inputSchema: GetLocationAnalysisInput,
    outputSchema: CountResultOutput,
  })
  async getLocationAnalysis(input: z.infer<typeof GetLocationAnalysisInput>) {
    const conditions: string[] = [];
    conditions.push("o.location_type IS NOT NULL");

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`o.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`o.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`o.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 50, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "location_offense":
        selectClause =
          "o.location_type, o.ucr_offense_code as offense_code, COUNT(*) as count";
        groupByClause = "GROUP BY o.location_type, o.ucr_offense_code";
        orderByClause = "ORDER BY count DESC";
        break;
      case "location_year":
        selectClause =
          "o.location_type, o.data_year as year, COUNT(*) as count";
        groupByClause = "GROUP BY o.location_type, o.data_year";
        orderByClause = "ORDER BY o.data_year, count DESC";
        break;
      case "location":
      default:
        selectClause = "o.location_type, COUNT(*) as count";
        groupByClause = "GROUP BY o.location_type";
        orderByClause = "ORDER BY count DESC";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    rows.forEach((row: any) => {
      if (row.location_type) {
        row.location_description =
          LOCATION_TYPE_DESCRIPTIONS[row.location_type] || "Unknown";
      }
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // INJURY ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze victim injuries from NIBRS data. Shows what types of injuries victims sustain in crimes. Use this to understand the severity and types of harm to victims.",
    tags: ["nibrs", "injury", "victim", "analysis"],
    category: "NIBRS",
    inputSchema: GetInjuryAnalysisInput,
    outputSchema: CountResultOutput,
  })
  async getInjuryAnalysis(input: z.infer<typeof GetInjuryAnalysisInput>) {
    const conditions: string[] = [];
    conditions.push("v.type_of_injury1 IS NOT NULL");

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`v.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`v.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`v.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`v.ucr_offense_code1 = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 50, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "injury_offense":
        selectClause =
          "v.type_of_injury1 as injury_code, v.ucr_offense_code1 as offense_code, COUNT(*) as count";
        groupByClause = "GROUP BY v.type_of_injury1, v.ucr_offense_code1";
        orderByClause = "ORDER BY count DESC";
        break;
      case "injury_year":
        selectClause =
          "v.type_of_injury1 as injury_code, v.data_year as year, COUNT(*) as count";
        groupByClause = "GROUP BY v.type_of_injury1, v.data_year";
        orderByClause = "ORDER BY v.data_year, count DESC";
        break;
      case "injury":
      default:
        selectClause = "v.type_of_injury1 as injury_code, COUNT(*) as count";
        groupByClause = "GROUP BY v.type_of_injury1";
        orderByClause = "ORDER BY count DESC";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    rows.forEach((row: any) => {
      if (row.injury_code) {
        row.injury_description =
          INJURY_DESCRIPTIONS[row.injury_code] || "Unknown";
      }
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // VICTIM-OFFENDER RELATIONSHIP ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze victim-offender relationships (family, acquaintance, stranger). Use this to understand WHO commits crimes against whom - NOT for crime counts or agency comparisons. For crime counts, rates, or comparing agencies, use getIncidentCounts instead.",
    tags: [
      "nibrs",
      "relationship",
      "victim",
      "offender",
      "domestic",
      "stranger",
    ],
    category: "NIBRS",
    inputSchema: GetRelationshipAnalysisInput,
    outputSchema: CountResultOutput,
  })
  async getRelationshipAnalysis(
    input: z.infer<typeof GetRelationshipAnalysisInput>,
  ) {
    const conditions: string[] = [];
    conditions.push("v.victim_relationship_to_offender1 IS NOT NULL");

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`v.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`v.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`v.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`v.ucr_offense_code1 = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 50, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "relationship_offense":
        selectClause =
          "v.victim_relationship_to_offender1 as relationship_code, v.ucr_offense_code1 as offense_code, COUNT(*) as count";
        groupByClause =
          "GROUP BY v.victim_relationship_to_offender1, v.ucr_offense_code1";
        orderByClause = "ORDER BY count DESC";
        break;
      case "relationship_year":
        selectClause =
          "v.victim_relationship_to_offender1 as relationship_code, v.data_year as year, COUNT(*) as count";
        groupByClause =
          "GROUP BY v.victim_relationship_to_offender1, v.data_year";
        orderByClause = "ORDER BY v.data_year, count DESC";
        break;
      case "relationship":
      default:
        selectClause =
          "v.victim_relationship_to_offender1 as relationship_code, COUNT(*) as count";
        groupByClause = "GROUP BY v.victim_relationship_to_offender1";
        orderByClause = "ORDER BY count DESC";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    rows.forEach((row: any) => {
      if (row.relationship_code) {
        row.relationship_description =
          RELATIONSHIP_DESCRIPTIONS[row.relationship_code] || "Unknown";
      }
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // CLEARANCE ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze case clearance rates from NIBRS data. Shows how many cases are cleared by arrest vs exceptional means. Use this to understand case resolution patterns.",
    tags: ["nibrs", "clearance", "resolution", "analysis"],
    category: "NIBRS",
    inputSchema: GetClearanceAnalysisInput,
    outputSchema: CountResultOutput,
  })
  async getClearanceAnalysis(input: z.infer<typeof GetClearanceAnalysisInput>) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`a.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`a.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`a.data_year <= ${input.toYear}`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "state":
        selectClause = `
          ag.state_abbr as state,
          SUM(CASE WHEN a.cleared_exceptionally IS NOT NULL AND a.cleared_exceptionally != 'N' THEN 1 ELSE 0 END) as cleared_count,
          COUNT(*) as total_count,
          ROUND(SUM(CASE WHEN a.cleared_exceptionally IS NOT NULL AND a.cleared_exceptionally != 'N' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as clearance_rate
        `;
        groupByClause = "GROUP BY ag.state_abbr";
        orderByClause = "ORDER BY clearance_rate DESC";
        break;
      case "year":
        selectClause = `
          a.data_year as year,
          SUM(CASE WHEN a.cleared_exceptionally IS NOT NULL AND a.cleared_exceptionally != 'N' THEN 1 ELSE 0 END) as cleared_count,
          COUNT(*) as total_count,
          ROUND(SUM(CASE WHEN a.cleared_exceptionally IS NOT NULL AND a.cleared_exceptionally != 'N' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as clearance_rate
        `;
        groupByClause = "GROUP BY a.data_year";
        orderByClause = "ORDER BY a.data_year";
        break;
      case "state_year":
        selectClause = `
          ag.state_abbr as state,
          a.data_year as year,
          SUM(CASE WHEN a.cleared_exceptionally IS NOT NULL AND a.cleared_exceptionally != 'N' THEN 1 ELSE 0 END) as cleared_count,
          COUNT(*) as total_count,
          ROUND(SUM(CASE WHEN a.cleared_exceptionally IS NOT NULL AND a.cleared_exceptionally != 'N' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as clearance_rate
        `;
        groupByClause = "GROUP BY ag.state_abbr, a.data_year";
        orderByClause = "ORDER BY ag.state_abbr, a.data_year";
        break;
      case "clearance_type":
      default:
        selectClause = `
          a.cleared_exceptionally as clearance_code,
          CASE a.cleared_exceptionally
            WHEN 'A' THEN 'Cleared by Arrest'
            WHEN 'B' THEN 'Death of Offender'
            WHEN 'C' THEN 'Prosecution Declined'
            WHEN 'D' THEN 'Extradition Denied'
            WHEN 'E' THEN 'Victim Refused to Cooperate'
            WHEN 'J' THEN 'Juvenile/No Custody'
            WHEN 'N' THEN 'Not Cleared'
            WHEN 'O' THEN 'Other Exceptional Means'
            ELSE 'Unknown'
          END as clearance_description,
          COUNT(*) as count
        `;
        groupByClause = "GROUP BY a.cleared_exceptionally";
        orderByClause = "ORDER BY count DESC";
        break;
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // TIME PATTERN ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze when crimes occur by time patterns from NIBRS data. Can show incidents by hour of day or month. Use this to understand temporal crime patterns.",
    tags: ["nibrs", "time", "hour", "pattern", "analysis"],
    category: "NIBRS",
    inputSchema: GetTimePatternInput,
    outputSchema: CountResultOutput,
  })
  async getTimePatterns(input: z.infer<typeof GetTimePatternInput>) {
    const conditions: string[] = [];

    // State filtering requires join to agencies table (state_code is numeric FIPS, not abbreviation)
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`a.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`a.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`a.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const limit = Math.min(input.limit || 50, 10000);

    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;

    switch (input.groupBy) {
      case "hour_offense":
        selectClause =
          "a.incident_date_hour as hour, o.ucr_offense_code as offense_code, COUNT(*) as count";
        groupByClause = "GROUP BY a.incident_date_hour, o.ucr_offense_code";
        orderByClause = "ORDER BY count DESC";
        break;
      case "month":
        selectClause =
          "EXTRACT(MONTH FROM a.incident_date) as month, COUNT(*) as count";
        groupByClause = "GROUP BY month";
        orderByClause = "ORDER BY month";
        break;
      case "hour":
      default:
        selectClause = "a.incident_date_hour as hour, COUNT(*) as count";
        groupByClause = "GROUP BY a.incident_date_hour";
        orderByClause = "ORDER BY a.incident_date_hour";
        break;
    }

    // Filter out null hours for hour-based queries
    if (input.groupBy === "hour" || input.groupBy === "hour_offense") {
      conditions.push("a.incident_date_hour IS NOT NULL");
    }

    // Join agencies table for state filtering
    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number AND a.data_year = o.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      ${this.buildWhereClause(conditions.filter((c) => c.length > 0))}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add descriptions
    rows.forEach((row: any) => {
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
      if (row.month !== undefined) {
        const months = [
          "",
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        row.month_name = months[row.month] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // VICTIMS BY OFFENSE TYPE
  // =========================================================================

  @DaemoFunction({
    description:
      "Get victim counts grouped by offense type. This is the PRIMARY function for calculating victim-to-arrest ratios and analyzing which crimes have the most victims. Returns counts per offense code with optional demographic filtering. Use this instead of getVictimDemographics when you need to GROUP BY OFFENSE TYPE.",
    tags: ["nibrs", "victim", "offense", "counts", "victim-arrest-ratio"],
    category: "NIBRS",
    inputSchema: GetVictimsByOffenseInput,
    outputSchema: CountResultOutput,
  })
  async getVictimsByOffense(input: z.infer<typeof GetVictimsByOffenseInput>) {
    const conditions: string[] = [];

    // State filtering
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`v.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`v.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`v.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`v.ucr_offense_code1 = '${input.offenseCode}'`);
    }
    if (input.sex) {
      conditions.push(`v.sex_of_victim = '${input.sex}'`);
    }
    if (input.race) {
      conditions.push(`v.race_of_victim = '${input.race}'`);
    }
    if (input.victimType) {
      conditions.push(`v.type_of_victim = '${input.victimType}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    const sql = `
      SELECT
        v.ucr_offense_code1 as offense_code,
        COUNT(*) as victim_count
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      ${whereClause}
      GROUP BY v.ucr_offense_code1
      ORDER BY victim_count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add offense descriptions
    rows.forEach((row: any) => {
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: "Victims grouped by offense type",
    };
  }

  // =========================================================================
  // ARRESTEES BY OFFENSE TYPE
  // =========================================================================

  @DaemoFunction({
    description:
      "Get arrestee counts grouped by offense type. This is the PRIMARY function for calculating arrest rates and victim-to-arrest ratios. Returns counts per offense code with optional demographic filtering. Use this instead of getArresteeDemographics when you need to GROUP BY OFFENSE TYPE.",
    tags: ["nibrs", "arrestee", "offense", "counts", "arrest-rate"],
    category: "NIBRS",
    inputSchema: GetArresteesByOffenseInput,
    outputSchema: CountResultOutput,
  })
  async getArresteesByOffense(
    input: z.infer<typeof GetArresteesByOffenseInput>,
  ) {
    const conditions: string[] = [];

    // State filtering
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`ar.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`ar.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`ar.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`ar.ucr_arrest_offense_code = '${input.offenseCode}'`);
    }
    if (input.sex) {
      conditions.push(`ar.sex_of_arrestee = '${input.sex}'`);
    }
    if (input.race) {
      conditions.push(`ar.race_of_arrestee = '${input.race}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    const sql = `
      SELECT
        ar.ucr_arrest_offense_code as offense_code,
        COUNT(*) as arrestee_count
      FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON ar.ori = ag.ori
      ${whereClause}
      GROUP BY ar.ucr_arrest_offense_code
      ORDER BY arrestee_count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add offense descriptions
    rows.forEach((row: any) => {
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: "Arrestees grouped by offense type",
    };
  }

  // =========================================================================
  // OFFENSE + DEMOGRAPHIC CROSS-TABULATION
  // =========================================================================

  @DaemoFunction({
    description:
      "Cross-tabulate offense types with demographics (sex, race, ethnicity, or age). Use this to answer questions like 'What is the racial breakdown of arrestees for each offense type?' or 'How does victim sex vary by crime type?' This is the PRIMARY function for demographic breakdowns BY OFFENSE.",
    tags: [
      "nibrs",
      "offense",
      "demographics",
      "cross-tabulation",
      "victim",
      "arrestee",
    ],
    category: "NIBRS",
    inputSchema: GetOffenseDemographicCrossInput,
    outputSchema: CountResultOutput,
  })
  async getOffenseDemographicCross(
    input: z.infer<typeof GetOffenseDemographicCrossInput>,
  ) {
    const conditions: string[] = [];

    // State filtering
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`seg.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`seg.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`seg.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    let selectClause: string;
    let groupByClause: string;
    let table: string;
    let offenseField: string;

    if (input.segmentType === "victim") {
      table = "victim_segment";
      offenseField = "ucr_offense_code1";

      switch (input.demographicDimension) {
        case "sex":
          selectClause = `
            seg.${offenseField} as offense_code,
            seg.sex_of_victim as sex,
            CASE seg.sex_of_victim
              WHEN 'M' THEN 'Male'
              WHEN 'F' THEN 'Female'
              WHEN 'X' THEN 'Nonbinary'
              ELSE 'Unknown'
            END as sex_description,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, seg.sex_of_victim`;
          break;
        case "race":
          selectClause = `
            seg.${offenseField} as offense_code,
            seg.race_of_victim as race,
            CASE seg.race_of_victim
              WHEN 'A' THEN 'Asian'
              WHEN 'B' THEN 'Black'
              WHEN 'I' THEN 'American Indian/Alaska Native'
              WHEN 'P' THEN 'Native Hawaiian/Pacific Islander'
              WHEN 'W' THEN 'White'
              ELSE 'Unknown'
            END as race_description,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, seg.race_of_victim`;
          break;
        case "ethnicity":
          selectClause = `
            seg.${offenseField} as offense_code,
            seg.ethnicity_of_victim as ethnicity,
            CASE seg.ethnicity_of_victim
              WHEN 'H' THEN 'Hispanic or Latino'
              WHEN 'N' THEN 'Not Hispanic or Latino'
              ELSE 'Unknown'
            END as ethnicity_description,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, seg.ethnicity_of_victim`;
          break;
        case "age_group":
          selectClause = `
            seg.${offenseField} as offense_code,
            CASE
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) < 18 THEN 'Under 18'
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) BETWEEN 18 AND 24 THEN '18-24'
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) BETWEEN 25 AND 34 THEN '25-34'
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) BETWEEN 35 AND 44 THEN '35-44'
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) BETWEEN 45 AND 54 THEN '45-54'
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) BETWEEN 55 AND 64 THEN '55-64'
              WHEN SAFE_CAST(seg.age_of_victim AS INT64) >= 65 THEN '65+'
              ELSE 'Unknown'
            END as age_group,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, age_group`;
          break;
      }
    } else {
      // arrestee
      table = "arrestee_segment";
      offenseField = "ucr_arrest_offense_code";

      switch (input.demographicDimension) {
        case "sex":
          selectClause = `
            seg.${offenseField} as offense_code,
            seg.sex_of_arrestee as sex,
            CASE seg.sex_of_arrestee
              WHEN 'M' THEN 'Male'
              WHEN 'F' THEN 'Female'
              WHEN 'X' THEN 'Nonbinary'
              ELSE 'Unknown'
            END as sex_description,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, seg.sex_of_arrestee`;
          break;
        case "race":
          selectClause = `
            seg.${offenseField} as offense_code,
            seg.race_of_arrestee as race,
            CASE seg.race_of_arrestee
              WHEN 'A' THEN 'Asian'
              WHEN 'B' THEN 'Black'
              WHEN 'I' THEN 'American Indian/Alaska Native'
              WHEN 'P' THEN 'Native Hawaiian/Pacific Islander'
              WHEN 'W' THEN 'White'
              ELSE 'Unknown'
            END as race_description,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, seg.race_of_arrestee`;
          break;
        case "ethnicity":
          selectClause = `
            seg.${offenseField} as offense_code,
            seg.ethnicity_of_arrestee as ethnicity,
            CASE seg.ethnicity_of_arrestee
              WHEN 'H' THEN 'Hispanic or Latino'
              WHEN 'N' THEN 'Not Hispanic or Latino'
              ELSE 'Unknown'
            END as ethnicity_description,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, seg.ethnicity_of_arrestee`;
          break;
        case "age_group":
          selectClause = `
            seg.${offenseField} as offense_code,
            CASE
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) < 18 THEN 'Under 18'
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) BETWEEN 18 AND 24 THEN '18-24'
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) BETWEEN 25 AND 34 THEN '25-34'
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) BETWEEN 35 AND 44 THEN '35-44'
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) BETWEEN 45 AND 54 THEN '45-54'
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) BETWEEN 55 AND 64 THEN '55-64'
              WHEN SAFE_CAST(seg.age_of_arrestee AS INT64) >= 65 THEN '65+'
              ELSE 'Unknown'
            END as age_group,
            COUNT(*) as count
          `;
          groupByClause = `GROUP BY seg.${offenseField}, age_group`;
          break;
      }
    }

    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.${table}\` seg
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON seg.ori = ag.ori
      ${whereClause}
      ${groupByClause}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add offense descriptions
    rows.forEach((row: any) => {
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `${input.segmentType} ${input.demographicDimension} by offense`,
    };
  }

  // =========================================================================
  // ATTEMPTED VS COMPLETED ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze attempted vs completed crimes by offense type. Shows what percentage of each crime type is attempted vs successfully completed. Use this to understand crime completion rates.",
    tags: ["nibrs", "attempted", "completed", "offense", "success-rate"],
    category: "NIBRS",
    inputSchema: GetAttemptedCompletedInput,
    outputSchema: CountResultOutput,
  })
  async getAttemptedCompletedAnalysis(
    input: z.infer<typeof GetAttemptedCompletedInput>,
  ) {
    const conditions: string[] = [];

    // State filtering
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`o.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`o.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`o.data_year <= ${input.toYear}`);
    }
    if (input.offenseCode) {
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    const sql = `
      SELECT
        o.ucr_offense_code as offense_code,
        o.offense_attempted_or_completed as status,
        CASE o.offense_attempted_or_completed
          WHEN 'A' THEN 'Attempted'
          WHEN 'C' THEN 'Completed'
          ELSE 'Unknown'
        END as status_description,
        COUNT(*) as count
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      ${whereClause}
      GROUP BY o.ucr_offense_code, o.offense_attempted_or_completed
      ORDER BY o.ucr_offense_code, count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add offense descriptions
    rows.forEach((row: any) => {
      if (row.offense_code) {
        row.offense_description =
          UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
      }
    });

    return {
      results: rows,
      total_rows: rows.length,
      query_info: "Attempted vs completed by offense type",
    };
  }

  // =========================================================================
  // INCIDENT LEVEL STATISTICS
  // =========================================================================

  @DaemoFunction({
    description:
      "Get incident-level statistics like average offenses per incident, victims per incident, and offenders per incident. Use this to understand the complexity and scale of crime incidents.",
    tags: ["nibrs", "incident", "statistics", "averages"],
    category: "NIBRS",
    inputSchema: GetIncidentLevelStatsInput,
    outputSchema: CountResultOutput,
  })
  async getIncidentLevelStats(
    input: z.infer<typeof GetIncidentLevelStatsInput>,
  ) {
    const conditions: string[] = [];

    // State filtering
    if (input.stateAbbr) {
      conditions.push(`ag.state_abbr = '${input.stateAbbr}'`);
    }
    if (input.ori) {
      conditions.push(`a.ori = '${input.ori}'`);
    }
    if (input.fromYear) {
      conditions.push(`a.data_year >= ${input.fromYear}`);
    }
    if (input.toYear) {
      conditions.push(`a.data_year <= ${input.toYear}`);
    }

    // For offense filtering, we need to join with offense_segment
    let joinClause = "";
    if (input.offenseCode) {
      joinClause = `
        JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
          ON a.ori = o.ori AND a.incident_number = o.incident_number AND a.data_year = o.data_year
      `;
      conditions.push(`o.ucr_offense_code = '${input.offenseCode}'`);
    }

    const whereClause = this.buildWhereClause(conditions);
    const limit = Math.min(input.limit || 100, 10000);

    let selectClause: string;
    let groupByClause: string;

    switch (input.groupBy) {
      case "offense":
        selectClause = `
          o.ucr_offense_code as offense_code,
          COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count,
          AVG(a.total_offense_segments) as avg_offenses_per_incident,
          AVG(a.total_victim_segments) as avg_victims_per_incident,
          AVG(a.total_offender_segments) as avg_offenders_per_incident,
          AVG(a.total_arrestee_segments) as avg_arrestees_per_incident
        `;
        groupByClause = "GROUP BY o.ucr_offense_code";
        joinClause = `
          JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
            ON a.ori = o.ori AND a.incident_number = o.incident_number AND a.data_year = o.data_year
        `;
        break;
      case "state":
        selectClause = `
          ag.state_abbr as state,
          COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count,
          AVG(a.total_offense_segments) as avg_offenses_per_incident,
          AVG(a.total_victim_segments) as avg_victims_per_incident,
          AVG(a.total_offender_segments) as avg_offenders_per_incident,
          AVG(a.total_arrestee_segments) as avg_arrestees_per_incident
        `;
        groupByClause = "GROUP BY ag.state_abbr";
        break;
      case "year":
        selectClause = `
          a.data_year as year,
          COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count,
          AVG(a.total_offense_segments) as avg_offenses_per_incident,
          AVG(a.total_victim_segments) as avg_victims_per_incident,
          AVG(a.total_offender_segments) as avg_offenders_per_incident,
          AVG(a.total_arrestee_segments) as avg_arrestees_per_incident
        `;
        groupByClause = "GROUP BY a.data_year";
        break;
      case "overall":
      default:
        selectClause = `
          COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as incident_count,
          AVG(a.total_offense_segments) as avg_offenses_per_incident,
          AVG(a.total_victim_segments) as avg_victims_per_incident,
          AVG(a.total_offender_segments) as avg_offenders_per_incident,
          AVG(a.total_arrestee_segments) as avg_arrestees_per_incident
        `;
        groupByClause = "";
        break;
    }

    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      ${joinClause}
      ${whereClause}
      ${groupByClause}
      ORDER BY incident_count DESC
      LIMIT ${limit}
    `;

    const rows = await this.runQuery(sql);

    // Add offense descriptions if grouping by offense
    if (input.groupBy === "offense") {
      rows.forEach((row: any) => {
        if (row.offense_code) {
          row.offense_description =
            UCR_OFFENSE_DESCRIPTIONS[row.offense_code] || "Unknown";
        }
      });
    }

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Incident statistics grouped by: ${input.groupBy}`,
    };
  }

  // =========================================================================
  // CUSTOM QUERY (FLEXIBLE SQL)
  // =========================================================================

  @DaemoFunction({
    description:
      "Execute a custom SQL query against the NIBRS BigQuery tables. Use this for complex queries that aren't covered by the other functions. Tables available: agencies, administrative_segment, offense_segment, victim_segment, arrestee_segment. MUST be a SELECT query only.",
    tags: ["nibrs", "custom", "sql", "query"],
    category: "NIBRS",
    inputSchema: ExecuteCustomQueryInput,
    outputSchema: CustomQueryOutput,
  })
  async executeCustomQuery(input: z.infer<typeof ExecuteCustomQueryInput>) {
    // Security: Only allow SELECT queries
    const sqlTrimmed = input.sql.trim().toUpperCase();
    if (!sqlTrimmed.startsWith("SELECT")) {
      throw new Error(
        "Only SELECT queries are allowed. Query must start with SELECT.",
      );
    }

    // Check for dangerous keywords
    const dangerousKeywords = [
      "INSERT",
      "UPDATE",
      "DELETE",
      "DROP",
      "CREATE",
      "ALTER",
      "TRUNCATE",
      "GRANT",
      "REVOKE",
    ];
    for (const keyword of dangerousKeywords) {
      if (sqlTrimmed.includes(keyword)) {
        throw new Error(
          `Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.`,
        );
      }
    }

    // Replace table references with fully qualified names if not already qualified
    let sql = input.sql;
    const tables = [
      "agencies",
      "administrative_segment",
      "offense_segment",
      "victim_segment",
      "arrestee_segment",
    ];
    for (const table of tables) {
      // Match table name not already qualified (negative lookbehind for '.')
      const regex = new RegExp(`(?<!\\.)\\b${table}\\b`, "gi");
      sql = sql.replace(regex, `\`${PROJECT_ID}.${DATASET}.${table}\``);
    }

    // Enforce limit
    const maxLimit = Math.min(input.limit || 1000, 10000);
    if (!sql.toUpperCase().includes("LIMIT")) {
      sql = `${sql} LIMIT ${maxLimit}`;
    }

    const rows = await this.runQuery(sql);

    // Get column names from first row
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      results: rows,
      row_count: rows.length,
      columns,
      truncated: rows.length >= maxLimit,
    };
  }
}
