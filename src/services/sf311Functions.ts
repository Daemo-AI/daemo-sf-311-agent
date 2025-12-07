// sf_311_agent/src/services/sf311Functions.ts
import { DaemoFunction } from "daemo-engine";
import { z } from "zod";
import { SocrataClient } from "./socrataClient";
import { SF311Case, SF311CaseStats } from "../utils/interfaces";
import {
  GetCaseByIdSchema,
  SearchCasesSchema,
  SearchNearbySchema,
  AnalyzeComplaintsSchema,
} from "./sf311.schemas";

export class SF311Functions {
  private client: SocrataClient;

  constructor() {
    this.client = new SocrataClient();
  }

  @DaemoFunction({
    description:
      "Get details of a specific 311 case by its Case ID (Service Request ID).",
    tags: ["311", "lookup"],
    inputSchema: GetCaseByIdSchema,
    outputSchema: z.any(), // Returns the raw case object
  })
  async getCaseById(
    input: z.infer<typeof GetCaseByIdSchema>,
  ): Promise<SF311Case | null> {
    // SoQL: SELECT * WHERE service_request_id = '...'
    const query = `SELECT * WHERE service_request_id = '${input.case_id}'`;
    const results = await this.client.executeQuery<SF311Case>(query);
    return results.length > 0 ? results[0] : null;
  }

  @DaemoFunction({
    description:
      "Search for 311 cases based on filters like status, neighborhood, or category.",
    tags: ["311", "search"],
    inputSchema: SearchCasesSchema,
    outputSchema: z.array(z.any()),
  })
  async searchCases(
    input: z.infer<typeof SearchCasesSchema>,
  ): Promise<SF311Case[]> {
    // Build SoQL WHERE clauses
    const conditions: string[] = [];

    if (input.status) {
      // status_description often maps to Open/Closed but might vary slightly
      // Using LIKE for flexibility
      conditions.push(`status_description LIKE '%${input.status}%'`);
    }

    if (input.neighborhood) {
      conditions.push(
        `neighborhoods_sffind_boundaries = '${input.neighborhood}'`,
      );
    }

    if (input.category) {
      conditions.push(`service_name = '${input.category}'`);
    }

    if (input.days_ago) {
      // SoQL date math
      conditions.push(
        `requested_datetime > date_trunc_ymd(now()) - 'P${input.days_ago}D'`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = `LIMIT ${input.limit}`;
    const orderClause = `ORDER BY requested_datetime DESC`;

    const query = `SELECT service_request_id, requested_datetime, status_description, service_name, service_details, address, neighborhoods_sffind_boundaries ${whereClause} ${orderClause} ${limitClause}`;

    return await this.client.executeQuery<SF311Case>(query);
  }

  @DaemoFunction({
    description:
      "Find cases within a specific radius of a latitude/longitude coordinate.",
    tags: ["311", "geo"],
    inputSchema: SearchNearbySchema,
    outputSchema: z.array(z.any()),
  })
  async findCasesNearby(
    input: z.infer<typeof SearchNearbySchema>,
  ): Promise<SF311Case[]> {
    // SoQL within_circle(point_geom, lat, long, radius)
    // Note: Socrata standard is usually (lat, long, radius) or point construct

    let whereClause = `WHERE within_circle(point, ${input.latitude}, ${input.longitude}, ${input.radius_meters})`;

    if (input.status) {
      whereClause += ` AND status_description LIKE '%${input.status}%'`;
    }

    const query = `SELECT service_request_id, service_name, address, status_description, point ${whereClause} ORDER BY requested_datetime DESC LIMIT 10`;

    return await this.client.executeQuery<SF311Case>(query);
  }

  @DaemoFunction({
    description:
      "Analyze the most frequent types of complaints in a specific neighborhood.",
    tags: ["311", "analytics"],
    inputSchema: AnalyzeComplaintsSchema,
    outputSchema: z.array(z.any()),
  })
  async analyzeNeighborhoodIssues(
    input: z.infer<typeof AnalyzeComplaintsSchema>,
  ): Promise<SF311CaseStats[]> {
    // Aggregation Query
    const query = `
      SELECT service_name as category, count(*) as count 
      WHERE neighborhoods_sffind_boundaries = '${input.neighborhood}' 
      GROUP BY service_name 
      ORDER BY count DESC 
      LIMIT 10
    `;

    return await this.client.executeQuery<SF311CaseStats>(query);
  }
}
