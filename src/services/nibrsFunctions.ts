// src/services/nibrsFunctions.ts
// NIBRS Crime Data Functions using Google BigQuery

import { DaemoFunction } from "daemo-engine";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  ExecuteCustomQueryInput,
  CustomQueryOutput,
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
}
