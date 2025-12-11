/*
 * =========================================================================================
 *  UPDATED SF311 FUNCTIONS - Enhanced for specific query patterns
 * =========================================================================================
 */

import { DaemoFunction } from "daemo-engine";
import axios from "axios";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  CaseStatsOutputSchema,
  CompareNeighborhoodsInputSchema,
  GetCaseByIdInputSchema,
  GetCaseStatsInputSchema,
  GetHotspotsInputSchema,
  GetNeighborhoodListOutputSchema,
  GetRecentlyUpdatedInputSchema,
  GetResponseTimeInputSchema,
  GetServiceCatalogInputSchema,
  GetServiceCatalogOutputSchema,
  GetTrendsInputSchema,
  HotspotOutputSchema,
  NeighborhoodComparisonSchema,
  ResponseTimeOutputSchema,
  SearchNearLocationInputSchema,
  TrendDataPointSchema,
} from "./sf311.schemas";

// Load environment variables
configDotenv();

const SF_311_APP_TOKEN = process.env.SF_311_APP_TOKEN;

const SF_311_API_BASE =
  "https://data.sfgov.org/api/v3/views/vw6y-z8j6/query.json";

// Maximum pages to fetch to prevent infinite loops
const MAX_PAGES = 20; // 20 pages × 1000 records = 20,000 max records

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

// Helper to calculate date X months ago
function getMonthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setHours(0, 0, 0, 0);
  return date;
}

// --- SCHEMAS ---

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
  service_subtype: z
    .string()
    .optional()
    .describe("Service subtype (e.g., 'General Cleaning')"),
  supervisor_district: z
    .string()
    .optional()
    .describe("Supervisor district number (e.g., '9')"),
  agency: z
    .string()
    .optional()
    .describe("Responsible agency (e.g., 'DPW Ops Queue')"),
  source: z
    .string()
    .optional()
    .describe("Source of request (e.g., 'Mobile/Open311')"),
  has_media: z
    .boolean()
    .optional()
    .describe("Only show cases with photos/media"),
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
    .describe("Maximum number of results (default 100, max 20000)"),
  fetch_all: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "If true, fetch all matching records using pagination (up to 20,000)",
    ),
});

const CaseOutputSchema = z.object({
  service_request_id: z.string(),
  requested_datetime: z.string(),
  closed_date: z.string().optional(),
  updated_datetime: z.string().optional(),
  status_description: z.string(),
  status_notes: z.string().optional(),
  agency_responsible: z.string().optional(),
  service_name: z.string(),
  service_subtype: z.string().optional(),
  service_details: z.string().optional(),
  address: z.string().optional(),
  street: z.string().optional(),
  supervisor_district: z.string().optional(),
  neighborhoods_sffind_boundaries: z.string().optional(),
  police_district: z.string().optional(),
  source: z.string().optional(),
  media_url: z.any().optional(),
  lat: z.string().optional(),
  long: z.string().optional(),
  days_open: z.number().optional(),
});

const SearchCasesOutputSchema = z.array(CaseOutputSchema);

const SearchTrashCanRequestsInputSchema = z.object({
  months_ago: z
    .number()
    .optional()
    .default(6)
    .describe("Filter for requests within this many months (default 6)"),
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  supervisor_district: z
    .string()
    .optional()
    .describe("Filter by supervisor district"),
  group_by_intersection: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Group results by intersection/address to show totals per location",
    ),
  fetch_all: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Fetch all matching records using pagination (default true for complete counts)",
    ),
});

const IntersectionGroupSchema = z.object({
  intersection: z.string(),
  request_count: z.number(),
  open_count: z.number(),
  closed_count: z.number(),
  most_recent_date: z.string(),
  oldest_date: z.string(),
});

const SearchTrashCanRequestsOutputSchema = z.object({
  total_requests: z.number(),
  total_pages_fetched: z.number(),
  requests: z.array(CaseOutputSchema),
  intersection_groups: z.array(IntersectionGroupSchema).optional(),
});

const AnalyzeEncampmentsInputSchema = z.object({
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  supervisor_district: z
    .string()
    .optional()
    .describe("Filter by supervisor district"),
  days: z
    .number()
    .optional()
    .default(180)
    .describe("Time period to analyze (default 180 days)"),
  group_by_location: z
    .boolean()
    .optional()
    .default(true)
    .describe("Group cases by location to show repeat locations"),
  fetch_all: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Fetch all matching records using pagination (default true for complete analysis)",
    ),
});

const EncampmentLocationGroupSchema = z.object({
  location: z.string(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  total_cases: z.number(),
  open_cases: z.number(),
  closed_cases: z.number(),
  avg_days_to_close: z.number().optional(),
  first_report_date: z.string(),
  most_recent_date: z.string(),
  case_ids: z.array(z.string()),
});

const AnalyzeEncampmentsOutputSchema = z.object({
  total_cases: z.number(),
  total_pages_fetched: z.number(),
  open_cases: z.number(),
  closed_cases: z.number(),
  avg_days_to_close: z.number().optional(),
  median_days_to_close: z.number().optional(),
  location_groups: z.array(EncampmentLocationGroupSchema).optional(),
});

const FindCasesByLocationInputSchema = z.object({
  latitude: z.number().describe("Latitude of location"),
  longitude: z.number().describe("Longitude of location"),
  radius_meters: z
    .number()
    .optional()
    .default(50)
    .describe("Search radius in meters (default 50m for same location)"),
  days: z.number().optional().describe("Only include cases from last N days"),
  service_name: z.string().optional().describe("Filter by service type"),
  fetch_all: z
    .boolean()
    .optional()
    .default(false)
    .describe("Fetch all matching records using pagination"),
});

const FindResubmittedCasesInputSchema = z.object({
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  supervisor_district: z
    .string()
    .optional()
    .describe("Filter by supervisor district"),
  service_name: z.string().optional().describe("Filter by service type"),
  days: z
    .number()
    .optional()
    .default(180)
    .describe("Look back this many days for closed cases"),
  min_days_between: z
    .number()
    .optional()
    .default(1)
    .describe(
      "Minimum days between closure and new case to count as resubmission",
    ),
  location_radius_meters: z
    .number()
    .optional()
    .default(50)
    .describe("Radius to consider cases at 'same location'"),
  fetch_all: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Fetch all matching records using pagination (default true for complete analysis)",
    ),
});

const ResubmittedCaseGroupSchema = z.object({
  location: z.string(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  service_name: z.string(),
  original_case_id: z.string(),
  original_closed_date: z.string(),
  resubmitted_case_id: z.string(),
  resubmitted_date: z.string(),
  days_between: z.number(),
  total_cases_at_location: z.number(),
});

const FindResubmittedCasesOutputSchema = z.object({
  total_resubmitted_locations: z.number(),
  total_resubmission_pairs: z.number(),
  total_pages_fetched: z.number(),
  avg_days_between_resubmission: z.number().optional(),
  resubmissions: z.array(ResubmittedCaseGroupSchema),
  service_type_breakdown: z.array(
    z.object({
      service_name: z.string(),
      resubmission_count: z.number(),
      percentage: z.number(),
    }),
  ),
});

const GetMostCommonComplaintsInputSchema = z.object({
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  supervisor_district: z
    .string()
    .optional()
    .describe("Filter by supervisor district"),
  days: z
    .number()
    .optional()
    .default(365)
    .describe("Time period to analyze (default 1 year)"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Number of top complaint types to return"),
  fetch_all: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Fetch all matching records using pagination (default true for accurate statistics)",
    ),
});

const ComplaintTypeStatsSchema = z.object({
  service_name: z.string(),
  total_count: z.number(),
  open_count: z.number(),
  closed_count: z.number(),
  percentage_of_total: z.number(),
  avg_days_to_close: z.number().optional(),
});

const GetMostCommonComplaintsOutputSchema = z.object({
  location_description: z.string(),
  total_cases: z.number(),
  total_pages_fetched: z.number(),
  time_period_days: z.number(),
  top_complaints: z.array(ComplaintTypeStatsSchema),
});

export class SF311Functions {
  // Helper to add auth headers/params
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (SF_311_APP_TOKEN) {
      headers["X-App-Token"] = SF_311_APP_TOKEN;
    }

    return headers;
  }

  // Helper to map API response to schema and calculate days_open
  private transformCaseData(
    apiData: any[],
  ): z.infer<typeof SearchCasesOutputSchema> {
    const now = new Date();
    return apiData.map((c: any) => {
      const requestedDate = new Date(c.requested_datetime);
      const daysOpen = Math.floor(
        (now.getTime() - requestedDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        service_request_id: c.service_request_id,
        requested_datetime: c.requested_datetime,
        closed_date: c.closed_date,
        updated_datetime: c.updated_datetime,
        status_description: c.status_description,
        status_notes: c.status_notes,
        agency_responsible: c.agency_responsible,
        service_name: c.service_name,
        service_subtype: c.service_subtype,
        service_details: c.service_details,
        address: c.address,
        street: c.street,
        supervisor_district: c.supervisor_district,
        neighborhoods_sffind_boundaries: c.neighborhoods_sffind_boundaries,
        police_district: c.police_district,
        source: c.source,
        media_url: c.media_url,
        lat: c.lat,
        long: c.long,
        days_open: daysOpen,
      };
    });
  }

  /**
   * Helper function to execute a query with pagination support
   * Returns all matching records up to MAX_PAGES
   */
  private async executeQueryWithPagination(
    query: string,
    fetchAll: boolean,
    requestedLimit?: number,
  ): Promise<{ cases: any[]; pagesFetched: number }> {
    const allCases: any[] = [];
    let pageNumber = 1;
    const pageSize = 1000; // Max allowed by Socrata

    console.log(`[Pagination] Starting query. Fetch all: ${fetchAll}`);

    while (true) {
      // Check if we should stop
      if (!fetchAll && allCases.length >= (requestedLimit || 100)) {
        console.log(
          `[Pagination] Reached requested limit of ${requestedLimit || 100} records`,
        );
        break;
      }

      if (pageNumber > MAX_PAGES) {
        console.log(
          `[Pagination] Reached maximum page limit (${MAX_PAGES} pages = ${MAX_PAGES * pageSize} records)`,
        );
        break;
      }

      console.log(`[Pagination] Fetching page ${pageNumber}...`);

      try {
        const response = await axios.post(
          SF_311_API_BASE,
          {
            query,
            page: {
              pageNumber,
              pageSize,
            },
            includeSynthetic: false,
          },
          {
            headers: this.getAuthHeaders(),
          },
        );

        const pageCases = response.data;
        console.log(
          `[Pagination] Page ${pageNumber}: ${pageCases.length} records`,
        );

        if (pageCases.length === 0) {
          console.log("[Pagination] No more records, stopping");
          break;
        }

        allCases.push(...pageCases);

        // If we got fewer than pageSize records, we've reached the end
        if (pageCases.length < pageSize) {
          console.log(
            "[Pagination] Received fewer than page size, reached end of data",
          );
          break;
        }

        // If not fetching all, and we have enough, stop
        if (!fetchAll && allCases.length >= (requestedLimit || 100)) {
          console.log("[Pagination] Collected enough records for limit");
          break;
        }

        pageNumber++;
      } catch (error: any) {
        console.error(
          `[Pagination] Error on page ${pageNumber}:`,
          error.response?.data || error.message,
        );
        throw new Error(
          `Failed to fetch page ${pageNumber}: ${error.response?.data?.message || error.message}`,
        );
      }
    }

    console.log(
      `[Pagination] Complete. Total records: ${allCases.length}, Pages fetched: ${pageNumber}`,
    );

    // If not fetching all, trim to requested limit
    const finalCases = fetchAll
      ? allCases
      : allCases.slice(0, requestedLimit || 100);

    return {
      cases: finalCases,
      pagesFetched: pageNumber,
    };
  }

  // =================================================================
  // FUNCTION 1: Get Most Common Complaints by Area
  // =================================================================

  @DaemoFunction({
    description:
      "Get the most common 311 complaint types in a specific neighborhood or supervisor district, with statistics on open/closed counts and resolution times. Uses pagination to fetch all matching records for accurate statistics.",
    tags: ["311", "complaints", "statistics", "neighborhood", "district"],
    category: "SF311",
    inputSchema: GetMostCommonComplaintsInputSchema,
    outputSchema: GetMostCommonComplaintsOutputSchema,
  })
  async getMostCommonComplaints(
    input: z.infer<typeof GetMostCommonComplaintsInputSchema>,
  ): Promise<z.infer<typeof GetMostCommonComplaintsOutputSchema>> {
    const {
      neighborhood,
      supervisor_district,
      days = 365,
      limit = 10,
      fetch_all = true,
    } = input;

    // Build location description
    let locationDesc = "San Francisco";
    if (neighborhood) locationDesc = neighborhood;
    if (supervisor_district) locationDesc = `District ${supervisor_district}`;

    // Get all cases for the period
    const cases = await this.searchCases({
      neighborhood,
      supervisor_district,
      days_old_max: days,
      limit: 10000,
      fetch_all,
    });

    // Group by service type
    const serviceStats = new Map<
      string,
      {
        total: number;
        open: number;
        closed: number;
        closedCases: any[];
      }
    >();

    cases.forEach((c) => {
      if (!serviceStats.has(c.service_name)) {
        serviceStats.set(c.service_name, {
          total: 0,
          open: 0,
          closed: 0,
          closedCases: [],
        });
      }

      const stats = serviceStats.get(c.service_name)!;
      stats.total++;

      if (c.status_description === "Open") {
        stats.open++;
      } else if (c.status_description === "Closed") {
        stats.closed++;
        stats.closedCases.push(c);
      }
    });

    // Calculate percentages and avg days to close
    const totalCases = cases.length;
    const topComplaints = Array.from(serviceStats.entries())
      .map(([serviceName, stats]) => {
        let avgDaysToClose: number | undefined;
        if (stats.closedCases.length > 0) {
          const totalDays = stats.closedCases.reduce((sum, c) => {
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
          avgDaysToClose = Math.round(totalDays / stats.closedCases.length);
        }

        return {
          service_name: serviceName,
          total_count: stats.total,
          open_count: stats.open,
          closed_count: stats.closed,
          percentage_of_total:
            Math.round((stats.total / totalCases) * 10000) / 100,
          avg_days_to_close: avgDaysToClose,
        };
      })
      .sort((a, b) => b.total_count - a.total_count)
      .slice(0, limit);

    return {
      location_description: locationDesc,
      total_cases: totalCases,
      total_pages_fetched: 0, // Will be set by searchCases
      time_period_days: days,
      top_complaints: topComplaints,
    };
  }

  // =================================================================
  // FUNCTION 2: Search Trash Can Requests (WITH PAGINATION)
  // =================================================================

  @DaemoFunction({
    description:
      "Search for 311 requests related to trash cans at intersections. Uses pagination to fetch ALL matching records for accurate counts. Can filter by time period, location, and group results by intersection to show which locations have the most requests.",
    tags: ["311", "trash", "waste", "intersection"],
    category: "SF311",
    inputSchema: SearchTrashCanRequestsInputSchema,
    outputSchema: SearchTrashCanRequestsOutputSchema,
  })
  async searchTrashCanRequests(
    input: z.infer<typeof SearchTrashCanRequestsInputSchema>,
  ): Promise<z.infer<typeof SearchTrashCanRequestsOutputSchema>> {
    const {
      months_ago = 6,
      neighborhood,
      supervisor_district,
      group_by_intersection = false,
      fetch_all = true,
    } = input;

    // Build WHERE clause
    const conditions: string[] = [];

    // Trash can related service names/subtypes
    conditions.push(
      `(\`service_name\` LIKE '%Trash%' OR \`service_name\` LIKE '%Receptacle%' OR \`service_name\` LIKE '%Waste%' OR \`service_subtype\` LIKE '%Trash%' OR \`service_subtype\` LIKE '%Receptacle%')`,
    );

    if (neighborhood) {
      conditions.push(
        `\`neighborhoods_sffind_boundaries\` = '${neighborhood}'`,
      );
    }

    if (supervisor_district) {
      conditions.push(`\`supervisor_district\` = '${supervisor_district}'`);
    }

    // Time filter
    const minDate = formatDateForSoQL(getMonthsAgo(months_ago));
    conditions.push(`\`requested_datetime\` > '${minDate}'`);

    const whereClause = ` WHERE ${conditions.join(" AND ")}`;

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC`;

    console.log("SF 311 Trash Can Query:", query);

    try {
      // Use pagination helper
      const { cases: apiCases, pagesFetched } =
        await this.executeQueryWithPagination(
          query,
          fetch_all,
          undefined, // No limit when fetching all
        );

      const cases = this.transformCaseData(apiCases);

      let intersectionGroups:
        | z.infer<typeof IntersectionGroupSchema>[]
        | undefined;

      if (group_by_intersection) {
        // Group by address/street
        const locationMap = new Map<
          string,
          {
            cases: any[];
            open: number;
            closed: number;
            dates: Date[];
          }
        >();

        cases.forEach((c) => {
          const location = c.address || c.street || "Unknown Location";
          if (!locationMap.has(location)) {
            locationMap.set(location, {
              cases: [],
              open: 0,
              closed: 0,
              dates: [],
            });
          }

          const group = locationMap.get(location)!;
          group.cases.push(c);
          group.dates.push(new Date(c.requested_datetime));

          if (c.status_description === "Open") {
            group.open++;
          } else if (c.status_description === "Closed") {
            group.closed++;
          }
        });

        intersectionGroups = Array.from(locationMap.entries())
          .map(([location, data]) => {
            data.dates.sort((a, b) => a.getTime() - b.getTime());
            return {
              intersection: location,
              request_count: data.cases.length,
              open_count: data.open,
              closed_count: data.closed,
              most_recent_date: data.dates[data.dates.length - 1].toISOString(),
              oldest_date: data.dates[0].toISOString(),
            };
          })
          .sort((a, b) => b.request_count - a.request_count);
      }

      return {
        total_requests: cases.length,
        total_pages_fetched: pagesFetched,
        requests: cases,
        intersection_groups: intersectionGroups,
      };
    } catch (error: any) {
      console.error(
        "Error fetching trash can data:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to fetch trash can data: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // =================================================================
  // FUNCTION 3: Analyze Encampments (WITH PAGINATION)
  // =================================================================

  @DaemoFunction({
    description:
      "Analyze encampment-related 311 cases including total counts, average time to closure, and identification of locations with multiple reports. Uses pagination to fetch all matching records. Shows how many complaints are filed at each encampment location.",
    tags: ["311", "encampment", "homeless", "analytics"],
    category: "SF311",
    inputSchema: AnalyzeEncampmentsInputSchema,
    outputSchema: AnalyzeEncampmentsOutputSchema,
  })
  async analyzeEncampments(
    input: z.infer<typeof AnalyzeEncampmentsInputSchema>,
  ): Promise<z.infer<typeof AnalyzeEncampmentsOutputSchema>> {
    const {
      neighborhood,
      supervisor_district,
      days = 180,
      group_by_location = true,
      fetch_all = true,
    } = input;

    // Build WHERE clause
    const conditions: string[] = [];

    conditions.push(
      `(\`service_name\` LIKE '%Encampment%' OR \`service_subtype\` LIKE '%Encampment%')`,
    );

    if (neighborhood) {
      conditions.push(
        `\`neighborhoods_sffind_boundaries\` = '${neighborhood}'`,
      );
    }

    if (supervisor_district) {
      conditions.push(`\`supervisor_district\` = '${supervisor_district}'`);
    }

    const minDate = formatDateForSoQL(getDaysAgo(days));
    conditions.push(`\`requested_datetime\` > '${minDate}'`);

    const whereClause = ` WHERE ${conditions.join(" AND ")}`;

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC`;

    console.log("SF 311 Encampment Query:", query);

    try {
      // Use pagination helper
      const { cases: apiCases, pagesFetched } =
        await this.executeQueryWithPagination(query, fetch_all, undefined);

      const cases = this.transformCaseData(apiCases);

      // Calculate overall statistics
      const openCases = cases.filter((c) => c.status_description === "Open");
      const closedCases = cases.filter(
        (c) => c.status_description === "Closed",
      );

      let avgDaysToClose: number | undefined;
      let medianDaysToClose: number | undefined;

      if (closedCases.length > 0) {
        const daysToCloseList = closedCases
          .map((c) => {
            if (c.closed_date && c.requested_datetime) {
              const opened = new Date(c.requested_datetime);
              const closed = new Date(c.closed_date);
              return Math.floor(
                (closed.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24),
              );
            }
            return null;
          })
          .filter((d) => d !== null) as number[];

        if (daysToCloseList.length > 0) {
          avgDaysToClose = Math.round(
            daysToCloseList.reduce((a, b) => a + b, 0) / daysToCloseList.length,
          );

          daysToCloseList.sort((a, b) => a - b);
          medianDaysToClose =
            daysToCloseList[Math.floor(daysToCloseList.length / 2)];
        }
      }

      let locationGroups:
        | z.infer<typeof EncampmentLocationGroupSchema>[]
        | undefined;

      if (group_by_location) {
        // Group by approximate location
        const locationMap = new Map<
          string,
          {
            cases: any[];
            address?: string;
            lat?: string;
            long?: string;
            open: number;
            closed: number;
            dates: Date[];
            closedCases: any[];
          }
        >();

        cases.forEach((c) => {
          // Use address if available, otherwise use coordinates
          let locationKey: string;
          if (c.address) {
            locationKey = c.address;
          } else if (c.lat && c.long) {
            // Round to 4 decimal places (~11m precision)
            const lat = parseFloat(c.lat).toFixed(4);
            const long = parseFloat(c.long).toFixed(4);
            locationKey = `${lat},${long}`;
          } else {
            locationKey = "Unknown Location";
          }

          if (!locationMap.has(locationKey)) {
            locationMap.set(locationKey, {
              cases: [],
              address: c.address,
              lat: c.lat,
              long: c.long,
              open: 0,
              closed: 0,
              dates: [],
              closedCases: [],
            });
          }

          const group = locationMap.get(locationKey)!;
          group.cases.push(c);
          group.dates.push(new Date(c.requested_datetime));

          if (c.status_description === "Open") {
            group.open++;
          } else if (c.status_description === "Closed") {
            group.closed++;
            group.closedCases.push(c);
          }
        });

        locationGroups = Array.from(locationMap.entries())
          .map(([locationKey, data]) => {
            data.dates.sort((a, b) => a.getTime() - b.getTime());

            let avgDaysToCloseForLocation: number | undefined;
            if (data.closedCases.length > 0) {
              const totalDays = data.closedCases.reduce((sum, c) => {
                if (c.closed_date && c.requested_datetime) {
                  const opened = new Date(c.requested_datetime);
                  const closed = new Date(c.closed_date);
                  const days = Math.floor(
                    (closed.getTime() - opened.getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  return sum + days;
                }
                return sum;
              }, 0);
              avgDaysToCloseForLocation = Math.round(
                totalDays / data.closedCases.length,
              );
            }

            return {
              location: locationKey,
              address: data.address,
              latitude: data.lat,
              longitude: data.long,
              total_cases: data.cases.length,
              open_cases: data.open,
              closed_cases: data.closed,
              avg_days_to_close: avgDaysToCloseForLocation,
              first_report_date: data.dates[0].toISOString(),
              most_recent_date: data.dates[data.dates.length - 1].toISOString(),
              case_ids: data.cases.map((c) => c.service_request_id),
            };
          })
          .sort((a, b) => b.total_cases - a.total_cases);
      }

      return {
        total_cases: cases.length,
        total_pages_fetched: pagesFetched,
        open_cases: openCases.length,
        closed_cases: closedCases.length,
        avg_days_to_close: avgDaysToClose,
        median_days_to_close: medianDaysToClose,
        location_groups: locationGroups,
      };
    } catch (error: any) {
      console.error(
        "Error analyzing encampments:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to analyze encampments: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // =================================================================
  // FUNCTION 4: Find Cases by Location (WITH PAGINATION)
  // =================================================================

  @DaemoFunction({
    description:
      "Find all 311 cases at or near a specific geographic location. Useful for identifying all reports at a specific address or identifying repeat issues at the same location. Can use pagination to fetch all matching records.",
    tags: ["311", "location", "geospatial"],
    category: "SF311",
    inputSchema: FindCasesByLocationInputSchema,
    outputSchema: SearchCasesOutputSchema,
  })
  async findCasesByLocation(
    input: z.infer<typeof FindCasesByLocationInputSchema>,
  ): Promise<z.infer<typeof SearchCasesOutputSchema>> {
    const {
      latitude,
      longitude,
      radius_meters = 50,
      days,
      service_name,
      fetch_all = false,
    } = input;

    const conditions: string[] = [];

    // Geospatial query
    conditions.push(
      `within_circle(\`point\`, ${latitude}, ${longitude}, ${radius_meters})`,
    );

    if (service_name) {
      conditions.push(`\`service_name\` LIKE '%${service_name}%'`);
    }

    if (days !== undefined) {
      const minDate = formatDateForSoQL(getDaysAgo(days));
      conditions.push(`\`requested_datetime\` > '${minDate}'`);
    }

    const whereClause = ` WHERE ${conditions.join(" AND ")}`;

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC`;

    console.log("SF 311 Location Query:", query);

    try {
      const { cases: apiCases } = await this.executeQueryWithPagination(
        query,
        fetch_all,
        200,
      );

      return this.transformCaseData(apiCases);
    } catch (error: any) {
      console.error(
        "Error finding cases by location:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to find cases by location: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // =================================================================
  // FUNCTION 5: Find Resubmitted Cases (WITH PAGINATION)
  // =================================================================

  @DaemoFunction({
    description:
      "Identify 311 cases where a location had a case closed, but then had new cases filed at the same location afterwards, indicating repeat issues or resubmissions. Uses pagination to fetch all matching records for complete analysis. Shows which complaint types and locations have the highest resubmission rates.",
    tags: ["311", "resubmitted", "repeat", "closed"],
    category: "SF311",
    inputSchema: FindResubmittedCasesInputSchema,
    outputSchema: FindResubmittedCasesOutputSchema,
  })
  async findResubmittedCases(
    input: z.infer<typeof FindResubmittedCasesInputSchema>,
  ): Promise<z.infer<typeof FindResubmittedCasesOutputSchema>> {
    const {
      neighborhood,
      supervisor_district,
      service_name,
      days = 180,
      min_days_between = 1,
      location_radius_meters = 50,
      fetch_all = true,
    } = input;

    // Build WHERE clause
    const conditions: string[] = [];

    if (neighborhood) {
      conditions.push(
        `\`neighborhoods_sffind_boundaries\` = '${neighborhood}'`,
      );
    }

    if (supervisor_district) {
      conditions.push(`\`supervisor_district\` = '${supervisor_district}'`);
    }

    if (service_name) {
      conditions.push(`\`service_name\` LIKE '%${service_name}%'`);
    }

    const minDate = formatDateForSoQL(getDaysAgo(days));
    conditions.push(`\`requested_datetime\` > '${minDate}'`);

    const whereClause =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` ASC`;

    console.log("SF 311 Resubmission Query:", query);

    try {
      const { cases: apiCases, pagesFetched } =
        await this.executeQueryWithPagination(query, fetch_all, undefined);

      const cases = this.transformCaseData(apiCases);

      // Group cases by location
      const locationMap = new Map<
        string,
        {
          cases: any[];
          lat?: string;
          long?: string;
          address?: string;
        }
      >();

      cases.forEach((c) => {
        if (!c.lat || !c.long) return;

        // Round coordinates to group nearby cases
        const lat = parseFloat(c.lat).toFixed(4);
        const long = parseFloat(c.long).toFixed(4);
        const locationKey = `${lat},${long}`;

        if (!locationMap.has(locationKey)) {
          locationMap.set(locationKey, {
            cases: [],
            lat: c.lat,
            long: c.long,
            address: c.address,
          });
        }

        locationMap.get(locationKey)!.cases.push(c);
      });

      // Find resubmission patterns
      const resubmissions: z.infer<typeof ResubmittedCaseGroupSchema>[] = [];
      const serviceTypeCount = new Map<string, number>();

      locationMap.forEach((data, locationKey) => {
        // Sort cases by date
        data.cases.sort(
          (a, b) =>
            new Date(a.requested_datetime).getTime() -
            new Date(b.requested_datetime).getTime(),
        );

        // Look for closed→new patterns
        for (let i = 0; i < data.cases.length - 1; i++) {
          const currentCase = data.cases[i];

          if (
            currentCase.status_description === "Closed" &&
            currentCase.closed_date
          ) {
            const closedDate = new Date(currentCase.closed_date);

            // Check if there are cases after this was closed
            for (let j = i + 1; j < data.cases.length; j++) {
              const laterCase = data.cases[j];
              const laterDate = new Date(laterCase.requested_datetime);

              const daysBetween = Math.floor(
                (laterDate.getTime() - closedDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              );

              if (daysBetween >= min_days_between) {
                resubmissions.push({
                  location: locationKey,
                  address: data.address,
                  latitude: data.lat,
                  longitude: data.long,
                  service_name: currentCase.service_name,
                  original_case_id: currentCase.service_request_id,
                  original_closed_date: currentCase.closed_date!,
                  resubmitted_case_id: laterCase.service_request_id,
                  resubmitted_date: laterCase.requested_datetime,
                  days_between: daysBetween,
                  total_cases_at_location: data.cases.length,
                });

                // Count by service type
                const count =
                  serviceTypeCount.get(currentCase.service_name) || 0;
                serviceTypeCount.set(currentCase.service_name, count + 1);

                break; // Only count first resubmission after each closure
              }
            }
          }
        }
      });

      // Calculate statistics
      let avgDaysBetween: number | undefined;
      if (resubmissions.length > 0) {
        const totalDays = resubmissions.reduce(
          (sum, r) => sum + r.days_between,
          0,
        );
        avgDaysBetween = Math.round(totalDays / resubmissions.length);
      }

      const totalResubmissions = resubmissions.length;
      const serviceTypeBreakdown = Array.from(serviceTypeCount.entries())
        .map(([serviceName, count]) => ({
          service_name: serviceName,
          resubmission_count: count,
          percentage: Math.round((count / totalResubmissions) * 10000) / 100,
        }))
        .sort((a, b) => b.resubmission_count - a.resubmission_count);

      const uniqueLocations = new Set(resubmissions.map((r) => r.location))
        .size;

      return {
        total_resubmitted_locations: uniqueLocations,
        total_resubmission_pairs: resubmissions.length,
        total_pages_fetched: pagesFetched,
        avg_days_between_resubmission: avgDaysBetween,
        resubmissions: resubmissions.slice(0, 100), // Limit to top 100
        service_type_breakdown: serviceTypeBreakdown,
      };
    } catch (error: any) {
      console.error(
        "Error finding resubmitted cases:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to find resubmitted cases: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // =================================================================
  // UPDATED: Search Cases (WITH PAGINATION)
  // =================================================================

  @DaemoFunction({
    description:
      "Search SF 311 cases with comprehensive filtering. Can filter by status, neighborhood, service type, agency, source, media presence, and age of cases. Supports pagination to fetch all matching records. The most versatile search function.",
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
      service_subtype,
      supervisor_district,
      agency,
      source,
      has_media,
      days_old_min,
      days_old_max,
      limit = 100,
      fetch_all = false,
    } = input;

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

    if (service_subtype) {
      conditions.push(`\`service_subtype\` LIKE '%${service_subtype}%'`);
    }

    if (supervisor_district) {
      conditions.push(`\`supervisor_district\` = '${supervisor_district}'`);
    }

    if (agency) {
      conditions.push(`\`agency_responsible\` LIKE '%${agency}%'`);
    }

    if (source) {
      conditions.push(`\`source\` LIKE '%${source}%'`);
    }

    if (has_media) {
      conditions.push(`\`media_url\` IS NOT NULL`);
    }

    if (days_old_min !== undefined) {
      const maxDate = formatDateForSoQL(getDaysAgo(days_old_min));
      conditions.push(`\`requested_datetime\` < '${maxDate}'`);
    }

    if (days_old_max !== undefined) {
      const minDate = formatDateForSoQL(getDaysAgo(days_old_max));
      conditions.push(`\`requested_datetime\` > '${minDate}'`);
    }

    const whereClause =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC`;

    console.log("SF 311 Query:", query);

    try {
      const { cases: apiCases, pagesFetched } =
        await this.executeQueryWithPagination(query, fetch_all, limit);

      const cases = this.transformCaseData(apiCases);
      console.log(
        `SF 311: Found ${cases.length} cases (${pagesFetched} pages fetched)`,
      );
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

  // Existing Functions

  // @DaemoFunction({
  //   description:
  //     "Search SF 311 cases with comprehensive filtering. Can filter by status, neighborhood, service type, agency, source, media presence, and age of cases. The most versatile search function.",
  //   tags: ["311", "search", "cases"],
  //   category: "SF311",
  //   inputSchema: SearchCasesInputSchema,
  //   outputSchema: SearchCasesOutputSchema,
  // })
  // async searchCases(
  //   input: z.infer<typeof SearchCasesInputSchema>,
  // ): Promise<z.infer<typeof SearchCasesOutputSchema>> {
  //   const {
  //     status,
  //     neighborhood,
  //     service_name,
  //     service_subtype,
  //     supervisor_district,
  //     agency,
  //     source,
  //     has_media,
  //     days_old_min,
  //     days_old_max,
  //     limit = 100,
  //   } = input;
  //
  //   // Build WHERE clause
  //   const conditions: string[] = [];
  //
  //   if (status) {
  //     conditions.push(`\`status_description\` = '${status}'`);
  //   }
  //
  //   if (neighborhood) {
  //     conditions.push(
  //       `\`neighborhoods_sffind_boundaries\` = '${neighborhood}'`,
  //     );
  //   }
  //
  //   if (service_name) {
  //     conditions.push(`\`service_name\` LIKE '%${service_name}%'`);
  //   }
  //
  //   if (service_subtype) {
  //     conditions.push(`\`service_subtype\` LIKE '%${service_subtype}%'`);
  //   }
  //
  //   if (supervisor_district) {
  //     conditions.push(`\`supervisor_district\` = '${supervisor_district}'`);
  //   }
  //
  //   if (agency) {
  //     conditions.push(`\`agency_responsible\` LIKE '%${agency}%'`);
  //   }
  //
  //   if (source) {
  //     conditions.push(`\`source\` LIKE '%${source}%'`);
  //   }
  //
  //   if (has_media) {
  //     conditions.push(`\`media_url\` IS NOT NULL`);
  //   }
  //
  //   // Date filtering - cases older than X days
  //   if (days_old_min !== undefined) {
  //     const maxDate = formatDateForSoQL(getDaysAgo(days_old_min));
  //     conditions.push(`\`requested_datetime\` < '${maxDate}'`);
  //   }
  //
  //   // Date filtering - cases newer than X days
  //   if (days_old_max !== undefined) {
  //     const minDate = formatDateForSoQL(getDaysAgo(days_old_max));
  //     conditions.push(`\`requested_datetime\` > '${minDate}'`);
  //   }
  //
  //   const whereClause =
  //     conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  //
  //   // Build SoQL query
  //   const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC LIMIT ${Math.min(limit, 1000)}`;
  //
  //   console.log("SF 311 Query:", query);
  //
  //   try {
  //     const response = await axios.post(
  //       SF_311_API_BASE,
  //       {
  //         query,
  //         page: {
  //           pageNumber: 1,
  //           pageSize: Math.min(limit, 1000),
  //         },
  //         includeSynthetic: false,
  //       },
  //       {
  //         headers: this.getAuthHeaders(),
  //       },
  //     );
  //
  //     const cases = this.transformCaseData(response.data);
  //     console.log(`SF 311: Found ${cases.length} cases`);
  //     return cases;
  //   } catch (error: any) {
  //     console.error(
  //       "Error fetching 311 data:",
  //       error.response?.data || error.message,
  //     );
  //     throw new Error(
  //       `Failed to fetch 311 data: ${error.response?.data?.message || error.message}`,
  //     );
  //   }
  // }

  @DaemoFunction({
    description:
      "Search for 311 cases near a specific location using latitude/longitude coordinates. Useful for finding issues near an address, landmark, or current location.",
    tags: ["311", "geospatial", "location"],
    category: "SF311",
    inputSchema: SearchNearLocationInputSchema,
    outputSchema: SearchCasesOutputSchema,
  })
  async searchNearLocation(
    input: z.infer<typeof SearchNearLocationInputSchema>,
  ): Promise<z.infer<typeof SearchCasesOutputSchema>> {
    const {
      latitude,
      longitude,
      radius_meters = 500,
      status,
      service_name,
      days_ago,
      limit = 100,
    } = input;

    const conditions: string[] = [];

    // Geospatial query using within_circle
    // Note: within_circle uses (lat, long) order, not the GeoJSON (long, lat) order
    conditions.push(
      `within_circle(\`point\`, ${latitude}, ${longitude}, ${radius_meters})`,
    );

    if (status) {
      conditions.push(`\`status_description\` = '${status}'`);
    }

    if (service_name) {
      conditions.push(`\`service_name\` LIKE '%${service_name}%'`);
    }

    if (days_ago !== undefined) {
      const minDate = formatDateForSoQL(getDaysAgo(days_ago));
      conditions.push(`\`requested_datetime\` > '${minDate}'`);
    }

    const whereClause = ` WHERE ${conditions.join(" AND ")}`;

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC LIMIT ${Math.min(limit, 1000)}`;

    console.log("SF 311 Geospatial Query:", query);

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
          headers: this.getAuthHeaders(),
        },
      );

      const cases = this.transformCaseData(response.data);
      console.log(`SF 311: Found ${cases.length} cases near location`);
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
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data.length === 0) {
        throw new Error(`Case not found: ${case_id}`);
      }

      const cases = this.transformCaseData(response.data);
      return cases[0];
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
      "Get comprehensive statistics about SF 311 cases including open/closed counts, average response time, top services, and top neighborhoods.",
    tags: ["311", "stats", "analytics"],
    category: "SF311",
    inputSchema: GetCaseStatsInputSchema,
    outputSchema: CaseStatsOutputSchema,
  })
  async getCaseStats(
    input: z.infer<typeof GetCaseStatsInputSchema>,
  ): Promise<z.infer<typeof CaseStatsOutputSchema>> {
    const {
      neighborhood,
      service_name,
      supervisor_district,
      days = 30,
    } = input;

    // Get all cases for the period
    const cases = await this.searchCases({
      neighborhood,
      service_name,
      supervisor_district,
      days_old_max: days,
      limit: 1000,
      fetch_all: true,
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

    // Get top neighborhoods
    const neighborhoodCounts = new Map<string, number>();
    cases.forEach((c) => {
      if (c.neighborhoods_sffind_boundaries) {
        const count =
          neighborhoodCounts.get(c.neighborhoods_sffind_boundaries) || 0;
        neighborhoodCounts.set(c.neighborhoods_sffind_boundaries, count + 1);
      }
    });

    const topNeighborhoods = Array.from(neighborhoodCounts.entries())
      .map(([neighborhood, count]) => ({ neighborhood, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total_cases: cases.length,
      open_cases: openCases.length,
      closed_cases: closedCases.length,
      avg_days_to_close: avgDaysToClose,
      top_services: topServices,
      top_neighborhoods: topNeighborhoods,
    };
  }

  @DaemoFunction({
    description:
      "Identify hotspots with high case concentrations. Can analyze by street, neighborhood, or supervisor district to find problem areas.",
    tags: ["311", "hotspots", "analytics"],
    category: "SF311",
    inputSchema: GetHotspotsInputSchema,
    outputSchema: z.array(HotspotOutputSchema),
  })
  async getHotspots(
    input: z.infer<typeof GetHotspotsInputSchema>,
  ): Promise<z.infer<typeof HotspotOutputSchema>[]> {
    const {
      analysis_type,
      service_name,
      days = 30,
      min_cases = 5,
      limit = 20,
    } = input;

    // Get cases for the period
    const cases = await this.searchCases({
      service_name,
      days_old_max: days,
      limit: 1000,
      fetch_all: true,
    });

    // Group by the specified field
    const fieldMap: Record<string, string> = {
      street: "street",
      neighborhood: "neighborhoods_sffind_boundaries",
      district: "supervisor_district",
    };

    const field = fieldMap[analysis_type];
    const locationCounts = new Map<
      string,
      {
        count: number;
        services: Map<string, number>;
        closedCases: any[];
      }
    >();

    cases.forEach((c) => {
      const location = (c as any)[field];
      if (!location) return;

      if (!locationCounts.has(location)) {
        locationCounts.set(location, {
          count: 0,
          services: new Map(),
          closedCases: [],
        });
      }

      const data = locationCounts.get(location)!;
      data.count++;

      // Track service types
      const serviceCount = data.services.get(c.service_name) || 0;
      data.services.set(c.service_name, serviceCount + 1);

      // Track closed cases for avg calc
      if (c.status_description === "Closed" && c.closed_date) {
        data.closedCases.push(c);
      }
    });

    // Convert to hotspots array
    const hotspots = Array.from(locationCounts.entries())
      .filter(([_, data]) => data.count >= min_cases)
      .map(([location, data]) => {
        // Find most common service
        let mostCommonService: string | undefined;
        let maxCount = 0;
        data.services.forEach((count, service) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommonService = service;
          }
        });

        // Calculate avg days to close
        let avgDaysToClose: number | undefined;
        if (data.closedCases.length > 0) {
          const totalDays = data.closedCases.reduce((sum, c) => {
            const opened = new Date(c.requested_datetime);
            const closed = new Date(c.closed_date);
            const days = Math.floor(
              (closed.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24),
            );
            return sum + days;
          }, 0);
          avgDaysToClose = Math.round(totalDays / data.closedCases.length);
        }

        return {
          location,
          case_count: data.count,
          most_common_service: mostCommonService,
          avg_days_to_close: avgDaysToClose,
        };
      })
      .sort((a, b) => b.case_count - a.case_count)
      .slice(0, limit);

    return hotspots;
  }

  @DaemoFunction({
    description:
      "Analyze case trends over time with daily, weekly, or monthly grouping. Shows how case volume changes over a time period.",
    tags: ["311", "trends", "analytics"],
    category: "SF311",
    inputSchema: GetTrendsInputSchema,
    outputSchema: z.array(TrendDataPointSchema),
  })
  async getTrends(
    input: z.infer<typeof GetTrendsInputSchema>,
  ): Promise<z.infer<typeof TrendDataPointSchema>[]> {
    const {
      service_name,
      neighborhood,
      days = 90,
      grouping = "weekly",
    } = input;

    // Get cases for the period
    const cases = await this.searchCases({
      service_name,
      neighborhood,
      days_old_max: days,
      limit: 1000,
      fetch_all: true,
    });

    // Group by time period
    const periodMap = new Map<
      string,
      { open: number; closed: number; total: number }
    >();

    cases.forEach((c) => {
      const date = new Date(c.requested_datetime);
      let periodKey: string;

      if (grouping === "daily") {
        periodKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      } else if (grouping === "weekly") {
        // Get week start (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split("T")[0];
      } else {
        // monthly
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, { open: 0, closed: 0, total: 0 });
      }

      const data = periodMap.get(periodKey)!;
      data.total++;
      if (c.status_description === "Open") {
        data.open++;
      } else if (c.status_description === "Closed") {
        data.closed++;
      }
    });

    // Convert to array and sort
    const trends = Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        case_count: data.total,
        open_count: data.open,
        closed_count: data.closed,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return trends;
  }

  @DaemoFunction({
    description:
      "Compare statistics across multiple neighborhoods side-by-side. Shows total cases, open/closed counts, and average resolution time for each.",
    tags: ["311", "compare", "neighborhoods"],
    category: "SF311",
    inputSchema: CompareNeighborhoodsInputSchema,
    outputSchema: z.array(NeighborhoodComparisonSchema),
  })
  async compareNeighborhoods(
    input: z.infer<typeof CompareNeighborhoodsInputSchema>,
  ): Promise<z.infer<typeof NeighborhoodComparisonSchema>[]> {
    const { neighborhoods, service_name, days = 30 } = input;

    const comparisons = await Promise.all(
      neighborhoods.map(async (neighborhood) => {
        const cases = await this.searchCases({
          neighborhood,
          service_name,
          days_old_max: days,
          limit: 1000,
          fetch_all: true,
        });

        const openCases = cases.filter((c) => c.status_description === "Open");
        const closedCases = cases.filter(
          (c) => c.status_description === "Closed",
        );

        // Calculate average days to close
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

        // Get top service
        const serviceCounts = new Map<string, number>();
        cases.forEach((c) => {
          const count = serviceCounts.get(c.service_name) || 0;
          serviceCounts.set(c.service_name, count + 1);
        });

        let topService: string | undefined;
        let maxCount = 0;
        serviceCounts.forEach((count, service) => {
          if (count > maxCount) {
            maxCount = count;
            topService = service;
          }
        });

        return {
          neighborhood,
          total_cases: cases.length,
          open_cases: openCases.length,
          closed_cases: closedCases.length,
          avg_days_to_close: avgDaysToClose,
          top_service: topService,
        };
      }),
    );

    return comparisons;
  }

  @DaemoFunction({
    description:
      "Get a catalog of all available service types with case counts and average resolution times. Useful for understanding what types of issues are reported.",
    tags: ["311", "services", "catalog"],
    category: "SF311",
    inputSchema: GetServiceCatalogInputSchema,
    outputSchema: GetServiceCatalogOutputSchema,
  })
  async getServiceCatalog(
    input: z.infer<typeof GetServiceCatalogInputSchema>,
  ): Promise<z.infer<typeof GetServiceCatalogOutputSchema>> {
    const { days = 30 } = input || {};

    const cases = await this.searchCases({
      days_old_max: days,
      limit: 1000,
      fetch_all: true,
    });

    const serviceStats = new Map<
      string,
      { count: number; closedCases: any[] }
    >();

    cases.forEach((c) => {
      if (!serviceStats.has(c.service_name)) {
        serviceStats.set(c.service_name, { count: 0, closedCases: [] });
      }

      const stats = serviceStats.get(c.service_name)!;
      stats.count++;

      if (c.status_description === "Closed" && c.closed_date) {
        stats.closedCases.push(c);
      }
    });

    const serviceTypes = Array.from(serviceStats.entries())
      .map(([service_name, stats]) => {
        let avgDaysToClose: number | undefined;
        if (stats.closedCases.length > 0) {
          const totalDays = stats.closedCases.reduce((sum, c) => {
            const opened = new Date(c.requested_datetime);
            const closed = new Date(c.closed_date);
            const days = Math.floor(
              (closed.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24),
            );
            return sum + days;
          }, 0);
          avgDaysToClose = Math.round(totalDays / stats.closedCases.length);
        }

        return {
          service_name,
          count: stats.count,
          avg_days_to_close: avgDaysToClose,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { service_types: serviceTypes };
  }

  @DaemoFunction({
    description:
      "Get a list of all neighborhoods that have 311 cases. Useful for knowing valid neighborhood names for filtering.",
    tags: ["311", "neighborhoods", "catalog"],
    category: "SF311",
    inputSchema: z.object({}).optional(),
    outputSchema: GetNeighborhoodListOutputSchema,
  })
  async getNeighborhoodList(
    input?: any,
  ): Promise<z.infer<typeof GetNeighborhoodListOutputSchema>> {
    // Get recent cases to extract neighborhoods
    const cases = await this.searchCases({
      days_old_max: 7,
      limit: 1000,
      fetch_all: false,
    });

    const neighborhoods = new Set<string>();
    cases.forEach((c) => {
      if (c.neighborhoods_sffind_boundaries) {
        neighborhoods.add(c.neighborhoods_sffind_boundaries);
      }
    });

    return {
      neighborhoods: Array.from(neighborhoods).sort(),
    };
  }

  @DaemoFunction({
    description:
      "Get cases that were recently updated in the last N hours. Useful for monitoring recent changes and new case assignments.",
    tags: ["311", "recent", "updates"],
    category: "SF311",
    inputSchema: GetRecentlyUpdatedInputSchema,
    outputSchema: SearchCasesOutputSchema,
  })
  async getRecentlyUpdated(
    input: z.infer<typeof GetRecentlyUpdatedInputSchema>,
  ): Promise<z.infer<typeof SearchCasesOutputSchema>> {
    const { hours = 24, status, limit = 50 } = input;

    const conditions: string[] = [];

    // Calculate datetime N hours ago
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);
    const dateStr = formatDateForSoQL(hoursAgo);

    conditions.push(`\`updated_datetime\` > '${dateStr}'`);

    if (status) {
      conditions.push(`\`status_description\` = '${status}'`);
    }

    const whereClause = ` WHERE ${conditions.join(" AND ")}`;

    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`updated_datetime\` DESC LIMIT ${Math.min(limit, 1000)}`;

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
          headers: this.getAuthHeaders(),
        },
      );

      return this.transformCaseData(response.data);
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
    description:
      "Analyze response times (time to close) by service type or neighborhood. Shows average, median, min, and max days to close.",
    tags: ["311", "response", "analytics"],
    category: "SF311",
    inputSchema: GetResponseTimeInputSchema,
    outputSchema: z.array(ResponseTimeOutputSchema),
  })
  async getResponseTimeAnalysis(
    input: z.infer<typeof GetResponseTimeInputSchema>,
  ): Promise<z.infer<typeof ResponseTimeOutputSchema>[]> {
    const { service_name, neighborhood, days = 90 } = input;

    const cases = await this.searchCases({
      service_name,
      neighborhood,
      status: "Closed",
      days_old_max: days,
      limit: 1000,
      fetch_all: true,
    });

    // Group by service_name if no filter, or by neighborhood if no filter
    const groupByField = service_name
      ? "neighborhoods_sffind_boundaries"
      : "service_name";

    const groupStats = new Map<string, number[]>();

    cases.forEach((c) => {
      if (!c.closed_date || !c.requested_datetime) return;

      const groupKey = (c as any)[groupByField];
      if (!groupKey) return;

      const opened = new Date(c.requested_datetime);
      const closed = new Date(c.closed_date);
      const daysToClose = Math.floor(
        (closed.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (!groupStats.has(groupKey)) {
        groupStats.set(groupKey, []);
      }
      groupStats.get(groupKey)!.push(daysToClose);
    });

    const results = Array.from(groupStats.entries()).map(([key, days]) => {
      days.sort((a, b) => a - b);

      const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      const median = days[Math.floor(days.length / 2)];
      const min = days[0];
      const max = days[days.length - 1];

      return {
        service_or_neighborhood: key,
        avg_days_to_close: avg,
        median_days_to_close: median,
        min_days: min,
        max_days: max,
        total_closed_cases: days.length,
      };
    });

    return results.sort((a, b) => b.total_closed_cases - a.total_closed_cases);
  }
}
