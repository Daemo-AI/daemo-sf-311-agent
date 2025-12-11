/*
 * SF 311 Flexible Functions - Updated
 * Flattened descriptions to prevent Engine runtime generation errors.
 */

import { DaemoFunction } from "daemo-engine";
import axios from "axios";
import { z } from "zod";
import { configDotenv } from "dotenv";

configDotenv();

const SF_311_APP_TOKEN = process.env.SF_311_APP_TOKEN;
const SF_311_API_BASE =
  "https://data.sfgov.org/api/v3/views/vw6y-z8j6/query.json";

export class SF311Functions {
  private getAuthHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (SF_311_APP_TOKEN) {
      headers["X-App-Token"] = SF_311_APP_TOKEN;
    }
    return headers;
  }

  // --- Helper: Execute raw SoQL ---
  private async runSoql(query: string) {
    console.log(`[SoQL] ${query}`);
    try {
      const response = await axios.post(
        SF_311_API_BASE,
        { query },
        { headers: this.getAuthHeaders(), timeout: 30000 },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[SoQL] Error:",
        error.response?.data?.message || error.message,
      );
      throw new Error(
        `Data fetch failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description:
      "Execute a general search or aggregation using SoQL. Use this for general counts, grouping (e.g. 'Most common complaint'), and finding top records.",
    tags: ["311", "search", "aggregate"],
    category: "SF311",
    inputSchema: z.object({
      select: z
        .string()
        .describe(
          "Columns to select (e.g., 'service_name, count(*) as count')",
        ),
      where: z
        .string()
        .optional()
        .describe(
          "Filter conditions (e.g., \"service_name LIKE '%Trash%' AND supervisor_district = '3'\")",
        ),
      group_by: z
        .string()
        .optional()
        .describe("Group by columns (e.g., 'service_name')"),
      order_by: z
        .string()
        .optional()
        .describe("Order by clause (e.g., 'count DESC')"),
      limit: z.number().default(100),
    }),
    outputSchema: z.object({
      results: z.array(z.any()),
      count: z.number(),
    }),
  })
  async searchOrAggregate(input: {
    select: string;
    where?: string;
    group_by?: string;
    order_by?: string;
    limit: number;
  }) {
    let query = `SELECT ${input.select}`;
    if (input.where) query += ` WHERE ${input.where}`;
    if (input.group_by) query += ` GROUP BY ${input.group_by}`;
    if (input.order_by) query += ` ORDER BY ${input.order_by}`;
    query += ` LIMIT ${input.limit}`;

    const results = await this.runSoql(query);
    return { results, count: results.length };
  }

  @DaemoFunction({
    description:
      "Analyze how long it takes to close cases. Calculates avg, median, min, max duration in days. Use for 'Time to close' or 'Duration' questions.",
    tags: ["311", "analytics", "time"],
    category: "SF311",
    inputSchema: z.object({
      service_name_filter: z
        .string()
        .optional()
        .describe(
          "Filter by partial service name (e.g. 'Encampment', 'Trash')",
        ),
      neighborhood: z.string().optional().describe("Filter by neighborhood"),
      days_ago: z.number().default(180).describe("Look back window in days"),
    }),
    outputSchema: z.object({
      total_closed_analyzed: z.number(),
      avg_days_to_close: z.number(),
      median_days_to_close: z.number(),
      max_days_to_close: z.number(),
      min_days_to_close: z.number(),
    }),
  })
  async analyzeCycleTimes(input: {
    service_name_filter?: string;
    neighborhood?: string;
    days_ago: number;
  }) {
    // 1. Calculate date threshold
    const date = new Date();
    date.setDate(date.getDate() - input.days_ago);
    const dateStr = date.toISOString().split(".")[0];

    // 2. Build Query
    let where = `status_description = 'Closed' AND requested_datetime > '${dateStr}' AND closed_date IS NOT NULL`;
    if (input.service_name_filter)
      where += ` AND service_name LIKE '%${input.service_name_filter}%'`;
    if (input.neighborhood)
      where += ` AND neighborhoods_sffind_boundaries = '${input.neighborhood}'`;

    const query = `SELECT requested_datetime, closed_date WHERE ${where} LIMIT 2000`;

    const rows = await this.runSoql(query);

    if (rows.length === 0) {
      return {
        total_closed_analyzed: 0,
        avg_days_to_close: 0,
        median_days_to_close: 0,
        max_days_to_close: 0,
        min_days_to_close: 0,
      };
    }

    // 3. Calculate Diffs in Node.js
    const durations = rows
      .map((r: any) => {
        const start = new Date(r.requested_datetime).getTime();
        const end = new Date(r.closed_date).getTime();
        return (end - start) / (1000 * 60 * 60 * 24); // Convert ms to Days
      })
      .sort((a: number, b: number) => a - b);

    const sum = durations.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / durations.length;
    const mid = Math.floor(durations.length / 2);
    const median =
      durations.length % 2 !== 0
        ? durations[mid]
        : (durations[mid - 1] + durations[mid]) / 2;

    return {
      total_closed_analyzed: rows.length,
      avg_days_to_close: Number(avg.toFixed(2)),
      median_days_to_close: Number(median.toFixed(2)),
      max_days_to_close: Number(durations[durations.length - 1].toFixed(2)),
      min_days_to_close: Number(durations[0].toFixed(2)),
    };
  }

  @DaemoFunction({
    description:
      "Identify 'Zombie' cases: Requests that were closed and then immediately resubmitted/reopened at the same location. Use for 'resubmitted' or 'reopened' questions.",
    tags: ["311", "analytics", "resubmissions"],
    category: "SF311",
    inputSchema: z.object({
      service_name_filter: z
        .string()
        .optional()
        .describe("Filter by service type (e.g. 'Encampment')"),
      district: z
        .string()
        .optional()
        .describe("Supervisor district number (e.g. '6')"),
      days_to_analyze: z.number().default(90).describe("Time window to scan"),
    }),
    outputSchema: z.object({
      total_cases_scanned: z.number(),
      potential_resubmissions: z.number(),
      resubmission_rate_percent: z.number(),
      examples: z.array(z.any()),
    }),
  })
  async analyzeResubmissions(input: {
    service_name_filter?: string;
    district?: string;
    days_to_analyze: number;
  }) {
    const date = new Date();
    date.setDate(date.getDate() - input.days_to_analyze);
    const dateStr = date.toISOString().split(".")[0];

    // Fetch data sorted by address and time to easily spot sequential duplicates
    let where = `requested_datetime > '${dateStr}'`;
    if (input.service_name_filter)
      where += ` AND service_name LIKE '%${input.service_name_filter}%'`;
    if (input.district)
      where += ` AND supervisor_district = '${input.district}'`;

    // We need columns to identify "same issue": address, service_subtype
    // We need time: requested_datetime, closed_date
    const query = `SELECT service_request_id, service_name, service_subtype, address, requested_datetime, closed_date, status_description 
                   WHERE ${where} 
                   ORDER BY address, service_subtype, requested_datetime ASC 
                   LIMIT 5000`;

    const rows = await this.runSoql(query);

    let resubmissions = 0;
    const examples: any[] = [];
    const REOPEN_WINDOW_DAYS = 7;

    // Iterate to find patterns: [Case A Closed] -> [Case B Opened shortly after at same place]
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];

      // Must be same address and same specific issue type
      if (
        prev.address === curr.address &&
        prev.service_subtype === curr.service_subtype
      ) {
        // Prev case must be closed
        if (prev.closed_date) {
          const prevClosed = new Date(prev.closed_date).getTime();
          const currOpened = new Date(curr.requested_datetime).getTime();

          // Check if current was opened AFTER prev was closed, but within window
          const diffDays = (currOpened - prevClosed) / (1000 * 60 * 60 * 24);

          if (diffDays >= 0 && diffDays <= REOPEN_WINDOW_DAYS) {
            resubmissions++;
            if (examples.length < 5) {
              examples.push({
                original_case: prev.service_request_id,
                closed_at: prev.closed_date,
                resubmitted_case: curr.service_request_id,
                opened_at: curr.requested_datetime,
                address: curr.address,
                issue: curr.service_subtype,
              });
            }
          }
        }
      }
    }

    return {
      total_cases_scanned: rows.length,
      potential_resubmissions: resubmissions,
      resubmission_rate_percent:
        rows.length > 0
          ? Number(((resubmissions / rows.length) * 100).toFixed(2))
          : 0,
      examples,
    };
  }

  @DaemoFunction({
    description:
      "Specialized search for intersection-related queries. Use this for 'requests at an intersection' questions.",
    tags: ["311", "search", "intersection"],
    category: "SF311",
    inputSchema: z.object({
      service_query: z.string().describe("Like 'Trash' or 'Can'"),
      days_ago: z.number().default(180),
    }),
    outputSchema: z.object({
      count: z.number(),
      results: z.array(z.any()),
    }),
  })
  async findIntersections(input: { service_query: string; days_ago: number }) {
    const date = new Date();
    date.setDate(date.getDate() - input.days_ago);
    const dateStr = date.toISOString().split(".")[0];

    // Intersections in SF data are often denoted by " / " or specific intersection types
    // We filter address for slash
    const query = `SELECT count(*) as count, address, service_name 
                   WHERE service_name LIKE '%${input.service_query}%' 
                   AND address LIKE '% / %' 
                   AND requested_datetime > '${dateStr}'
                   GROUP BY address, service_name
                   ORDER BY count DESC
                   LIMIT 50`;

    const results = await this.runSoql(query);
    const total = results.reduce(
      (acc: number, r: any) => acc + parseInt(r.count),
      0,
    );

    return {
      count: total,
      results,
    };
  }
}
