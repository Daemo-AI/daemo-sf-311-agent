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
    description: `Count total offenses or incidents with filtering and grouping.

Use this to get raw counts (not rates) of crimes. Returns offense_count (total offenses) and incident_count (unique incidents).

Key use cases:
- "How many [crime type] occurred in [location]?"
- "Count crimes by state/agency/year"
- "What are the most common crimes in [location]?"

Important parameters:
- group_by: Controls aggregation level (['state_abbr'], ['ucr_offense_code'], ['agency_name'], etc.). Results are grouped by these fields.
- offense_codes: Filter to specific crime types (e.g., ['09A'] for murder, ['120'] for robbery). Omit to get all crimes.
- state_abbr: Limit to one state (e.g., 'CT', 'CA')
- ori: Limit to one agency

DO NOT use this for:
- Per-capita rates (use getOffenseRates instead)
- Ranking/sorting agencies by crime (use rankAgenciesByCrime instead)`,
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

Use this for fair comparisons between places of different sizes. Returns rate_per_100k, offense_count, and total_population.

Key use cases:
- "Which [states/cities] have the highest [crime type] rate?"
- "Compare crime rates between [location A] and [location B]"
- "Rank locations by crime rate"

Important parameters:
- group_by: REQUIRED. Set to 'state' for state-level rates, 'agency' for city-level rates, or 'region' for regional rates.
- min_population: Filter to cities with population >= this value (e.g., 100000). Use this to compare only similar-sized cities.
- offense_codes: Calculate rates for specific crimes (e.g., ['09A'] for murder). Omit for total crime rate.
- state_abbr: Limit to one state

DO NOT use this for:
- Raw counts without population adjustment (use getOffenseCounts instead)
- Ranking agencies (use rankAgenciesByCrime instead which is optimized for ranking)`,
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
    description: `Get detailed information about individual incidents (not aggregated statistics).

Returns incident-level details: incident_number, date, time, victim/offender/arrestee counts, and clearance status.

Key use cases:
- "Show me specific incidents with [criteria]"
- "Find mass casualty events" (use min_victims parameter)
- "Get details about complex crimes" (use min_offenses parameter)

Important parameters:
- min_victims: Find incidents with >= N victims (e.g., 4 for mass casualty events)
- min_offenses: Find complex incidents with >= N offense types
- offense_codes: Only incidents containing at least one of these crime types
- state_abbr/ori: Geographic filtering

DO NOT use this for:
- Counting or aggregating crimes (use getOffenseCounts instead)
- Getting statistics about crime trends (use other aggregation functions)
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
    description: `Calculate clearance/arrest rates (% of incidents resulting in arrests).

Returns clearance_rate_pct, total_incidents, and incidents_with_arrests. Higher clearance rates = better law enforcement effectiveness.

Key use cases:
- "What percentage of [crime type] cases result in arrests?"
- "Compare clearance rates between states/agencies"
- "How effective is [agency] at solving crimes?"

Important parameters:
- group_by: REQUIRED. Use 'state' for state-level rates, 'agency' for agency-level, or 'offense_code' for crime type breakdown
- offense_codes: Calculate rates for specific crime types (e.g., ['09A'] for murder clearance)
- state_abbr/ori: Geographic filtering`,
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
    description: `Get list of agencies with population and metadata (not crime statistics).

Returns agency details: ori, agency_name, state, population, officer counts, agency type. Does NOT return crime statistics.

Key use cases:
- "List all agencies in [state]"
- "Find agencies with population between X and Y"
- "What agencies are in [location]?"

Important parameters:
- state_abbr: Filter to one state
- min_population/max_population: Filter by population range
- agency_type: Filter by type ('City', 'County', 'State Police', etc.)

DO NOT use this for crime statistics - use other functions like getOffenseCounts or rankAgenciesByCrime instead.`,
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
    description: `Analyze crime patterns by hour of day.

Returns 24 rows (hours 0-23) with offense_count and pct_of_total for each hour.

Key use cases:
- "What time of day do [crime type] occur?"
- "When are crimes most common?"
- "Peak hours for [crime]"

Important parameters:
- offense_codes: Analyze specific crime types (e.g., ['220'] for burglary). Omit for all crimes.
- state_abbr: Limit to one state`,
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
    description: `Analyze crime patterns by day of week.

Returns 7 rows (one per day: Sunday-Saturday) with day_of_week (1-7), day_name, and offense_count.

Key use cases:
- "Are crimes more common on weekends?"
- "Which day has the most [crime type]?"
- "Weekday vs weekend crime patterns"

Important parameters:
- offense_codes: Analyze specific crime types. Omit for all crimes.
- state_abbr: Limit to one state`,
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
    description: `Analyze crime patterns by month to identify seasonal trends.

Returns 12 rows (one per month: January-December) with month_num (1-12), month_name, and offense_count.

Key use cases:
- "Are crimes more common in summer or winter?"
- "Which months have the most [crime type]?"
- "Seasonal crime patterns"

Important parameters:
- offense_codes: Analyze specific crime types. Omit for all crimes.
- state_abbr: Limit to one state`,
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
    description: `Analyze year-over-year crime trends (is crime going up or down?).

Returns one row per year with: offense_count, yoy_change (absolute change from previous year), yoy_pct_change (percent change), and optionally rate_per_100k if include_rates=true.

Key use cases:
- "Is crime increasing or decreasing in [location]?"
- "Show me crime trends from [year] to [year]"
- "Has [crime type] gone up over time?"

Important parameters:
- start_year/end_year: Define time range (default 2020-2024)
- include_rates: Set to true to get per-capita rates (recommended when population changes over time)
- offense_codes: Track trends for specific crime types
- state_abbr/ori: Geographic filtering`,
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
    description: `Analyze victim demographics (sex, race, age, ethnicity).

Returns victim_count and pct_of_total grouped by demographic field(s). Only includes individual victims (not businesses).

Key use cases:
- "What are the demographics of [crime type] victims?"
- "Which age groups are most victimized?"
- "Victim demographics by race/sex/age"

Important parameters:
- group_by: REQUIRED. Choose demographic field(s): ['sex_of_victim'], ['race_of_victim'], ['age_of_victim'], ['ethnicity'], or multiple for crosstab
- offense_codes: Analyze victims of specific crime types
- state_abbr: Limit to one state`,
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

Returns arrestee_count and pct_of_total grouped by demographic field(s).

Key use cases:
- "What are the demographics of people arrested for [crime]?"
- "Which age groups are most arrested?"
- "Arrestee demographics by race/sex/age"

Important parameters:
- group_by: REQUIRED. Choose demographic field(s): ['sex_of_arrestee'], ['race_of_arrestee'], ['age_of_arrestee'], ['ethnicity'], or multiple for crosstab
- juvenile_only: Set to true to analyze only arrestees under 18
- offense_codes: Analyze arrestees for specific crime types
- state_abbr: Limit to one state`,
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
    description: `Analyze victim-offender relationships (stranger, acquaintance, family, etc.).

Returns relationship types with count and pct_of_total. Common values: SE (Stranger), AQ (Acquaintance), SP (Spouse), BG (Boyfriend/Girlfriend), OF (Other Family).

Key use cases:
- "Are [crime type] typically committed by strangers or known persons?"
- "Domestic violence relationship patterns"
- "Who commits [crime]?"

Important parameters:
- offense_codes: Analyze relationships for specific crime types
- state_abbr: Limit to one state`,
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
    description: `Analyze injury types sustained by victims in violent crimes.

Returns injury_type and count. Common values: N (None), M (Major - broken bones, internal injuries), S (Severe - loss of consciousness), L (Minor - bruises, scratches).

Key use cases:
- "How severe are injuries in [crime type]?"
- "Injury patterns for [offense]"

Important parameters:
- offense_codes: Analyze injuries for specific crime types (e.g., ['13A'] for aggravated assault)
- state_abbr: Limit to one state`,
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
    description: `Analyze weapon/force types used in crimes.

Returns weapon_type, offense_count, and pct_of_total. Common values: 11-15 (Firearms), 20 (Knife), 40 (Personal Weapons - hands/fists), 90 (Other).

Key use cases:
- "What weapons are used in [crime type]?"
- "How often are firearms involved in [offense]?"
- "Weapon usage patterns"

Important parameters:
- offense_codes: Analyze weapons for specific crime types
- state_abbr: Limit to one state`,
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

Returns location_type, offense_count, and pct_of_total. Common values: 14 (Residence/Home), 20 (Commercial/Office), 13 (Highway/Road), 25 (Parking Lot).

Key use cases:
- "Where do [crime type] occur?"
- "What locations are most dangerous?"
- "Crime location patterns"

Important parameters:
- offense_codes: Analyze locations for specific crime types
- state_abbr: Limit to one state`,
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
    description: `Rank/sort agencies (cities) by crime statistics. Returns a sorted list of agencies with their crime metrics.

**THIS IS THE FUNCTION TO USE for queries like:**
- "Which cities in [state] have the most crime?"
- "Sort agencies by [crime type] in [state]"
- "Rank cities by incident count in [location]"
- "Show me the top 10 agencies for [crime]"

Returns: agency_name, state_abbr, population, offense_count, rate_per_100k (sorted by your chosen metric)

Important parameters:
- metric: Use 'total_count' to rank by absolute crime count, or 'rate_per_100k' for per-capita rate
- state_abbr: REQUIRED to rank within a state (e.g., 'CT', 'CA')
- offense_codes: Rank by specific crime types (e.g., ['120'] for robbery). Omit for total crime.
- min_population: Filter to cities with population >= this value
- limit: Number of top agencies to return (default 20)

Example: To rank CT agencies by incident count, use: {state_abbr: 'CT', metric: 'total_count'}`,
    tags: ["nibrs", "ranking", "comparison", "top", "sort"],
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
    description: `Compare specific agencies side-by-side across crime categories.

Returns one row per agency with: total_offenses, rate_per_100k, and breakdowns for homicides, robberies, assaults, burglaries, vehicle_thefts.

Key use cases:
- "Compare crime statistics between [city A] and [city B]"
- "Side-by-side comparison of [agencies]"

Important parameters:
- ori_list: REQUIRED. List of agency ORI codes to compare. Use searchAgencies first to find ORI codes.

Note: Use searchAgencies function first to find ORI codes for cities you want to compare.`,
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
    description: `Compare an agency to similar-sized peer agencies (benchmark against peers).

Finds agencies with similar population (±20% by default) and returns crime rates for target and all peers. Each agency marked as 'TARGET' or 'PEER'.

Key use cases:
- "How does [city] compare to similar-sized cities?"
- "Benchmark [city] against peer agencies"
- "Is [city] safer than similar cities?"

Important parameters:
- ori: REQUIRED. Target agency ORI code. Use searchAgencies to find it.
- population_range_pct: Defines peer group (default 20 = ±20% population). Smaller = more similar peers.

Note: Use searchAgencies function first to find the ORI code for the city you want to analyze.`,
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
    description: `Analyze hate crimes by bias motivation type.

Returns bias_motivation code, offense_count, and pct_of_total. Common bias types: 11-15 (racial), 21-29 (religious), 41-45 (sexual orientation/gender identity). Excludes non-hate crimes by default.

Key use cases:
- "What types of hate crimes are most common?"
- "Hate crime statistics by bias type"
- "Racial vs religious hate crimes"

Important parameters:
- exclude_no_bias: Default true (only hate crimes). Set to false to include all crimes.
- state_abbr: Limit to one state`,
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

Returns arrest_count, incidents_with_arrests, and pct_of_total grouped by specified fields.

Key use cases:
- "What crimes have the most arrests?"
- "Arrest statistics by [crime type/location]"
- "How many arrests for [offense]?"

Important parameters:
- group_by: Fields to group by (e.g., ['ucr_arrest_offense_code'] for crime type breakdown, ['type_of_arrest'] for arrest type)
- arrest_type: Filter to specific type: 'O' (On-View), 'S' (Summoned/Cited), 'T' (Taken into Custody)
- offense_codes: Filter to arrests for specific crime types
- state_abbr: Limit to one state`,
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
    description: `Search for agencies by name to find their ORI codes.

**USE THIS FIRST** when you need to find an agency's ORI code for other functions (compareAgencies, getPeerComparison, etc.).

Returns: ori (agency code), agency_name, state_abbr, counties, agency_type_name

Key use cases:
- "Find the ORI code for [city] police department"
- "What's the agency code for [city]?"
- "Search for agencies in [location]"

Important parameters:
- search_term: REQUIRED. City or agency name to search (e.g., 'Los Angeles', 'Chicago Police'). Case-insensitive, partial matches work.
- state_abbr: Limit search to one state
- limit: Max results (default 20)

Example: To compare Los Angeles and New York, first use searchAgencies with search_term='Los Angeles' to get ORI, then search_term='New York' to get ORI, then use compareAgencies with both ORI codes.`,
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
