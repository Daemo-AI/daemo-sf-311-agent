// src/services/nibrsFunctions.ts
// NIBRS Crime Data Functions using Google BigQuery

import { DaemoFunction } from "daemo-engine";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  ExecuteCustomQueryInput,
  CustomQueryOutput,
  SearchAgenciesInput,
  AgencyListOutput,
  GetIncidentCountsInput,
  CountResultOutput,
  GetCrimeTrendsInput,
  TrendOutput,
  GetOffenseSummaryInput,
  GetCrimeRatesByPopulationInput,
  CrimeRateOutput,
} from "./nibrs.schemas";

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
      console.log("[BigQuery] Initialized with service account credentials from file");
    } else if (serviceAccountJson) {
      // Use JSON content directly
      try {
        const credentials = JSON.parse(serviceAccountJson);
        this.bigquery = new BigQuery({
          projectId: PROJECT_ID,
          credentials,
        });
        console.log("[BigQuery] Initialized with service account credentials from JSON");
      } catch (error) {
        console.error("[BigQuery] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", error);
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
    description:
      "Execute a custom SQL query against the NIBRS BigQuery database. Use this to answer ANY question about crime data by writing SQL queries. Available tables: agencies, administrative_segment, offense_segment, victim_segment, arrestee_segment, law_enforcement_employees. MUST be a SELECT query only. Table names will be automatically qualified with the dataset name.",
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
  // AGENCY SEARCH
  // =========================================================================

  @DaemoFunction({
    description:
      "Search for law enforcement agencies by state, name, type, or county. Returns agency details including ORI, location, and NIBRS participation status. Use this to find specific agencies before querying crime data.",
    tags: ["nibrs", "agencies", "search", "reference"],
    category: "NIBRS",
    inputSchema: SearchAgenciesInput,
    outputSchema: AgencyListOutput,
  })
  async searchAgencies(input: z.infer<typeof SearchAgenciesInput>) {
    let sql = `
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
      WHERE 1=1
    `;

    const conditions: string[] = [];
    if (input.stateAbbr) {
      conditions.push(`state_abbr = '${input.stateAbbr}'`);
    }
    if (input.county) {
      conditions.push(
        `LOWER(counties) LIKE '%${input.county.toLowerCase()}%'`,
      );
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
      conditions.push(`is_nibrs = true`);
    }

    if (conditions.length > 0) {
      sql += ` AND ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY agency_name LIMIT ${input.limit || 10000}`;

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
      "Count incidents by various groupings (state, year, agency, offense). Use this to get aggregate statistics like total incidents by state, yearly trends, or agency-level counts. Supports filtering by state, agency, year range, and offense type.",
    tags: ["nibrs", "incidents", "counts", "statistics", "aggregate"],
    category: "NIBRS",
    inputSchema: GetIncidentCountsInput,
    outputSchema: CountResultOutput,
  })
  async getIncidentCounts(input: z.infer<typeof GetIncidentCountsInput>) {
    const fromYear = input.fromYear || 2024;
    const toYear = input.toYear || 2024;

    let selectFields: string;
    let groupByFields: string;

    switch (input.groupBy) {
      case "state":
        selectFields = "ag.state_abbr, ag.state_name";
        groupByFields = "ag.state_abbr, ag.state_name";
        break;
      case "year":
        selectFields = "o.data_year";
        groupByFields = "o.data_year";
        break;
      case "agency":
        selectFields = "ag.ori, ag.agency_name, ag.state_abbr";
        groupByFields = "ag.ori, ag.agency_name, ag.state_abbr";
        break;
      case "offense":
        selectFields = "o.ucr_offense_code";
        groupByFields = "o.ucr_offense_code";
        break;
      case "state_year":
        selectFields = "ag.state_abbr, o.data_year";
        groupByFields = "ag.state_abbr, o.data_year";
        break;
      case "offense_year":
        selectFields = "o.ucr_offense_code, o.data_year";
        groupByFields = "o.ucr_offense_code, o.data_year";
        break;
      case "agency_year":
        selectFields = "ag.ori, ag.agency_name, o.data_year";
        groupByFields = "ag.ori, ag.agency_name, o.data_year";
        break;
      default:
        selectFields = "o.data_year";
        groupByFields = "o.data_year";
    }

    let sql = `
      SELECT
        ${selectFields},
        COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE o.data_year BETWEEN ${fromYear} AND ${toYear}
    `;

    if (input.stateAbbr) {
      sql += ` AND ag.state_abbr = '${input.stateAbbr}'`;
    }
    if (input.ori) {
      sql += ` AND o.ori = '${input.ori}'`;
    }
    if (input.offenseCode) {
      sql += ` AND o.ucr_offense_code = '${input.offenseCode}'`;
    }

    sql += `
      GROUP BY ${groupByFields}
      ORDER BY incident_count DESC
      LIMIT ${input.limit || 10000}
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}, Years: ${fromYear}-${toYear}`,
    };
  }

  // =========================================================================
  // CRIME TRENDS (TIME SERIES)
  // =========================================================================

  @DaemoFunction({
    description:
      "Analyze crime trends over time with year or month granularity. Returns time series data showing incident counts for the specified period. Useful for identifying patterns, seasonal variations, or long-term trends.",
    tags: ["nibrs", "trends", "time-series", "analysis", "patterns"],
    category: "NIBRS",
    inputSchema: GetCrimeTrendsInput,
    outputSchema: TrendOutput,
  })
  async getCrimeTrends(input: z.infer<typeof GetCrimeTrendsInput>) {
    let selectFields: string;
    let groupByFields: string;
    let periodFormat: string;

    if (input.granularity === "month") {
      selectFields =
        "CONCAT(o.data_year, '-', LPAD(CAST(EXTRACT(MONTH FROM o.incident_date) AS STRING), 2, '0')) as period";
      groupByFields = "period";
      periodFormat = "YYYY-MM";
    } else {
      selectFields = "CAST(o.data_year AS STRING) as period";
      groupByFields = "o.data_year";
      periodFormat = "YYYY";
    }

    let sql = `
      SELECT
        ${selectFields},
        COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as count
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE o.data_year BETWEEN ${input.fromYear} AND ${input.toYear}
    `;

    if (input.stateAbbr) {
      sql += ` AND ag.state_abbr = '${input.stateAbbr}'`;
    }
    if (input.ori) {
      sql += ` AND o.ori = '${input.ori}'`;
    }
    if (input.offenseCode) {
      sql += ` AND o.ucr_offense_code = '${input.offenseCode}'`;
    }

    sql += `
      GROUP BY ${groupByFields}
      ORDER BY period
    `;

    const rows = await this.runQuery(sql);

    const data = rows.map((row) => ({
      period: row.period,
      count: row.count,
      rate: null,
    }));

    const totalCount = data.reduce((sum, d) => sum + d.count, 0);

    return {
      title: `Crime Trends ${input.fromYear}-${input.toYear}${input.offenseCode ? ` (${input.offenseCode})` : ""}`,
      data,
      total_count: totalCount,
    };
  }

  // =========================================================================
  // OFFENSE SUMMARY
  // =========================================================================

  @DaemoFunction({
    description:
      "Summarize offenses by type, location, weapon, bias motivation, or year. Returns aggregate counts grouped by the specified dimension. Use this to analyze offense patterns, identify common crime types, or understand how offenses vary by location or weapon usage.",
    tags: ["nibrs", "offenses", "summary", "analysis", "patterns"],
    category: "NIBRS",
    inputSchema: GetOffenseSummaryInput,
    outputSchema: CountResultOutput,
  })
  async getOffenseSummary(input: z.infer<typeof GetOffenseSummaryInput>) {
    const fromYear = input.fromYear || 2024;
    const toYear = input.toYear || 2024;

    let selectFields: string;
    let groupByFields: string;

    switch (input.groupBy) {
      case "offense":
        selectFields = "o.ucr_offense_code";
        groupByFields = "o.ucr_offense_code";
        break;
      case "location":
        selectFields = "o.location_type";
        groupByFields = "o.location_type";
        break;
      case "weapon":
        selectFields = "o.type_weapon_force_involved1 as weapon_type";
        groupByFields = "o.type_weapon_force_involved1";
        break;
      case "bias":
        selectFields = "o.bias_motivation";
        groupByFields = "o.bias_motivation";
        break;
      case "offense_year":
        selectFields = "o.ucr_offense_code, o.data_year";
        groupByFields = "o.ucr_offense_code, o.data_year";
        break;
      default:
        selectFields = "o.ucr_offense_code";
        groupByFields = "o.ucr_offense_code";
    }

    let sql = `
      SELECT
        ${selectFields},
        COUNT(*) as offense_count
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE o.data_year BETWEEN ${fromYear} AND ${toYear}
    `;

    if (input.stateAbbr) {
      sql += ` AND ag.state_abbr = '${input.stateAbbr}'`;
    }
    if (input.ori) {
      sql += ` AND o.ori = '${input.ori}'`;
    }
    if (input.offenseCode) {
      sql += ` AND o.ucr_offense_code = '${input.offenseCode}'`;
    }
    if (input.locationType) {
      sql += ` AND o.location_type = '${input.locationType}'`;
    }
    if (input.biasMotivation) {
      sql += ` AND o.bias_motivation = '${input.biasMotivation}'`;
    }

    sql += `
      GROUP BY ${groupByFields}
      ORDER BY offense_count DESC
      LIMIT ${input.limit || 10000}
    `;

    const rows = await this.runQuery(sql);

    return {
      results: rows,
      total_rows: rows.length,
      query_info: `Grouped by: ${input.groupBy}, Years: ${fromYear}-${toYear}`,
    };
  }

  // =========================================================================
  // CRIME RATES BY POPULATION
  // =========================================================================

  @DaemoFunction({
    description:
      "Calculate per-capita crime rates using population data from law_enforcement_employees table. Returns crime rates per 100,000 population grouped by population category, state, offense, or year. CRITICAL: Automatically uses year 2024 or earlier (LEE data only available through 2024). Use this to compare crime rates across jurisdictions fairly.",
    tags: [
      "nibrs",
      "crime-rates",
      "per-capita",
      "population",
      "analysis",
      "statistics",
    ],
    category: "NIBRS",
    inputSchema: GetCrimeRatesByPopulationInput,
    outputSchema: CrimeRateOutput,
  })
  async getCrimeRatesByPopulation(
    input: z.infer<typeof GetCrimeRatesByPopulationInput>,
  ) {
    // CRITICAL: Ensure we use 2024 or earlier for LEE data
    const fromYear = Math.min(input.fromYear || 2024, 2024);
    const toYear = Math.min(input.toYear || 2024, 2024);

    let selectFields: string;
    let groupByFields: string;
    let populationCategoryCase = `
      CASE
        WHEN le.population >= 500000 THEN 'very_large'
        WHEN le.population >= 250000 THEN 'large'
        WHEN le.population >= 100000 THEN 'medium'
        WHEN le.population >= 50000 THEN 'small'
        WHEN le.population >= 10000 THEN 'very_small'
        ELSE 'tiny'
      END as population_category
    `;

    switch (input.groupBy) {
      case "population_category":
        selectFields = populationCategoryCase;
        groupByFields = "population_category";
        break;
      case "state":
        selectFields = "ag.state_abbr, ag.state_name";
        groupByFields = "ag.state_abbr, ag.state_name";
        break;
      case "offense":
        selectFields = "o.ucr_offense_code";
        groupByFields = "o.ucr_offense_code";
        break;
      case "year":
        selectFields = "o.data_year";
        groupByFields = "o.data_year";
        break;
      default:
        selectFields = populationCategoryCase;
        groupByFields = "population_category";
    }

    let sql = `
      SELECT
        ${selectFields},
        COUNT(*) as offense_count,
        SUM(le.population) as total_population,
        ROUND((COUNT(*) * 100000.0) / SUM(le.population), 2) as rate_per_100k
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON o.ori = le.ori AND o.data_year = le.data_year
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
      WHERE o.data_year BETWEEN ${fromYear} AND ${toYear}
        AND le.population IS NOT NULL
        AND le.population > 0
    `;

    if (input.stateAbbr) {
      sql += ` AND ag.state_abbr = '${input.stateAbbr}'`;
    }
    if (input.offenseCode) {
      sql += ` AND o.ucr_offense_code = '${input.offenseCode}'`;
    }

    // Filter by population category if specified (not "all")
    if (input.populationCategory && input.populationCategory !== "all") {
      switch (input.populationCategory) {
        case "very_large":
          sql += ` AND le.population >= 500000`;
          break;
        case "large":
          sql += ` AND le.population >= 250000 AND le.population < 500000`;
          break;
        case "medium":
          sql += ` AND le.population >= 100000 AND le.population < 250000`;
          break;
        case "small":
          sql += ` AND le.population >= 50000 AND le.population < 100000`;
          break;
        case "very_small":
          sql += ` AND le.population >= 10000 AND le.population < 50000`;
          break;
        case "tiny":
          sql += ` AND le.population < 10000`;
          break;
      }
    }

    sql += `
      GROUP BY ${groupByFields}
      ORDER BY rate_per_100k DESC
      LIMIT ${input.limit || 10000}
    `;

    const rows = await this.runQuery(sql);

    // Extract unique population categories
    const categories = [
      ...new Set(rows.map((r) => r.population_category).filter(Boolean)),
    ];

    return {
      results: rows,
      total_rows: rows.length,
      metadata: {
        includes_per_capita_rates: true,
        population_categories_included: categories,
      },
    };
  }
}
