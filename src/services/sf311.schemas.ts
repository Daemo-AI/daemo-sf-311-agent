/*
 * =========================================================================================
 *  EXAMPLE SCHEMAS
 * =========================================================================================
 *
 * This file defines the Zod schemas used by the SF311Functions example service.
 * Schemas allow the AI to strictly validate inputs and outputs.
 *
 * When building your own service, define your input/output schemas in a similar way.
 * =========================================================================================
 */

import { z } from "zod";

// --- GEOCODING ---
export const GeocodeAddressSchema = z.object({
  address: z
    .string()
    .describe(
      "The street address or landmark to look up (e.g. 'Golden Gate Park', '500 Market St')",
    ),
});

// --- LOOKUP ---
export const GetCaseByIdSchema = z.object({
  case_id: z.string().describe("The Service Request ID (e.g. 172340)"),
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
    .describe(
      "San Francisco neighborhood name (e.g. 'Mission', 'Marina', 'Tenderloin')",
    ),
  category: z
    .string()
    .optional()
    .describe(
      "General category (e.g. 'Graffiti', 'Street and Sidewalk Cleaning', 'Encampments')",
    ),
  limit: z
    .number()
    .optional()
    .default(10)
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
  radius_meters: z
    .number()
    .default(300)
    .describe("Radius in meters to search (default 300m)"),
  status: z.enum(["Open", "Closed"]).optional(),
});

// --- ANALYTICS ---
export const AgencyAnalyticsSchema = z.object({
  limit: z.number().optional().default(5),
});

export const NeighborhoodAnalyticsSchema = z.object({
  neighborhood: z.string().describe("The neighborhood to analyze"),
});

export const StalledCasesSchema = z.object({
  days_open: z
    .number()
    .default(30)
    .describe("Minimum number of days the case has been open"),
  neighborhood: z.string().optional().describe("Optional neighborhood filter"),
});
