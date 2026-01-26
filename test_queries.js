// Quick test to verify BigQuery access and explore schema
const { BigQuery } = require("@google-cloud/bigquery");
const dotenv = require("dotenv");

dotenv.config();

const PROJECT_ID = "daemo-daemon-testing";
const DATASET = "nibrs_data";

async function testQuery() {
  try {
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

    // Test 1: Check if offender_segment table exists
    console.log("=== Test 1: Checking for offender_segment table ===");
    const query1 = `
      SELECT table_name 
      FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name LIKE '%offender%'
    `;
    const [tables] = await bigquery.query({ query: query1, location: "US" });
    console.log("Offender tables:", tables);

    // Test 2: Sample from offense_segment to understand structure
    console.log("\n=== Test 2: Sample offense_segment ===");
    const query2 = `
      SELECT * 
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\`
      WHERE data_year = 2024
      LIMIT 3
    `;
    const [rows2] = await bigquery.query({ query: query2, location: "US" });
    console.log("Offense columns:", Object.keys(rows2[0] || {}));
    console.log("Sample row:", rows2[0]);

    // Test 3: Check data_year range
    console.log("\n=== Test 3: Data year ranges ===");
    const query3 = `
      SELECT 
        'offense_segment' as table_name,
        MIN(data_year) as min_year, 
        MAX(data_year) as max_year,
        COUNT(*) as row_count
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\`
      UNION ALL
      SELECT 
        'law_enforcement_employees' as table_name,
        MIN(data_year) as min_year, 
        MAX(data_year) as max_year,
        COUNT(*) as row_count
      FROM \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\`
    `;
    const [rows3] = await bigquery.query({ query: query3, location: "US" });
    console.log("Data ranges:", rows3);

    console.log("\n=== All tests passed ===");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

testQuery();
