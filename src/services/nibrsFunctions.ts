// src/services/nibrsFunctions.ts
// NIBRS Crime Data Functions using Google BigQuery

import { DaemoFunction } from "daemo-engine";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  ExecuteCustomQueryInput,
  CustomQueryOutput,
  GetOffenseCountsInput,
  GetOffenseCountsOutput,
  GetOffenseRatesInput,
  GetOffenseRatesOutput,
  GetIncidentDetailsInput,
  GetIncidentDetailsOutput,
  GetClearanceStatsInput,
  GetClearanceStatsOutput,
  GetAgencyListInput,
  GetAgencyListOutput,
  GetOffensesByTimeOfDayInput,
  GetOffensesByTimeOfDayOutput,
  GetOffensesByDayOfWeekInput,
  GetOffensesByDayOfWeekOutput,
  GetOffensesByMonthInput,
  GetOffensesByMonthOutput,
  GetYearOverYearTrendsInput,
  GetYearOverYearTrendsOutput,
  GetVictimDemographicsInput,
  GetVictimDemographicsOutput,
  GetArresteeDemographicsInput,
  GetArresteeDemographicsOutput,
  GetVictimOffenderRelationshipsInput,
  GetVictimOffenderRelationshipsOutput,
  GetInjuryTypesInput,
  GetInjuryTypesOutput,
  GetWeaponInvolvementInput,
  GetWeaponInvolvementOutput,
  GetLocationTypesInput,
  GetLocationTypesOutput,
  RankAgenciesByCrimeInput,
  RankAgenciesByCrimeOutput,
  CompareAgenciesInput,
  CompareAgenciesOutput,
  GetPeerComparisonInput,
  GetPeerComparisonOutput,
  GetHateCrimeStatsInput,
  GetHateCrimeStatsOutput,
  GetArrestStatsInput,
  GetArrestStatsOutput,
  SearchAgenciesInput,
  SearchAgenciesOutput,
} from "./nibrs.schemas";
import { NIBRS_SCHEMA_DOCS } from "./daemoService";

configDotenv();

const PROJECT_ID = "daemo-daemon-testing";
const DATASET = "nibrs_data";

export class NIBRSCrimeFunctions {
  private bigquery: BigQuery;

  constructor() {
    // Initialize BigQuery client with service account credentials from environment
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (serviceAccountPath) {
      // Use file path
      this.bigquery = new BigQuery({
        keyFilename: serviceAccountPath,
        projectId: PROJECT_ID,
      });
      console.log(
        "[BigQuery] Initialized with service account credentials from file",
      );
    } else if (serviceAccountJson) {
      // Use JSON content directly
      try {
        const credentials = JSON.parse(serviceAccountJson);
        this.bigquery = new BigQuery({
          projectId: PROJECT_ID,
          credentials,
        });
        console.log(
          "[BigQuery] Initialized with service account credentials from JSON",
        );
      } catch (error) {
        console.error(
          "[BigQuery] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:",
          error,
        );
        throw new Error("Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format");
      }
    } else {
      // Fallback to default credentials (useful for GCP environments)
      this.bigquery = new BigQuery({ projectId: PROJECT_ID });
      console.log(
        "[BigQuery] Initialized with default credentials (no GOOGLE_APPLICATION_CREDENTIALS env var found)",
      );
    }
  }

  /**
   * Helper method to execute a SQL query using BigQuery
   */
  private async runQuery(sql: string): Promise<any[]> {
    const options = {
      query: sql,
      location: "US",
    };

    const [job] = await this.bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
  }

  // =========================================================================
  // CUSTOM QUERY (FLEXIBLE SQL)
  // =========================================================================

  @DaemoFunction({
    description: `Execute a custom SQL query against the NIBRS BigQuery database. Use this to answer ANY question about crime data by writing SQL queries. Available tables: agencies, administrative_segment, offense_segment, victim_segment, arrestee_segment, law_enforcement_employees. MUST be a SELECT query only. Table names will be automatically qualified with the dataset name. Here is the full schema for the Big Query Database:

${NIBRS_SCHEMA_DOCS}`,
    tags: ["nibrs", "custom", "sql", "query", "bigquery"],
    category: "NIBRS",
    inputSchema: ExecuteCustomQueryInput,
    outputSchema: CustomQueryOutput,
  })
  async executeCustomQuery(input: z.infer<typeof ExecuteCustomQueryInput>) {
    // Security: Only allow SELECT queries (including CTEs with WITH)
    const sqlTrimmed = input.sql.trim().toUpperCase();
    if (!sqlTrimmed.startsWith("SELECT") && !sqlTrimmed.startsWith("WITH")) {
      throw new Error(
        "Only SELECT queries are allowed. Query must start with SELECT or WITH (for CTEs).",
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
      "law_enforcement_employees",
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

  // =========================================================================
  // CATEGORY 1: CORE AGGREGATION
  // =========================================================================

  @DaemoFunction({
    description: `Count offenses with flexible filtering and grouping options.

**SQL Query Template:**
\`\`\`sql
SELECT
  {dynamic GROUP BY fields based on group_by parameter},
  COUNT(*) as offense_count,
  COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE 1=1
  -- Applied if offense_codes provided: filters to specific crime types
  AND o.ucr_offense_code IN ('09A', '120', ...)

  -- Applied if state_abbr provided: filters to specific state
  AND ag.state_abbr = 'CA'

  -- Applied if ori provided: filters to specific agency
  AND o.ori = 'CA0190000'

  -- Applied if start_date provided: filters incidents >= this date
  AND o.incident_date >= '2024-01-01'

  -- Applied if end_date provided: filters incidents <= this date
  AND o.incident_date <= '2024-12-31'

  -- Applied if data_year provided: filters to specific year (default 2024)
  AND o.data_year = 2024

  -- Applied if weapon_involved=true: only includes offenses with weapons
  AND o.type_weapon_force_involved1 IS NOT NULL

  -- Applied if location_types provided: filters to specific locations
  AND o.location_type IN ('14', '20', ...)

  -- Applied if bias_motivation provided: filters to hate crimes with specific bias
  AND o.bias_motivation IN ('15', '21', ...)
GROUP BY {group_by fields}
ORDER BY offense_count DESC
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Narrows results to specific crime types (e.g., ['09A'] for murder, ['120'] for robbery)
- state_abbr: Restricts results to a single state
- ori: Restricts results to a single agency
- start_date/end_date: Filters to a date range within the data_year
- data_year: Selects which year's data to analyze (default 2024)
- weapon_involved: If true, only counts crimes where a weapon was used
- location_types: Only counts crimes at specific locations (e.g., ['14'] = residence, ['20'] = street)
- bias_motivation: Only counts hate crimes with specific bias motivations
- group_by: Determines aggregation level - e.g., ['state_abbr'] for state totals, ['ucr_offense_code'] for crime type breakdown, ['state_abbr', 'ucr_offense_code'] for state+crime combinations

**Example Usage:**
- Count all homicides by state: offense_codes=['09A'], group_by=['state_abbr']
- Count weapon-involved robberies in CA: offense_codes=['120'], state_abbr='CA', weapon_involved=true`,
    tags: ["nibrs", "offenses", "counts", "aggregation"],
    category: "NIBRS - Core Aggregation",
    inputSchema: GetOffenseCountsInput,
    outputSchema: GetOffenseCountsOutput,
  })
  async getOffenseCounts(input: z.infer<typeof GetOffenseCountsInput>) {
    const whereClauses: string[] = ["1=1"];
    const selectFields: string[] = [];
    const groupByFields: string[] = [];

    // Build GROUP BY fields
    if (input.group_by && input.group_by.length > 0) {
      for (const field of input.group_by) {
        if (field === "state_abbr") {
          selectFields.push("ag.state_abbr");
          groupByFields.push("ag.state_abbr");
        } else if (field === "ucr_offense_code") {
          selectFields.push("o.ucr_offense_code");
          groupByFields.push("o.ucr_offense_code");
        } else if (field === "data_year") {
          selectFields.push("o.data_year");
          groupByFields.push("o.data_year");
        } else if (field === "ori") {
          selectFields.push("o.ori");
          groupByFields.push("o.ori");
        } else if (field === "agency_name") {
          selectFields.push("ag.agency_name");
          groupByFields.push("ag.agency_name");
        }
      }
    }

    // Add aggregation fields
    selectFields.push("COUNT(*) as offense_count");
    selectFields.push(
      "COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count",
    );

    // Build WHERE clauses
    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.ori) {
      whereClauses.push(`o.ori = '${input.ori}'`);
    }

    if (input.start_date) {
      whereClauses.push(`o.incident_date >= '${input.start_date}'`);
    }

    if (input.end_date) {
      whereClauses.push(`o.incident_date <= '${input.end_date}'`);
    }

    if (input.data_year) {
      whereClauses.push(`o.data_year = ${input.data_year}`);
    }

    if (input.weapon_involved === true) {
      whereClauses.push(`o.type_weapon_force_involved1 IS NOT NULL`);
    }

    if (input.location_types && input.location_types.length > 0) {
      const locs = input.location_types.map((l) => `'${l}'`).join(", ");
      whereClauses.push(`o.location_type IN (${locs})`);
    }

    if (input.bias_motivation && input.bias_motivation.length > 0) {
      const bias = input.bias_motivation.map((b) => `'${b}'`).join(", ");
      whereClauses.push(`o.bias_motivation IN (${bias})`);
    }

    // Build final SQL
    const selectClause =
      selectFields.length > 0 ? selectFields.join(", ") : "*";
    const groupByClause =
      groupByFields.length > 0 ? `GROUP BY ${groupByFields.join(", ")}` : "";

    const sql = `
      SELECT ${selectClause}
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      ${groupByClause}
      ORDER BY offense_count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Calculate per-capita crime rates (offenses per 100,000 population).

**SQL Query Template:**
\`\`\`sql
SELECT
  {group_by fields: ag.state_abbr OR ag.agency_name OR region fields},
  COUNT(*) as offense_count,
  SUM(le.population) as total_population,
  ROUND((COUNT(*) * 100000.0) / NULLIF(SUM(le.population), 0), 2) as rate_per_100k
FROM offense_segment o
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year <= 2024
  AND le.population IS NOT NULL
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if min_population provided: only includes cities with population >= this value
  AND le.population >= 100000
GROUP BY {group_by fields}
ORDER BY rate_per_100k DESC
\`\`\`

**How Parameters Influence Results:**
- group_by: 'state' aggregates to state level, 'agency' shows city-level rates, 'region' for regional aggregation
- min_population: Filters to cities with population >= this value (e.g., 100000 for cities over 100k). Essential for fair comparisons - comparing rates only among similar-sized cities.
- offense_codes: Calculates rates for specific crimes instead of total crime
- state_abbr: Restricts to a single state
- data_year: Must be 2024 or earlier for valid population data

**Example Usage:**
- Find states with highest violent crime rates: offense_codes=['09A','11A','120','13A'], group_by='state'
- Compare large cities: group_by='agency', min_population=500000`,
    tags: ["nibrs", "rates", "per-capita", "population"],
    category: "NIBRS - Core Aggregation",
    inputSchema: GetOffenseRatesInput,
    outputSchema: GetOffenseRatesOutput,
  })
  async getOffenseRates(input: z.infer<typeof GetOffenseRatesInput>) {
    let selectFields: string[] = [];
    let groupByFields: string[] = [];

    // Build GROUP BY based on input
    if (input.group_by === "state") {
      selectFields.push("ag.state_abbr");
      groupByFields.push("ag.state_abbr");
    } else if (input.group_by === "agency") {
      selectFields.push("ag.agency_name", "ag.state_abbr", "le.population");
      groupByFields.push("ag.agency_name", "ag.state_abbr", "le.population");
    } else if (input.group_by === "region") {
      selectFields.push("ag.region_name");
      groupByFields.push("ag.region_name");
    }

    selectFields.push(
      "COUNT(*) as offense_count",
      "SUM(le.population) as total_population",
      "ROUND((COUNT(*) * 100000.0) / NULLIF(SUM(le.population), 0), 2) as rate_per_100k",
    );

    const whereClauses: string[] = [
      "o.data_year <= 2024",
      "le.population IS NOT NULL",
    ];

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.data_year) {
      whereClauses.push(`o.data_year = ${input.data_year}`);
    }

    if (input.min_population) {
      whereClauses.push(`le.population >= ${input.min_population}`);
    }

    const sql = `
      SELECT ${selectFields.join(", ")}
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON o.ori = le.ori AND o.data_year = le.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY ${groupByFields.join(", ")}
      ORDER BY rate_per_100k DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Get detailed information about specific incidents, including date, location, victim/offender counts, and clearance status.

**SQL Query Template:**
\`\`\`sql
SELECT
  a.incident_number,
  a.ori,
  ag.agency_name,
  ag.state_abbr,
  a.incident_date,
  a.incident_date_hour,
  a.total_offense_segments,
  a.total_victim_segments,
  a.total_offender_segments,
  a.total_arrestee_segments,
  a.cleared_exceptionally
FROM administrative_segment a
JOIN agencies ag ON a.ori = ag.ori
WHERE a.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if ori provided
  AND a.ori = 'CA0190000'
  -- Applied if min_victims provided: only returns incidents with >= this many victims
  -- Useful for finding mass casualty events (e.g., min_victims=4 for mass shootings)
  AND a.total_victim_segments >= 4
  -- Applied if min_offenses provided
  AND a.total_offense_segments >= 2
  -- Applied if offense_codes provided: only returns incidents containing these offense types
  AND EXISTS (
    SELECT 1 FROM offense_segment o
    WHERE o.ori = a.ori AND o.incident_number = a.incident_number
    AND o.ucr_offense_code IN ('09A', '120', ...)
  )
ORDER BY a.total_victim_segments DESC, a.incident_date DESC
\`\`\`

**How Parameters Influence Results:**
- min_victims: Essential for finding mass casualty events. Set to 4+ for mass shootings/violence.
- min_offenses: Finds complex incidents with multiple offense types
- offense_codes: Only returns incidents containing at least one of these offense types
- state_abbr/ori: Geographic filtering
- data_year: Which year to search

**Example Usage:**
- Find mass shooting incidents: min_victims=4, offense_codes=['09A','09B','13A']
- Find complex crime incidents: min_offenses=3`,
    tags: ["nibrs", "incidents", "details", "administrative"],
    category: "NIBRS - Core Aggregation",
    inputSchema: GetIncidentDetailsInput,
    outputSchema: GetIncidentDetailsOutput,
  })
  async getIncidentDetails(input: z.infer<typeof GetIncidentDetailsInput>) {
    const whereClauses: string[] = [`a.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.ori) {
      whereClauses.push(`a.ori = '${input.ori}'`);
    }

    if (input.min_victims) {
      whereClauses.push(`a.total_victim_segments >= ${input.min_victims}`);
    }

    if (input.min_offenses) {
      whereClauses.push(`a.total_offense_segments >= ${input.min_offenses}`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`EXISTS (
        SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        WHERE o.ori = a.ori
        AND o.incident_number = a.incident_number
        AND o.ucr_offense_code IN (${codes})
      )`);
    }

    const sql = `
      SELECT
        a.incident_number,
        a.ori,
        ag.agency_name,
        ag.state_abbr,
        a.incident_date,
        a.incident_date_hour,
        a.total_offense_segments,
        a.total_victim_segments,
        a.total_offender_segments,
        a.total_arrestee_segments,
        a.cleared_exceptionally
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY a.total_victim_segments DESC, a.incident_date DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Calculate clearance rates (percentage of incidents resulting in arrests).

**SQL Query Template:**
\`\`\`sql
SELECT
  {group_by fields: ag.state_abbr OR ag.agency_name OR o.ucr_offense_code},
  COUNT(*) as total_incidents,
  SUM(CASE WHEN a.total_arrestee_segments > 0 THEN 1 ELSE 0 END) as incidents_with_arrests,
  ROUND(100.0 * SUM(CASE WHEN a.total_arrestee_segments > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as clearance_rate_pct
FROM administrative_segment a
JOIN agencies ag ON a.ori = ag.ori
LEFT JOIN offense_segment o
  ON a.ori = o.ori AND a.incident_number = o.incident_number
WHERE a.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if ori provided
  AND a.ori = 'CA0190000'
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY {group_by fields}
ORDER BY clearance_rate_pct DESC
\`\`\`

**How Parameters Influence Results:**
- group_by: 'state' for state-level clearance rates, 'agency' for agency-level, 'offense_code' for crime type
- offense_codes: Calculate clearance rates for specific crime types
- state_abbr/ori: Geographic filtering
- data_year: Which year to analyze

**Note:** Clearance rate = % of incidents with at least one arrest. Higher rates indicate better law enforcement effectiveness.

**Example Usage:**
- Compare murder clearance rates by state: offense_codes=['09A'], group_by='state'
- Check agency's clearance performance: ori='CA0190000', group_by='offense_code'`,
    tags: ["nibrs", "clearance", "arrests", "effectiveness"],
    category: "NIBRS - Core Aggregation",
    inputSchema: GetClearanceStatsInput,
    outputSchema: GetClearanceStatsOutput,
  })
  async getClearanceStats(input: z.infer<typeof GetClearanceStatsInput>) {
    let selectFields: string[] = [];
    let groupByFields: string[] = [];

    if (input.group_by === "state") {
      selectFields.push("ag.state_abbr");
      groupByFields.push("ag.state_abbr");
    } else if (input.group_by === "agency") {
      selectFields.push("ag.agency_name", "ag.state_abbr");
      groupByFields.push("ag.agency_name", "ag.state_abbr");
    } else if (input.group_by === "offense_code") {
      selectFields.push("o.ucr_offense_code");
      groupByFields.push("o.ucr_offense_code");
    }

    selectFields.push(
      "COUNT(*) as total_incidents",
      "SUM(CASE WHEN a.total_arrestee_segments > 0 THEN 1 ELSE 0 END) as incidents_with_arrests",
      "ROUND(100.0 * SUM(CASE WHEN a.total_arrestee_segments > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as clearance_rate_pct",
    );

    const whereClauses: string[] = [`a.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.ori) {
      whereClauses.push(`a.ori = '${input.ori}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const sql = `
      SELECT ${selectFields.join(", ")}
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY ${groupByFields.join(", ")}
      ORDER BY clearance_rate_pct DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Get a list of law enforcement agencies with population data and metadata.

**SQL Query Template:**
\`\`\`sql
SELECT
  ag.ori,
  ag.agency_name,
  ag.state_abbr,
  ag.state_name,
  ag.counties,
  ag.agency_type_name,
  le.population,
  le.population_group_desc,
  le.officer_ct,
  le.total_pe_ct
FROM agencies ag
JOIN law_enforcement_employees le
  ON ag.ori = le.ori AND le.data_year = 2024
WHERE le.population IS NOT NULL
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if min_population provided: only returns agencies with population >= this value
  AND le.population >= 100000
  -- Applied if max_population provided: only returns agencies with population <= this value
  AND le.population <= 500000
  -- Applied if agency_type provided: filters to specific agency type
  AND ag.agency_type_name = 'City'
ORDER BY le.population DESC
\`\`\`

**How Parameters Influence Results:**
- min_population/max_population: Filter to specific population ranges (e.g., 100000-500000 for mid-sized cities)
- state_abbr: Restrict to single state
- agency_type: Filter by type ('City', 'County', 'State Police', etc.)
- data_year: Which year's population data to use

**Example Usage:**
- Find large cities in California: state_abbr='CA', min_population=500000
- Find all county sheriffs in Texas: state_abbr='TX', agency_type='County'`,
    tags: ["nibrs", "agencies", "population", "metadata"],
    category: "NIBRS - Core Aggregation",
    inputSchema: GetAgencyListInput,
    outputSchema: GetAgencyListOutput,
  })
  async getAgencyList(input: z.infer<typeof GetAgencyListInput>) {
    const whereClauses: string[] = ["le.population IS NOT NULL"];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.min_population) {
      whereClauses.push(`le.population >= ${input.min_population}`);
    }

    if (input.max_population) {
      whereClauses.push(`le.population <= ${input.max_population}`);
    }

    if (input.agency_type) {
      whereClauses.push(`ag.agency_type_name = '${input.agency_type}'`);
    }

    const sql = `
      SELECT
        ag.ori,
        ag.agency_name,
        ag.state_abbr,
        ag.state_name,
        ag.counties,
        ag.agency_type_name,
        le.population,
        le.population_group_desc,
        le.officer_ct,
        le.total_pe_ct
      FROM \`${PROJECT_ID}.${DATASET}.agencies\` ag
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON ag.ori = le.ori AND le.data_year = ${input.data_year || 2024}
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY le.population DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  // =========================================================================
  // CATEGORY 2: TEMPORAL ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description: `Analyze crime patterns by hour of day (0-23).

**SQL Query Template:**
\`\`\`sql
SELECT
  a.incident_date_hour as hour_of_day,
  COUNT(*) as offense_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM administrative_segment a
JOIN agencies ag ON a.ori = ag.ori
LEFT JOIN offense_segment o
  ON a.ori = o.ori AND a.incident_number = o.incident_number
WHERE a.data_year = 2024
  AND a.incident_date_hour IS NOT NULL
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY a.incident_date_hour
ORDER BY a.incident_date_hour
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze time patterns for specific crime types (e.g., ['120'] for robbery time patterns)
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Returns:** 24 rows (hours 0-23) with offense counts and percentage of total

**Example Usage:**
- When do burglaries occur?: offense_codes=['220']
- Peak hours for violent crime: offense_codes=['09A','11A','120','13A']`,
    tags: ["nibrs", "temporal", "time", "hour"],
    category: "NIBRS - Temporal Analysis",
    inputSchema: GetOffensesByTimeOfDayInput,
    outputSchema: GetOffensesByTimeOfDayOutput,
  })
  async getOffensesByTimeOfDay(
    input: z.infer<typeof GetOffensesByTimeOfDayInput>,
  ) {
    const whereClauses: string[] = [
      `a.data_year = ${input.data_year || 2024}`,
      "a.incident_date_hour IS NOT NULL",
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const sql = `
      SELECT
        a.incident_date_hour as hour_of_day,
        COUNT(*) as offense_count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY a.incident_date_hour
      ORDER BY a.incident_date_hour
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze crime patterns by day of week (1=Sunday through 7=Saturday).

**SQL Query Template:**
\`\`\`sql
SELECT
  EXTRACT(DAYOFWEEK FROM a.incident_date) as day_of_week,
  CASE EXTRACT(DAYOFWEEK FROM a.incident_date)
    WHEN 1 THEN 'Sunday'
    WHEN 2 THEN 'Monday'
    WHEN 3 THEN 'Tuesday'
    WHEN 4 THEN 'Wednesday'
    WHEN 5 THEN 'Thursday'
    WHEN 6 THEN 'Friday'
    WHEN 7 THEN 'Saturday'
  END as day_name,
  COUNT(*) as offense_count
FROM administrative_segment a
JOIN agencies ag ON a.ori = ag.ori
LEFT JOIN offense_segment o
  ON a.ori = o.ori AND a.incident_number = o.incident_number
WHERE a.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY day_of_week, day_name
ORDER BY day_of_week
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze day-of-week patterns for specific crimes
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Returns:** 7 rows (one per day) with day number (1-7), day name, and offense count

**Example Usage:**
- Are weekend assaults more common?: offense_codes=['13A','13B']
- Weekday vs weekend property crime: offense_codes=['220','23D','240']`,
    tags: ["nibrs", "temporal", "day", "week"],
    category: "NIBRS - Temporal Analysis",
    inputSchema: GetOffensesByDayOfWeekInput,
    outputSchema: GetOffensesByDayOfWeekOutput,
  })
  async getOffensesByDayOfWeek(
    input: z.infer<typeof GetOffensesByDayOfWeekInput>,
  ) {
    const whereClauses: string[] = [`a.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const sql = `
      SELECT
        EXTRACT(DAYOFWEEK FROM a.incident_date) as day_of_week,
        CASE EXTRACT(DAYOFWEEK FROM a.incident_date)
          WHEN 1 THEN 'Sunday'
          WHEN 2 THEN 'Monday'
          WHEN 3 THEN 'Tuesday'
          WHEN 4 THEN 'Wednesday'
          WHEN 5 THEN 'Thursday'
          WHEN 6 THEN 'Friday'
          WHEN 7 THEN 'Saturday'
        END as day_name,
        COUNT(*) as offense_count
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY day_of_week, day_name
      ORDER BY day_of_week
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze crime patterns by month (1-12) to identify seasonal trends.

**SQL Query Template:**
\`\`\`sql
SELECT
  EXTRACT(MONTH FROM a.incident_date) as month_num,
  FORMAT_DATE('%B', a.incident_date) as month_name,
  COUNT(*) as offense_count
FROM administrative_segment a
JOIN agencies ag ON a.ori = ag.ori
LEFT JOIN offense_segment o
  ON a.ori = o.ori AND a.incident_number = o.incident_number
WHERE a.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY month_num, month_name
ORDER BY month_num
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze seasonal patterns for specific crimes
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Returns:** 12 rows (one per month) with month number (1-12), month name, and offense count

**Example Usage:**
- Summer vs winter crime patterns: No filters to see overall seasonal trends
- Holiday theft patterns: offense_codes=['23D','23F','23H'] (larceny/shoplifting)`,
    tags: ["nibrs", "temporal", "month", "seasonal"],
    category: "NIBRS - Temporal Analysis",
    inputSchema: GetOffensesByMonthInput,
    outputSchema: GetOffensesByMonthOutput,
  })
  async getOffensesByMonth(input: z.infer<typeof GetOffensesByMonthInput>) {
    const whereClauses: string[] = [`a.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const sql = `
      SELECT
        EXTRACT(MONTH FROM a.incident_date) as month_num,
        FORMAT_DATE('%B', a.incident_date) as month_name,
        COUNT(*) as offense_count
      FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        ON a.ori = o.ori AND a.incident_number = o.incident_number
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY month_num, month_name
      ORDER BY month_num
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze year-over-year crime trends with optional per-capita rates.

**SQL Query Template:**
\`\`\`sql
WITH yearly_counts AS (
  SELECT
    o.data_year,
    COUNT(*) as offense_count,
    COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count,
    -- If include_rates=true, also calculates:
    SUM(le.population) as total_population
  FROM offense_segment o
  JOIN agencies ag ON o.ori = ag.ori
  -- If include_rates=true, joins population data:
  LEFT JOIN law_enforcement_employees le ON o.ori = le.ori AND o.data_year = le.data_year
  WHERE o.data_year BETWEEN 2020 AND 2024
    -- Applied if state_abbr provided
    AND ag.state_abbr = 'CA'
    -- Applied if ori provided
    AND o.ori = 'CA0190000'
    -- Applied if offense_codes provided
    AND o.ucr_offense_code IN ('09A', '120', ...)
    -- If include_rates=true, filters out NULL populations:
    AND le.population IS NOT NULL
  GROUP BY o.data_year
)
SELECT
  data_year,
  offense_count,
  incident_count,
  -- If include_rates=true, also returns:
  ROUND((offense_count * 100000.0) / NULLIF(total_population, 0), 2) as rate_per_100k,
  -- Year-over-year change calculations:
  LAG(offense_count) OVER (ORDER BY data_year) as prev_year_count,
  offense_count - LAG(offense_count) OVER (ORDER BY data_year) as yoy_change,
  ROUND(100.0 * (offense_count - LAG(offense_count) OVER (ORDER BY data_year)) / NULLIF(LAG(offense_count) OVER (ORDER BY data_year), 0), 2) as yoy_pct_change
FROM yearly_counts
ORDER BY data_year
\`\`\`

**How Parameters Influence Results:**
- start_year/end_year: Define the time range (default 2020-2024)
- include_rates: If true, calculates per-capita rates in addition to raw counts. Essential for meaningful comparisons when population changes over time.
- offense_codes: Track trends for specific crime types
- state_abbr/ori: Geographic filtering

**Returns:** One row per year with offense counts, year-over-year changes, and percent changes. If include_rates=true, also includes per-capita rates.

**Example Usage:**
- Track violent crime trends in California: state_abbr='CA', offense_codes=['09A','11A','120','13A'], include_rates=true
- Has crime increased in your city?: ori='CA0190000', start_year=2020, end_year=2024`,
    tags: ["nibrs", "temporal", "trends", "year-over-year"],
    category: "NIBRS - Temporal Analysis",
    inputSchema: GetYearOverYearTrendsInput,
    outputSchema: GetYearOverYearTrendsOutput,
  })
  async getYearOverYearTrends(
    input: z.infer<typeof GetYearOverYearTrendsInput>,
  ) {
    const whereClauses: string[] = [
      `o.data_year BETWEEN ${input.start_year || 2020} AND ${input.end_year || 2024}`,
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.ori) {
      whereClauses.push(`o.ori = '${input.ori}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    let selectFieldsCTE = [
      "o.data_year",
      "COUNT(*) as offense_count",
      "COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count",
    ];
    let joinClause = "";
    let selectFieldsFinal = [
      "data_year",
      "offense_count",
      "incident_count",
      "LAG(offense_count) OVER (ORDER BY data_year) as prev_year_count",
      "offense_count - LAG(offense_count) OVER (ORDER BY data_year) as yoy_change",
      "ROUND(100.0 * (offense_count - LAG(offense_count) OVER (ORDER BY data_year)) / NULLIF(LAG(offense_count) OVER (ORDER BY data_year), 0), 2) as yoy_pct_change",
    ];

    if (input.include_rates) {
      selectFieldsCTE.push("SUM(le.population) as total_population");
      joinClause = `LEFT JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le ON o.ori = le.ori AND o.data_year = le.data_year`;
      whereClauses.push("le.population IS NOT NULL");
      selectFieldsFinal.push(
        "total_population",
        "ROUND((offense_count * 100000.0) / NULLIF(total_population, 0), 2) as rate_per_100k",
      );
    }

    const sql = `
      WITH yearly_counts AS (
        SELECT ${selectFieldsCTE.join(", ")}
        FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
        JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
        ${joinClause}
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY o.data_year
      )
      SELECT ${selectFieldsFinal.join(", ")}
      FROM yearly_counts
      ORDER BY data_year
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  // =========================================================================
  // CATEGORY 3: DEMOGRAPHIC ANALYSIS
  // =========================================================================

  @DaemoFunction({
    description: `Analyze victim demographics (sex, race, age, ethnicity) for individual victims only.

**SQL Query Template:**
\`\`\`sql
SELECT
  {group_by fields: sex_of_victim, race_of_victim, age_of_victim, ethnicity},
  COUNT(*) as victim_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM victim_segment v
JOIN agencies ag ON v.ori = ag.ori
WHERE v.type_of_victim = 'I'  -- Individual victims only (excludes businesses, society)
  AND v.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND v.ucr_offense_code1 IN ('09A', '120', ...)
GROUP BY {group_by fields}
ORDER BY victim_count DESC
\`\`\`

**How Parameters Influence Results:**
- group_by: REQUIRED - specifies which demographic dimensions to analyze. Options:
  * ['sex_of_victim'] - Gender breakdown
  * ['race_of_victim'] - Racial breakdown
  * ['age_of_victim'] - Age distribution
  * ['ethnicity'] - Hispanic/Non-Hispanic breakdown
  * ['sex_of_victim', 'race_of_victim'] - Intersectional analysis
- offense_codes: Analyze victim demographics for specific crime types (e.g., ['11A'] for rape victims)
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Example Usage:**
- Gender breakdown of assault victims: offense_codes=['13A','13B'], group_by=['sex_of_victim']
- Racial demographics of homicide victims: offense_codes=['09A'], group_by=['race_of_victim']`,
    tags: ["nibrs", "victims", "demographics", "sex", "race", "age"],
    category: "NIBRS - Demographics",
    inputSchema: GetVictimDemographicsInput,
    outputSchema: GetVictimDemographicsOutput,
  })
  async getVictimDemographics(
    input: z.infer<typeof GetVictimDemographicsInput>,
  ) {
    const selectFields: string[] = [];
    const groupByFields: string[] = [];

    for (const field of input.group_by) {
      selectFields.push(`v.${field}`);
      groupByFields.push(`v.${field}`);
    }

    selectFields.push(
      "COUNT(*) as victim_count",
      "ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total",
    );

    const whereClauses: string[] = [
      "v.type_of_victim = 'I'",
      `v.data_year = ${input.data_year || 2024}`,
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`v.ucr_offense_code1 IN (${codes})`);
    }

    const sql = `
      SELECT ${selectFields.join(", ")}
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY ${groupByFields.join(", ")}
      ORDER BY victim_count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze arrestee demographics (sex, race, age, ethnicity).

**SQL Query Template:**
\`\`\`sql
SELECT
  {group_by fields: sex_of_arrestee, race_of_arrestee, age_of_arrestee, ethnicity},
  COUNT(*) as arrestee_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM arrestee_segment ar
JOIN agencies ag ON ar.ori = ag.ori
WHERE ar.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND ar.ucr_arrest_offense_code IN ('09A', '120', ...)
  -- Applied if juvenile_only=true: only includes arrestees under 18
  AND SAFE_CAST(ar.age_of_arrestee AS INT64) < 18
GROUP BY {group_by fields}
ORDER BY arrestee_count DESC
\`\`\`

**How Parameters Influence Results:**
- group_by: REQUIRED - specifies which demographic dimensions to analyze. Options:
  * ['sex_of_arrestee'] - Gender breakdown
  * ['race_of_arrestee'] - Racial breakdown
  * ['age_of_arrestee'] - Age distribution
  * ['ethnicity'] - Hispanic/Non-Hispanic breakdown
  * Multiple fields for intersectional analysis
- juvenile_only: If true, only analyzes arrestees under 18 years old
- offense_codes: Analyze arrestee demographics for specific crime types
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Example Usage:**
- Gender of drug arrestees: offense_codes=['35A'], group_by=['sex_of_arrestee']
- Juvenile arrest demographics: juvenile_only=true, group_by=['race_of_arrestee']`,
    tags: ["nibrs", "arrestees", "demographics", "sex", "race", "age"],
    category: "NIBRS - Demographics",
    inputSchema: GetArresteeDemographicsInput,
    outputSchema: GetArresteeDemographicsOutput,
  })
  async getArresteeDemographics(
    input: z.infer<typeof GetArresteeDemographicsInput>,
  ) {
    const selectFields: string[] = [];
    const groupByFields: string[] = [];

    for (const field of input.group_by) {
      selectFields.push(`ar.${field}`);
      groupByFields.push(`ar.${field}`);
    }

    selectFields.push(
      "COUNT(*) as arrestee_count",
      "ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total",
    );

    const whereClauses: string[] = [`ar.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`ar.ucr_arrest_offense_code IN (${codes})`);
    }

    if (input.juvenile_only === true) {
      whereClauses.push("SAFE_CAST(ar.age_of_arrestee AS INT64) < 18");
    }

    const sql = `
      SELECT ${selectFields.join(", ")}
      FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON ar.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY ${groupByFields.join(", ")}
      ORDER BY arrestee_count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze relationships between victims and offenders (e.g., stranger, acquaintance, family member).

**SQL Query Template:**
\`\`\`sql
SELECT
  v.victim_relationship_to_offender1 as relationship,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM victim_segment v
JOIN agencies ag ON v.ori = ag.ori
WHERE v.type_of_victim = 'I'
  AND v.data_year = 2024
  AND v.victim_relationship_to_offender1 IS NOT NULL
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND v.ucr_offense_code1 IN ('09A', '120', ...)
GROUP BY relationship
ORDER BY count DESC
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze relationship patterns for specific crime types (e.g., ['11A'] for rape, ['09A'] for homicide)
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Common Relationship Codes:**
- SE: Stranger
- AQ: Acquaintance
- OF: Other Family Member
- SP: Spouse
- CH: Parent
- BG: Boyfriend/Girlfriend

**Example Usage:**
- Who commits domestic violence?: offense_codes=['13A','13B'], look for family/spouse relationships
- Are homicides stranger or acquaintance-based?: offense_codes=['09A']`,
    tags: ["nibrs", "victims", "relationships", "offenders"],
    category: "NIBRS - Demographics",
    inputSchema: GetVictimOffenderRelationshipsInput,
    outputSchema: GetVictimOffenderRelationshipsOutput,
  })
  async getVictimOffenderRelationships(
    input: z.infer<typeof GetVictimOffenderRelationshipsInput>,
  ) {
    const whereClauses: string[] = [
      "v.type_of_victim = 'I'",
      `v.data_year = ${input.data_year || 2024}`,
      "v.victim_relationship_to_offender1 IS NOT NULL",
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`v.ucr_offense_code1 IN (${codes})`);
    }

    const sql = `
      SELECT
        v.victim_relationship_to_offender1 as relationship,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY relationship
      ORDER BY count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze types of injuries sustained by victims in violent crimes.

**SQL Query Template:**
\`\`\`sql
SELECT
  v.type_of_injury1 as injury_type,
  COUNT(*) as count
FROM victim_segment v
JOIN agencies ag ON v.ori = ag.ori
WHERE v.type_of_victim = 'I'
  AND v.data_year = 2024
  AND v.type_of_injury1 IS NOT NULL
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND v.ucr_offense_code1 IN ('09A', '120', ...)
GROUP BY injury_type
ORDER BY count DESC
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze injury patterns for specific crime types (e.g., ['13A'] for aggravated assault)
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Common Injury Types:**
- N: None
- M: Major (broken bones, internal injuries, severe lacerations)
- S: Severe (loss of consciousness, loss of teeth)
- L: Apparent Minor (bruises, scratches)

**Example Usage:**
- Severity of assault injuries: offense_codes=['13A','13B']
- Injury patterns in domestic violence: offense_codes=['13A'], filter results by relationship`,
    tags: ["nibrs", "victims", "injuries", "violence"],
    category: "NIBRS - Demographics",
    inputSchema: GetInjuryTypesInput,
    outputSchema: GetInjuryTypesOutput,
  })
  async getInjuryTypes(input: z.infer<typeof GetInjuryTypesInput>) {
    const whereClauses: string[] = [
      "v.type_of_victim = 'I'",
      `v.data_year = ${input.data_year || 2024}`,
      "v.type_of_injury1 IS NOT NULL",
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`v.ucr_offense_code1 IN (${codes})`);
    }

    const sql = `
      SELECT
        v.type_of_injury1 as injury_type,
        COUNT(*) as count
      FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON v.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY injury_type
      ORDER BY count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  // =========================================================================
  // CATEGORY 4: WEAPON & LOCATION
  // =========================================================================

  @DaemoFunction({
    description: `Analyze weapon/force types used in offenses.

**SQL Query Template:**
\`\`\`sql
SELECT
  o.type_weapon_force_involved1 as weapon_type,
  COUNT(*) as offense_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year = 2024
  AND o.type_weapon_force_involved1 IS NOT NULL
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY weapon_type
ORDER BY offense_count DESC
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze weapon usage for specific crime types (e.g., ['09A'] for homicide weapons, ['120'] for robbery weapons)
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Common Weapon Codes:**
- 11: Firearm (type unknown)
- 12: Handgun
- 13: Rifle
- 14: Shotgun
- 20: Knife/Cutting Instrument
- 40: Personal Weapons (hands, fists, feet)
- 90: Other

**Example Usage:**
- What weapons are used in robberies?: offense_codes=['120']
- Firearm involvement in assaults: offense_codes=['13A'], filter results to codes 11-15`,
    tags: ["nibrs", "weapons", "firearms", "force"],
    category: "NIBRS - Weapon & Location",
    inputSchema: GetWeaponInvolvementInput,
    outputSchema: GetWeaponInvolvementOutput,
  })
  async getWeaponInvolvement(input: z.infer<typeof GetWeaponInvolvementInput>) {
    const whereClauses: string[] = [
      `o.data_year = ${input.data_year || 2024}`,
      "o.type_weapon_force_involved1 IS NOT NULL",
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const sql = `
      SELECT
        o.type_weapon_force_involved1 as weapon_type,
        COUNT(*) as offense_count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY weapon_type
      ORDER BY offense_count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze where crimes occur (location types).

**SQL Query Template:**
\`\`\`sql
SELECT
  o.location_type,
  COUNT(*) as offense_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year = 2024
  AND o.location_type IS NOT NULL
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY location_type
ORDER BY offense_count DESC
\`\`\`

**How Parameters Influence Results:**
- offense_codes: Analyze location patterns for specific crime types (e.g., ['220'] for burglary locations, ['23D'] for shoplifting locations)
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Common Location Codes:**
- 14: Residence/Home
- 20: Commercial/Office Building
- 20: Convenience Store
- 13: Highway/Road/Alley
- 25: Parking Lot/Garage

**Example Usage:**
- Where do burglaries occur?: offense_codes=['220']
- Where are assaults most common?: offense_codes=['13A','13B']`,
    tags: ["nibrs", "location", "place", "where"],
    category: "NIBRS - Weapon & Location",
    inputSchema: GetLocationTypesInput,
    outputSchema: GetLocationTypesOutput,
  })
  async getLocationTypes(input: z.infer<typeof GetLocationTypesInput>) {
    const whereClauses: string[] = [
      `o.data_year = ${input.data_year || 2024}`,
      "o.location_type IS NOT NULL",
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const sql = `
      SELECT
        o.location_type,
        COUNT(*) as offense_count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY location_type
      ORDER BY offense_count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  // =========================================================================
  // CATEGORY 5: COMPARISON & RANKING
  // =========================================================================

  @DaemoFunction({
    description: `Rank cities/agencies by crime metrics (total count or per-capita rate).

**SQL Query Template:**
\`\`\`sql
SELECT
  ag.agency_name,
  ag.state_abbr,
  le.population,
  COUNT(*) as offense_count,
  ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k
FROM offense_segment o
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year <= 2024
  AND le.population IS NOT NULL
  -- Applied if state_abbr provided: only ranks agencies within this state
  AND ag.state_abbr = 'CA'
  -- Applied if min_population provided: only ranks cities with population >= this value
  -- This is ESSENTIAL for fair comparisons - don't compare NYC to a small town
  AND le.population >= 100000
  -- Applied if offense_codes provided: ranks by specific crime types instead of total crime
  AND o.ucr_offense_code IN ('09A', '120', ...)
GROUP BY ag.agency_name, ag.state_abbr, le.population
-- Order depends on metric parameter:
ORDER BY rate_per_100k DESC  -- if metric='rate_per_100k' (RECOMMENDED)
-- OR
ORDER BY offense_count DESC  -- if metric='total_count'
LIMIT {limit}
\`\`\`

**How Parameters Influence Results:**
- metric: 'rate_per_100k' (RECOMMENDED) ranks by per-capita rate for fair comparison. 'total_count' ranks by absolute numbers (biased toward large cities).
- min_population: CRITICAL for fair comparisons. Set to 100000+ to compare only similar-sized cities. Without this, small towns can have misleading rates.
- offense_codes: Rank by specific crime types (e.g., ['09A'] for most dangerous cities by homicide rate)
- state_abbr: Rank within a single state (e.g., find most dangerous city in California)
- limit: Number of top cities to return (default 20)

**Example Usage:**
- Most dangerous large cities: metric='rate_per_100k', min_population=250000, offense_codes=['09A','11A','120','13A']
- Top robbery cities in Texas: state_abbr='TX', offense_codes=['120'], metric='rate_per_100k'`,
    tags: ["nibrs", "ranking", "comparison", "top"],
    category: "NIBRS - Comparison & Ranking",
    inputSchema: RankAgenciesByCrimeInput,
    outputSchema: RankAgenciesByCrimeOutput,
  })
  async rankAgenciesByCrime(input: z.infer<typeof RankAgenciesByCrimeInput>) {
    const whereClauses: string[] = [
      "o.data_year <= 2024",
      "le.population IS NOT NULL",
    ];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.data_year) {
      whereClauses.push(`o.data_year = ${input.data_year}`);
    }

    if (input.min_population) {
      whereClauses.push(`le.population >= ${input.min_population}`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`o.ucr_offense_code IN (${codes})`);
    }

    const orderBy =
      input.metric === "rate_per_100k"
        ? "rate_per_100k DESC"
        : "offense_count DESC";

    const sql = `
      SELECT
        ag.agency_name,
        ag.state_abbr,
        le.population,
        COUNT(*) as offense_count,
        ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON o.ori = le.ori AND o.data_year = le.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY ag.agency_name, ag.state_abbr, le.population
      ORDER BY ${orderBy}
      LIMIT ${input.limit || 20}
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Compare specific agencies side-by-side across multiple crime categories.

**SQL Query Template:**
\`\`\`sql
SELECT
  ag.agency_name,
  ag.state_abbr,
  le.population,
  COUNT(*) as total_offenses,
  ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k,
  SUM(CASE WHEN o.ucr_offense_code IN ('09A', '09B') THEN 1 ELSE 0 END) as homicides,
  SUM(CASE WHEN o.ucr_offense_code = '120' THEN 1 ELSE 0 END) as robberies,
  SUM(CASE WHEN o.ucr_offense_code IN ('13A', '13B') THEN 1 ELSE 0 END) as assaults,
  SUM(CASE WHEN o.ucr_offense_code = '220' THEN 1 ELSE 0 END) as burglaries,
  SUM(CASE WHEN o.ucr_offense_code = '240' THEN 1 ELSE 0 END) as vehicle_thefts
FROM offense_segment o
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year <= 2024
  AND le.population IS NOT NULL
  -- Applied based on ori_list parameter: only includes specified agencies
  AND o.ori IN UNNEST(['CA0190000', 'NY0030000', ...])
GROUP BY ag.agency_name, ag.state_abbr, le.population
ORDER BY le.population DESC
\`\`\`

**How Parameters Influence Results:**
- ori_list: REQUIRED - List of ORI codes to compare. Use searchAgencies function first to find ORI codes for cities of interest.
- data_year: Which year to compare (default 2024)

**Returns:** One row per agency with breakdowns for:
- Total offenses and rate per 100k
- Homicides (09A, 09B)
- Robberies (120)
- Assaults (13A, 13B)
- Burglaries (220)
- Vehicle thefts (240)

**Example Usage:**
1. First: searchAgencies with search_term='Los Angeles' to get ORI code
2. Then: compareAgencies with ori_list=['CA0190000', 'NY0030000', 'IL0130200'] to compare LA, NYC, Chicago`,
    tags: ["nibrs", "comparison", "agencies", "cities"],
    category: "NIBRS - Comparison & Ranking",
    inputSchema: CompareAgenciesInput,
    outputSchema: CompareAgenciesOutput,
  })
  async compareAgencies(input: z.infer<typeof CompareAgenciesInput>) {
    const oriList = input.ori_list.map((o) => `'${o}'`).join(", ");

    const sql = `
      SELECT
        ag.agency_name,
        ag.state_abbr,
        le.population,
        COUNT(*) as total_offenses,
        ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k,
        SUM(CASE WHEN o.ucr_offense_code IN ('09A', '09B') THEN 1 ELSE 0 END) as homicides,
        SUM(CASE WHEN o.ucr_offense_code = '120' THEN 1 ELSE 0 END) as robberies,
        SUM(CASE WHEN o.ucr_offense_code IN ('13A', '13B') THEN 1 ELSE 0 END) as assaults,
        SUM(CASE WHEN o.ucr_offense_code = '220' THEN 1 ELSE 0 END) as burglaries,
        SUM(CASE WHEN o.ucr_offense_code = '240' THEN 1 ELSE 0 END) as vehicle_thefts
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON o.ori = le.ori AND o.data_year = le.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE o.data_year <= 2024
        AND le.population IS NOT NULL
        AND o.data_year = ${input.data_year || 2024}
        AND o.ori IN (${oriList})
      GROUP BY ag.agency_name, ag.state_abbr, le.population
      ORDER BY le.population DESC
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Compare an agency to similar-sized peer agencies (by population).

**SQL Query Template:**
\`\`\`sql
WITH target_agency AS (
  SELECT ori, agency_name, state_abbr, population
  FROM law_enforcement_employees
  WHERE ori = 'CA0190000' AND data_year = 2024
),
peer_agencies AS (
  SELECT le.ori, ag.agency_name, ag.state_abbr, le.population
  FROM law_enforcement_employees le
  JOIN agencies ag ON le.ori = ag.ori
  CROSS JOIN target_agency ta
  WHERE le.data_year = 2024
    -- Population range based on population_range_pct parameter (default ±20%)
    AND le.population BETWEEN
      ta.population * (1 - 0.20) AND
      ta.population * (1 + 0.20)
    AND le.ori != ta.ori  -- Exclude target agency itself
)
SELECT
  ag.agency_name,
  ag.state_abbr,
  le.population,
  COUNT(*) as offense_count,
  ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k,
  CASE WHEN ag.ori = (SELECT ori FROM target_agency) THEN 'TARGET' ELSE 'PEER' END as agency_type
FROM offense_segment o
JOIN law_enforcement_employees le ON o.ori = le.ori AND o.data_year = le.data_year
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year <= 2024
  AND (ag.ori IN (SELECT ori FROM peer_agencies) OR ag.ori = (SELECT ori FROM target_agency))
GROUP BY ag.agency_name, ag.state_abbr, le.population, ag.ori
ORDER BY rate_per_100k
\`\`\`

**How Parameters Influence Results:**
- ori: REQUIRED - Target agency ORI code to compare. Use searchAgencies to find ORI code.
- population_range_pct: Defines peer group. Default 20 means ±20% population (e.g., if target has 500k population, peers are 400k-600k). Larger values include more peers but less similar cities.
- data_year: Which year to compare (default 2024)

**Returns:** All peer agencies plus the target agency, with each marked as 'TARGET' or 'PEER', sorted by crime rate.

**Example Usage:**
- How does Austin compare to similar-sized cities?: First use searchAgencies to find Austin's ORI, then getPeerComparison
- Narrow peer group: population_range_pct=10 for ±10% (more similar cities)
- Wide peer group: population_range_pct=30 for ±30% (more comparison points)`,
    tags: ["nibrs", "comparison", "peers", "benchmark"],
    category: "NIBRS - Comparison & Ranking",
    inputSchema: GetPeerComparisonInput,
    outputSchema: GetPeerComparisonOutput,
  })
  async getPeerComparison(input: z.infer<typeof GetPeerComparisonInput>) {
    const rangePct = (input.population_range_pct || 20) / 100.0;

    const sql = `
      WITH target_agency AS (
        SELECT ori, agency_name, state_abbr, population
        FROM \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\`
        WHERE ori = '${input.ori}' AND data_year = ${input.data_year || 2024}
      ),
      peer_agencies AS (
        SELECT le.ori, ag.agency_name, ag.state_abbr, le.population
        FROM \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON le.ori = ag.ori
        CROSS JOIN target_agency ta
        WHERE le.data_year = ${input.data_year || 2024}
          AND le.population BETWEEN
            ta.population * (1 - ${rangePct}) AND
            ta.population * (1 + ${rangePct})
          AND le.ori != ta.ori
      )
      SELECT
        ag.agency_name,
        ag.state_abbr,
        le.population,
        COUNT(*) as offense_count,
        ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k,
        CASE WHEN ag.ori = (SELECT ori FROM target_agency) THEN 'TARGET' ELSE 'PEER' END as agency_type
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON o.ori = le.ori AND o.data_year = le.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE o.data_year <= 2024
        AND (ag.ori IN (SELECT ori FROM peer_agencies) OR ag.ori = (SELECT ori FROM target_agency))
      GROUP BY ag.agency_name, ag.state_abbr, le.population, ag.ori
      ORDER BY rate_per_100k
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  // =========================================================================
  // CATEGORY 6: SPECIALIZED
  // =========================================================================

  @DaemoFunction({
    description: `Analyze hate crimes by bias motivation (racial, religious, sexual orientation, etc.).

**SQL Query Template:**
\`\`\`sql
SELECT
  o.bias_motivation,
  COUNT(*) as offense_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE o.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if exclude_no_bias=true (default): excludes code '88' (no bias/not a hate crime)
  AND o.bias_motivation != '88'
GROUP BY bias_motivation
ORDER BY offense_count DESC
\`\`\`

**How Parameters Influence Results:**
- exclude_no_bias: If true (default), only shows actual hate crimes. If false, includes all offenses including non-hate crimes (bias code '88').
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Common Bias Codes:**
- 11-15: Anti-Black, Anti-White, Anti-Hispanic, Anti-Asian, etc. (racial)
- 21-29: Anti-Jewish, Anti-Catholic, Anti-Islamic, etc. (religious)
- 41-45: Anti-Gay Male, Anti-Lesbian, Anti-Transgender, etc. (sexual orientation/gender identity)
- 88: None (not a hate crime) - excluded by default

**Example Usage:**
- What types of hate crimes are most common?: exclude_no_bias=true
- Racial vs religious hate crimes: exclude_no_bias=true, then filter results by code ranges`,
    tags: ["nibrs", "hate-crimes", "bias", "discrimination"],
    category: "NIBRS - Specialized",
    inputSchema: GetHateCrimeStatsInput,
    outputSchema: GetHateCrimeStatsOutput,
  })
  async getHateCrimeStats(input: z.infer<typeof GetHateCrimeStatsInput>) {
    const whereClauses: string[] = [`o.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.exclude_no_bias !== false) {
      whereClauses.push(`o.bias_motivation != '88'`);
    }

    const sql = `
      SELECT
        o.bias_motivation,
        COUNT(*) as offense_count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY bias_motivation
      ORDER BY offense_count DESC
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  @DaemoFunction({
    description: `Analyze arrest patterns and statistics.

**SQL Query Template:**
\`\`\`sql
SELECT
  {group_by fields: ucr_arrest_offense_code, state_abbr, type_of_arrest, etc.},
  COUNT(*) as arrest_count,
  COUNT(DISTINCT ar.ori || '-' || ar.incident_number) as incidents_with_arrests,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
FROM arrestee_segment ar
JOIN agencies ag ON ar.ori = ag.ori
WHERE ar.data_year = 2024
  -- Applied if state_abbr provided
  AND ag.state_abbr = 'CA'
  -- Applied if offense_codes provided
  AND ar.ucr_arrest_offense_code IN ('09A', '120', ...)
  -- Applied if arrest_type provided: filters to specific arrest type
  AND ar.type_of_arrest = 'O'  -- 'O'=On-View, 'S'=Summoned/Cited, 'T'=Taken into Custody
GROUP BY {group_by fields}
ORDER BY arrest_count DESC
\`\`\`

**How Parameters Influence Results:**
- group_by: Optional - fields to group by (e.g., ['ucr_arrest_offense_code'] for breakdown by crime type, ['state_abbr'] for state comparison)
- arrest_type: Optional - filter to specific arrest type: 'O' (On-View), 'S' (Summoned/Cited), 'T' (Taken into Custody)
- offense_codes: Filter to arrests for specific crime types
- state_abbr: Restrict to single state
- data_year: Which year to analyze

**Example Usage:**
- What crimes have most arrests?: group_by=['ucr_arrest_offense_code']
- How many arrests are on-view vs summoned?: group_by=['type_of_arrest']`,
    tags: ["nibrs", "arrests", "arrestees", "enforcement"],
    category: "NIBRS - Specialized",
    inputSchema: GetArrestStatsInput,
    outputSchema: GetArrestStatsOutput,
  })
  async getArrestStats(input: z.infer<typeof GetArrestStatsInput>) {
    const selectFields: string[] = [];
    const groupByFields: string[] = [];

    if (input.group_by && input.group_by.length > 0) {
      for (const field of input.group_by) {
        selectFields.push(`ar.${field}`);
        groupByFields.push(`ar.${field}`);
      }
    }

    selectFields.push(
      "COUNT(*) as arrest_count",
      "COUNT(DISTINCT ar.ori || '-' || ar.incident_number) as incidents_with_arrests",
    );

    if (groupByFields.length > 0) {
      selectFields.push(
        "ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total",
      );
    }

    const whereClauses: string[] = [`ar.data_year = ${input.data_year || 2024}`];

    if (input.state_abbr) {
      whereClauses.push(`ag.state_abbr = '${input.state_abbr}'`);
    }

    if (input.offense_codes && input.offense_codes.length > 0) {
      const codes = input.offense_codes.map((c) => `'${c}'`).join(", ");
      whereClauses.push(`ar.ucr_arrest_offense_code IN (${codes})`);
    }

    if (input.arrest_type) {
      whereClauses.push(`ar.type_of_arrest = '${input.arrest_type}'`);
    }

    const groupByClause =
      groupByFields.length > 0 ? `GROUP BY ${groupByFields.join(", ")}` : "";
    const orderByClause = groupByFields.length > 0 ? "ORDER BY arrest_count DESC" : "";

    const sql = `
      SELECT ${selectFields.join(", ")}
      FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON ar.ori = ag.ori
      WHERE ${whereClauses.join(" AND ")}
      ${groupByClause}
      ${orderByClause}
      LIMIT 1000
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  @DaemoFunction({
    description: `Search for agencies by name, county, or state. Use this to find ORI codes for specific cities/agencies.

**SQL Query Template:**
\`\`\`sql
SELECT
  ori,
  agency_name,
  state_abbr,
  state_name,
  counties,
  agency_type_name
FROM agencies
WHERE (
  LOWER(agency_name) LIKE '%search_term%'
  OR LOWER(counties) LIKE '%search_term%'
  OR LOWER(state_name) LIKE '%search_term%'
)
  -- Applied if state_abbr provided: only search within this state
  AND state_abbr = 'CA'
ORDER BY
  -- Prioritizes exact matches, then prefix matches, then any match
  CASE
    WHEN LOWER(agency_name) = LOWER(search_term) THEN 1
    WHEN LOWER(agency_name) LIKE 'search_term%' THEN 2
    ELSE 3
  END,
  agency_name
LIMIT {limit}
\`\`\`

**How Parameters Influence Results:**
- search_term: REQUIRED - Searches in agency name, county name, and state name. Case-insensitive. Use partial matches (e.g., 'Los Angeles' will find 'Los Angeles Police Dept')
- state_abbr: Optional - Restrict search to a single state
- limit: Maximum results to return (default 20)

**Returns:** List of matching agencies with ORI codes. Use the ORI code with other functions like compareAgencies, getPeerComparison, etc.

**Example Usage:**
- Find NYPD's ORI code: search_term='New York Police'
- Find all agencies in Los Angeles County: search_term='Los Angeles', state_abbr='CA'
- Find Chicago PD: search_term='Chicago', state_abbr='IL'`,
    tags: ["nibrs", "agencies", "search", "find", "ori"],
    category: "NIBRS - Helper",
    inputSchema: SearchAgenciesInput,
    outputSchema: SearchAgenciesOutput,
  })
  async searchAgencies(input: z.infer<typeof SearchAgenciesInput>) {
    const whereClauses: string[] = [
      `(
        LOWER(agency_name) LIKE '%${input.search_term.toLowerCase()}%'
        OR LOWER(counties) LIKE '%${input.search_term.toLowerCase()}%'
        OR LOWER(state_name) LIKE '%${input.search_term.toLowerCase()}%'
      )`,
    ];

    if (input.state_abbr) {
      whereClauses.push(`state_abbr = '${input.state_abbr}'`);
    }

    const sql = `
      SELECT
        ori,
        agency_name,
        state_abbr,
        state_name,
        counties,
        agency_type_name
      FROM \`${PROJECT_ID}.${DATASET}.agencies\`
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY
        CASE
          WHEN LOWER(agency_name) = LOWER('${input.search_term}') THEN 1
          WHEN LOWER(agency_name) LIKE CONCAT(LOWER('${input.search_term}'), '%') THEN 2
          ELSE 3
        END,
        agency_name
      LIMIT ${input.limit || 20}
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
    };
  }
}
