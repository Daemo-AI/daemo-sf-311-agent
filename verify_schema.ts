// Quick script to verify the BigQuery schema
import { BigQuery } from "@google-cloud/bigquery";
import { configDotenv } from "dotenv";

configDotenv();

const PROJECT_ID = "daemo-daemon-testing";
const DATASET = "nibrs_data";

async function verifySchema() {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!serviceAccountJson) {
    console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON not set");
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountJson);
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    credentials,
  });

  console.log("=== Checking agencies table columns ===");
  const agenciesQuery = `
    SELECT column_name, data_type
    FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'agencies'
    ORDER BY ordinal_position
  `;
  const [agenciesColumns] = await bigquery.query({ query: agenciesQuery, location: "US" });
  console.log("Agencies table columns:");
  agenciesColumns.forEach((col: any) => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });

  console.log("\n=== Checking offense_segment table columns ===");
  const offenseQuery = `
    SELECT column_name, data_type
    FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'offense_segment'
    ORDER BY ordinal_position
  `;
  const [offenseColumns] = await bigquery.query({ query: offenseQuery, location: "US" });
  console.log("Offense_segment table columns:");
  offenseColumns.forEach((col: any) => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });

  console.log("\n=== Checking law_enforcement_employees table columns ===");
  const leeQuery = `
    SELECT column_name, data_type
    FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'law_enforcement_employees'
    ORDER BY ordinal_position
  `;
  const [leeColumns] = await bigquery.query({ query: leeQuery, location: "US" });
  console.log("Law_enforcement_employees table columns:");
  leeColumns.forEach((col: any) => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });

  console.log("\n=== Checking data_year ranges ===");
  const yearRangesQuery = `
    SELECT
      'offense_segment' as table_name,
      MIN(data_year) as min_year,
      MAX(data_year) as max_year,
      COUNT(DISTINCT data_year) as distinct_years
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\`
    UNION ALL
    SELECT
      'law_enforcement_employees' as table_name,
      MIN(data_year) as min_year,
      MAX(data_year) as max_year,
      COUNT(DISTINCT data_year) as distinct_years
    FROM \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\`
  `;
  const [yearRanges] = await bigquery.query({ query: yearRangesQuery, location: "US" });
  console.log("Year ranges:");
  yearRanges.forEach((row: any) => {
    console.log(`  ${row.table_name}: ${row.min_year} - ${row.max_year} (${row.distinct_years} years)`);
  });

  console.log("\n=== Sample agencies query (CT state) ===");
  const sampleQuery = `
    SELECT ori, agency_name, state_abbr, city_name
    FROM \`${PROJECT_ID}.${DATASET}.agencies\`
    WHERE state_abbr = 'CT'
    LIMIT 5
  `;
  const [samples] = await bigquery.query({ query: sampleQuery, location: "US" });
  console.log("Sample CT agencies:");
  samples.forEach((row: any) => {
    console.log(`  ${row.ori}: ${row.agency_name} (${row.city_name})`);
  });

  console.log("\n=== Most common UCR offense codes in 2024 ===");
  const offenseCodesQuery = `
    SELECT ucr_offense_code, COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\`
    WHERE data_year = 2024
    GROUP BY ucr_offense_code
    ORDER BY count DESC
    LIMIT 10
  `;
  const [offenseCodes] = await bigquery.query({ query: offenseCodesQuery, location: "US" });
  console.log("Top offense codes in 2024:");
  offenseCodes.forEach((row: any) => {
    console.log(`  ${row.ucr_offense_code}: ${row.count}`);
  });
}

verifySchema().catch(console.error);
