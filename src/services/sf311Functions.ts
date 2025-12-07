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

// --- Schemas ---

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
    .describe("Maximum number of results (default 100, max 1000)"),
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

const GetCaseByIdInputSchema = z.object({
  case_id: z.string().describe("The SF 311 case ID"),
});

const GetCaseStatsInputSchema = z.object({
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  service_name: z.string().optional().describe("Filter by service category"),
  supervisor_district: z
    .string()
    .optional()
    .describe("Filter by supervisor district"),
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
  top_neighborhoods: z.array(
    z.object({
      neighborhood: z.string(),
      count: z.number(),
    }),
  ),
});

const SearchNearLocationInputSchema = z.object({
  latitude: z.number().describe("Latitude of center point"),
  longitude: z.number().describe("Longitude of center point"),
  radius_meters: z
    .number()
    .optional()
    .default(500)
    .describe("Radius in meters (default 500)"),
  status: z
    .string()
    .optional()
    .describe("Filter by status (e.g., 'Open', 'Closed')"),
  service_name: z.string().optional().describe("Filter by service type"),
  days_ago: z.number().optional().describe("Only cases from last N days"),
  limit: z.number().optional().default(100).describe("Max results"),
});

const GetHotspotsInputSchema = z.object({
  analysis_type: z
    .enum(["street", "neighborhood", "district"])
    .describe("Type of hotspot analysis"),
  service_name: z.string().optional().describe("Filter by service type"),
  days: z.number().optional().default(30).describe("Time period in days"),
  min_cases: z
    .number()
    .optional()
    .default(5)
    .describe("Minimum cases to be considered a hotspot"),
  limit: z.number().optional().default(20).describe("Max results to return"),
});

const HotspotOutputSchema = z.object({
  location: z.string(),
  case_count: z.number(),
  most_common_service: z.string().optional(),
  avg_days_to_close: z.number().optional(),
});

const GetTrendsInputSchema = z.object({
  service_name: z.string().optional().describe("Filter by service type"),
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  days: z.number().optional().default(90).describe("Time period in days"),
  grouping: z
    .enum(["daily", "weekly", "monthly"])
    .optional()
    .default("weekly")
    .describe("Time grouping"),
});

const TrendDataPointSchema = z.object({
  period: z.string(),
  case_count: z.number(),
  open_count: z.number(),
  closed_count: z.number(),
});

const CompareNeighborhoodsInputSchema = z.object({
  neighborhoods: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2-5 neighborhoods to compare"),
  service_name: z.string().optional().describe("Filter by service type"),
  days: z.number().optional().default(30).describe("Time period"),
});

const NeighborhoodComparisonSchema = z.object({
  neighborhood: z.string(),
  total_cases: z.number(),
  open_cases: z.number(),
  closed_cases: z.number(),
  avg_days_to_close: z.number().optional(),
  top_service: z.string().optional(),
});

const GetServiceCatalogInputSchema = z.object({
  days: z.number().optional().default(30).describe("Time period"),
});

const GetServiceCatalogOutputSchema = z.object({
  service_types: z.array(
    z.object({
      service_name: z.string(),
      count: z.number(),
      avg_days_to_close: z.number().optional(),
    }),
  ),
});

const GetNeighborhoodListOutputSchema = z.object({
  neighborhoods: z.array(z.string()),
});

const GetRecentlyUpdatedInputSchema = z.object({
  hours: z
    .number()
    .optional()
    .default(24)
    .describe("Cases updated in last N hours"),
  status: z.string().optional().describe("Filter by status"),
  limit: z.number().optional().default(50).describe("Max results"),
});

const GetResponseTimeInputSchema = z.object({
  service_name: z.string().optional().describe("Filter by service type"),
  neighborhood: z.string().optional().describe("Filter by neighborhood"),
  days: z.number().optional().default(90).describe("Time period"),
});

const ResponseTimeOutputSchema = z.object({
  service_or_neighborhood: z.string(),
  avg_days_to_close: z.number(),
  median_days_to_close: z.number(),
  min_days: z.number(),
  max_days: z.number(),
  total_closed_cases: z.number(),
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

  @DaemoFunction({
    description:
      "Search SF 311 cases with comprehensive filtering. Can filter by status, neighborhood, service type, agency, source, media presence, and age of cases. The most versatile search function.",
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
    const query = `SELECT \`service_request_id\`, \`requested_datetime\`, \`closed_date\`, \`updated_datetime\`, \`status_description\`, \`status_notes\`, \`agency_responsible\`, \`service_name\`, \`service_subtype\`, \`service_details\`, \`address\`, \`street\`, \`supervisor_district\`, \`neighborhoods_sffind_boundaries\`, \`police_district\`, \`source\`, \`media_url\`, \`lat\`, \`long\`${whereClause} ORDER BY \`requested_datetime\` DESC LIMIT ${Math.min(limit, 1000)}`;

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
          headers: this.getAuthHeaders(),
        },
      );

      const cases = this.transformCaseData(response.data);
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
