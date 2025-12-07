// sf_311_agent/src/services/sf311.schemas.ts
import { z } from "zod";

// --- LOOKUP ---
export const GetCaseByIdSchema = z.object({
  case_id: z.string().describe("The Service Request ID (e.g. 123456)"),
});

// --- SEARCH ---
export const SearchCasesSchema = z.object({
  status: z
    .enum(["Open", "Closed"])
    .optional()
    .describe("Filter by case status"),
  neighborhood: z
    .string()
    .optional()
    .describe("San Francisco neighborhood name (e.g. 'Mission', 'Marina')"),
  category: z
    .string()
    .optional()
    .describe(
      "General category (e.g. 'Graffiti', 'Street and Sidewalk Cleaning')",
    ),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Max number of records to return"),
  days_ago: z
    .number()
    .optional()
    .describe("Filter for cases created within this many days"),
});

// --- GEO SEARCH ---
export const SearchNearbySchema = z.object({
  latitude: z.number().describe("Latitude coordinate"),
  longitude: z.number().describe("Longitude coordinate"),
  radius_meters: z.number().default(500).describe("Radius in meters to search"),
  status: z.enum(["Open", "Closed"]).optional(),
});

// --- ANALYTICS ---
export const AnalyzeComplaintsSchema = z.object({
  neighborhood: z.string().describe("The neighborhood to analyze"),
});
