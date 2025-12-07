import { DaemoFunction } from "daemo-engine";
import axios from "axios";
import { z } from "zod";
import { configDotenv } from "dotenv";

// Load environment variables
configDotenv();

const SF_311_APP_TOKEN = process.env.SF_311_APP_TOKEN;

const SF_311_API_BASE =
  "https://data.sfgov.org/api/v3/views/vw6y-z8j6/query.json";

// Helper to format dates for SoQL
function formatDateForSoQL(date: Date): string {
  return date.toISOString().split(".")[0]; // Format: 2025-11-07T00:00:00
}

// Helper to calculate date X days ago
function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Schemas
const SearchCasesInputSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Case status (e.g., 'Open', 'Closed')"),
  neighborhood: z
    .string()
    .optional()
    .describe("Neighborhood name (e.g., 'Mission')"),
  service_name: z
    .string()
    .optional()
    .describe(
      "Service category (e.g., 'Graffiti', 'Street and Sidewalk Cleaning')",
    ),
  days_old_min: z
    .number()
    .optional()
    .describe("Minimum age in days (cases older than this)"),
  days_old_max: z
    .number()
    .optional()
    .describe("Maximum age in days (cases newer than this)"),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe("Maximum number of results (default 100, max 1000)"),
});

const CaseOutputSchema = z.object({
  service_request_id: z.string(),
  requested_datetime: z.string(),
  closed_date: z.string().optional(),
  status_description: z.string(),
  service_name: z.string(),
  address: z.string().optional(),
  neighborhoods_sffind_boundaries: z.string().optional(),
  days_open: z.number().optional(),
});

const SearchCasesOutputSchema = z.array(CaseOutputSchema);

const GetCaseByIdInputSchema = z.object({
  case_id: z.string().describe("The SF 311 case ID"),
});

const GetCaseStatsInputSchema = z.object({
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  service_name: z.string().optional().describe("Filter by service category"),
  days: z
    .number()
    .optional()
    .default(30)
    .describe("Time period in days to analyze"),
});

const CaseStatsOutputSchema = z.object({
  total_cases: z.number(),
  open_cases: z.number(),
  closed_cases: z.number(),
  avg_days_to_close: z.number().optional(),
  top_services: z.array(
    z.object({
      service: z.string(),
      count: z.number(),
    }),
  ),
});

export class SF311Functions {
  // Helper to add auth headers/params
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add app token if available
    if (SF_311_APP_TOKEN) {
      headers["X-App-Token"] = SF_311_APP_TOKEN;
    }

    console.log(`SF_311_APP_TOKEN: ${SF_311_APP_TOKEN}`);

    return headers;
  }

  @DaemoFunction({
    description:
      "Search SF 311 cases with flexible filtering. Can filter by status, neighborhood, service type, and age of cases. Useful for finding open cases, cases in specific neighborhoods, or cases older/newer than a certain number of days.",
    tags: ["311", "search", "cases"],
    category: "SF311",
    inputSchema: SearchCasesInputSchema,
    outputSchema: SearchCasesOutputSchema,
  })
  async searchCases(
    input: z.infer<typeof SearchCasesInputSchema>,
  ): Promise<z.infer<typeof SearchCasesOutputSchema>> {
    const {
      status,
      neighborhood,
      service_name,
      days_old_min,
      days_old_max,
      limit = 100,
    } = input;

    // Build WHERE clause
    const conditions: string[] = [];

    if (status) {
      conditions.push(`\`status_description\` = '${status}'`);
    }

    if (neighborhood) {
      conditions.push(
        `\`neighborhoods_sffind_boundaries\` = '${neighborhood}'`,
      );
    }

    if (service_name) {
      conditions.push(`\`service_name\` LIKE '%${service_name}%'`);
    }

    // Date filtering - cases older than X days
    if (days_old_min !== undefined) {
      const maxDate = formatDateForSoQL(getDaysAgo(days_old_min));
      conditions.push(`\`requested_datetime\` < '${maxDate}'`);
    }

    // Date filtering - cases newer than X days
    if (days_old_max !== undefined) {
      const minDate = formatDateForSoQL(getDaysAgo(days_old_max));
      conditions.push(`\`requested_datetime\` > '${minDate}'`);
    }

    const whereClause =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    // Build SoQL query
    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`status_description\`, \`service_name\`, \`address\`, \`neighborhoods_sffind_boundaries\`${whereClause} ORDER BY \`requested_datetime\` DESC LIMIT ${Math.min(limit, 1000)}`;

    console.log("SF 311 Query:", query);

    try {
      const response = await axios.post(
        SF_311_API_BASE,
        {
          query,
          page: {
            pageNumber: 1,
            pageSize: Math.min(limit, 1000),
          },
          includeSynthetic: false,
        },
        {
          headers: this.getAuthHeaders(), // Use auth headers
        },
      );

      const now = new Date();
      const cases = response.data.map((c: any) => {
        const requestedDate = new Date(c.requested_datetime);
        const daysOpen = Math.floor(
          (now.getTime() - requestedDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          service_request_id: c.service_request_id,
          requested_datetime: c.requested_datetime,
          closed_date: c.closed_date,
          status_description: c.status_description,
          service_name: c.service_name,
          address: c.address,
          neighborhoods_sffind_boundaries: c.neighborhoods_sffind_boundaries,
          days_open: daysOpen,
        };
      });

      console.log(`SF 311: Found ${cases.length} cases`);
      return cases;
    } catch (error: any) {
      console.error(
        "Error fetching 311 data:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to fetch 311 data: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description: "Get a specific SF 311 case by its case ID.",
    tags: ["311", "case", "lookup"],
    category: "SF311",
    inputSchema: GetCaseByIdInputSchema,
    outputSchema: CaseOutputSchema,
  })
  async getCaseById(
    input: z.infer<typeof GetCaseByIdInputSchema>,
  ): Promise<z.infer<typeof CaseOutputSchema>> {
    const { case_id } = input;

    const query = `SELECT * WHERE \`service_request_id\` = '${case_id}'`;

    try {
      const response = await axios.post(
        SF_311_API_BASE,
        {
          query,
          page: { pageNumber: 1, pageSize: 1 },
          includeSynthetic: false,
        },
        {
          headers: this.getAuthHeaders(), // Use auth headers
        },
      );

      if (response.data.length === 0) {
        throw new Error(`Case not found: ${case_id}`);
      }

      const c = response.data[0];
      const requestedDate = new Date(c.requested_datetime);
      const now = new Date();
      const daysOpen = Math.floor(
        (now.getTime() - requestedDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        service_request_id: c.service_request_id,
        requested_datetime: c.requested_datetime,
        closed_date: c.closed_date,
        status_description: c.status_description,
        service_name: c.service_name,
        address: c.address,
        neighborhoods_sffind_boundaries: c.neighborhoods_sffind_boundaries,
        days_open: daysOpen,
      };
    } catch (error: any) {
      console.error(
        "Error fetching case:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to fetch case: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description:
      "Get statistics and aggregated data about SF 311 cases. Shows total cases, open vs closed, average time to close, and most common service types for a given time period and optional filters.",
    tags: ["311", "stats", "analytics"],
    category: "SF311",
    inputSchema: GetCaseStatsInputSchema,
    outputSchema: CaseStatsOutputSchema,
  })
  async getCaseStats(
    input: z.infer<typeof GetCaseStatsInputSchema>,
  ): Promise<z.infer<typeof CaseStatsOutputSchema>> {
    const { neighborhood, service_name, days = 30 } = input;

    // Get all cases for the period
    const cases = await this.searchCases({
      neighborhood,
      service_name,
      days_old_max: days,
      limit: 1000,
    });

    const openCases = cases.filter((c) => c.status_description === "Open");
    const closedCases = cases.filter((c) => c.status_description === "Closed");

    // Calculate average days to close for closed cases
    let avgDaysToClose: number | undefined;
    if (closedCases.length > 0) {
      const totalDays = closedCases.reduce((sum, c) => {
        if (c.closed_date && c.requested_datetime) {
          const opened = new Date(c.requested_datetime);
          const closed = new Date(c.closed_date);
          const days = Math.floor(
            (closed.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24),
          );
          return sum + days;
        }
        return sum;
      }, 0);
      avgDaysToClose = Math.round(totalDays / closedCases.length);
    }

    // Get top service types
    const serviceCounts = new Map<string, number>();
    cases.forEach((c) => {
      const count = serviceCounts.get(c.service_name) || 0;
      serviceCounts.set(c.service_name, count + 1);
    });

    const topServices = Array.from(serviceCounts.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total_cases: cases.length,
      open_cases: openCases.length,
      closed_cases: closedCases.length,
      avg_days_to_close: avgDaysToClose,
      top_services: topServices,
    };
  }
}
