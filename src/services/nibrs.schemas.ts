// src/services/nibrs.schemas.ts
// Zod schemas for NIBRS BigQuery executeCustomQuery function

import { z } from "zod";

// =============================================================================
//  CUSTOM QUERY INPUT/OUTPUT SCHEMAS
// =============================================================================

export const ExecuteCustomQueryInput = z.object({
  sql: z
    .string()
    .describe(
      "Custom SQL query to execute against the NIBRS BigQuery database. Must be SELECT only. Available tables: agencies, administrative_segment, offense_segment, victim_segment, arrestee_segment, law_enforcement_employees. All in dataset 'daemo-daemon-testing.nibrs_data'.",
    ),
  limit: z
    .number()
    .nullish()
    .transform((val) => val ?? 10000)
    .describe("Maximum rows to return (capped at 10000)"),
});

export const CustomQueryOutput = z.object({
  results: z.array(z.record(z.string(), z.any())),
  row_count: z.number(),
  columns: z.array(z.string()),
  truncated: z.boolean(),
});
