// Unit tests for NIBRS Functions
import { NIBRSCrimeFunctions } from "../services/nibrsFunctions";
import { configDotenv } from "dotenv";

configDotenv();

describe("NIBRSCrimeFunctions", () => {
  let functions: NIBRSCrimeFunctions;

  beforeAll(() => {
    functions = new NIBRSCrimeFunctions();
  });

  describe("executeCustomQuery", () => {
    test("should execute a simple SELECT query", async () => {
      const result = await functions.executeCustomQuery({
        sql: "SELECT 1 as test_value",
        limit: 10,
      });

      expect(result.row_count).toBe(1);
      expect(result.results[0].test_value).toBe(1);
      expect(result.columns).toContain("test_value");
      expect(result.truncated).toBe(false);
    });

    test("should reject INSERT queries", async () => {
      await expect(
        functions.executeCustomQuery({
          sql: "INSERT INTO agencies VALUES ('test')",
          limit: 10,
        })
      ).rejects.toThrow("Only SELECT queries are allowed");
    });

    test("should reject UPDATE queries", async () => {
      await expect(
        functions.executeCustomQuery({
          sql: "UPDATE agencies SET ori = 'test'",
          limit: 10,
        })
      ).rejects.toThrow("Only SELECT queries are allowed");
    });

    test("should reject DELETE queries", async () => {
      await expect(
        functions.executeCustomQuery({
          sql: "DELETE FROM agencies WHERE ori = 'test'",
          limit: 10,
        })
      ).rejects.toThrow("Only SELECT queries are allowed");
    });

    test("should reject DROP queries", async () => {
      await expect(
        functions.executeCustomQuery({
          sql: "DROP TABLE agencies",
          limit: 10,
        })
      ).rejects.toThrow("Only SELECT queries are allowed");
    });

    test("should reject queries with DROP in SELECT", async () => {
      await expect(
        functions.executeCustomQuery({
          sql: "SELECT * FROM agencies; DROP TABLE agencies;",
          limit: 10,
        })
      ).rejects.toThrow("forbidden keyword: DROP");
    });

    test("should automatically qualify table names", async () => {
      const result = await functions.executeCustomQuery({
        sql: "SELECT COUNT(*) as count FROM agencies LIMIT 10",
        limit: 10,
      });

      expect(result.row_count).toBeGreaterThan(0);
      expect(result.results[0]).toHaveProperty("count");
    });

    test("should query agencies table for CT", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT ori, agency_name, state_abbr
          FROM agencies
          WHERE state_abbr = 'CT'
          LIMIT 5
        `,
        limit: 5,
      });

      expect(result.row_count).toBeGreaterThan(0);
      expect(result.results[0].state_abbr).toBe("CT");
      expect(result.columns).toContain("ori");
      expect(result.columns).toContain("agency_name");
    });

    test("should NOT allow city_name column (doesn't exist)", async () => {
      await expect(
        functions.executeCustomQuery({
          sql: `
            SELECT ori, agency_name, city_name
            FROM agencies
            WHERE state_abbr = 'CT'
            LIMIT 5
          `,
          limit: 5,
        })
      ).rejects.toThrow();
    });

    test("should query offense_segment for 2024 data", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT ucr_offense_code, COUNT(*) as count
          FROM offense_segment
          WHERE data_year = 2024
          GROUP BY ucr_offense_code
          ORDER BY count DESC
          LIMIT 10
        `,
        limit: 10,
      });

      expect(result.row_count).toBe(10);
      expect(result.results[0]).toHaveProperty("ucr_offense_code");
      expect(result.results[0]).toHaveProperty("count");
      expect(result.results[0].count).toBeGreaterThan(0);
    });

    test("should return empty results for 2025 LEE data (doesn't exist)", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT COUNT(*) as count
          FROM law_enforcement_employees
          WHERE data_year = 2025
        `,
        limit: 10,
      });

      expect(result.row_count).toBe(1);
      expect(result.results[0].count).toBe(0);
    });

    test("should successfully join offense_segment with agencies", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT
            ag.state_abbr,
            COUNT(*) as offense_count
          FROM offense_segment o
          JOIN agencies ag ON o.ori = ag.ori
          WHERE o.data_year = 2024
            AND ag.state_abbr = 'CA'
          GROUP BY ag.state_abbr
        `,
        limit: 10,
      });

      expect(result.row_count).toBe(1);
      expect(result.results[0].state_abbr).toBe("CA");
      expect(result.results[0].offense_count).toBeGreaterThan(0);
    });

    test("should successfully join with law_enforcement_employees for 2024", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT
            ag.state_abbr,
            COUNT(*) as offense_count,
            SUM(le.population) as total_population
          FROM offense_segment o
          JOIN law_enforcement_employees le
            ON o.ori = le.ori AND o.data_year = le.data_year
          JOIN agencies ag ON o.ori = ag.ori
          WHERE o.data_year = 2024
            AND ag.state_abbr = 'TX'
            AND le.population IS NOT NULL
          GROUP BY ag.state_abbr
        `,
        limit: 10,
      });

      expect(result.row_count).toBe(1);
      expect(result.results[0].state_abbr).toBe("TX");
      expect(result.results[0].total_population).toBeGreaterThan(0);
    });

    test("should handle limit parameter correctly", async () => {
      const result = await functions.executeCustomQuery({
        sql: "SELECT ori FROM agencies",
        limit: 5,
      });

      expect(result.row_count).toBeLessThanOrEqual(5);
      expect(result.truncated).toBe(result.row_count >= 5);
    });

    test("should enforce maximum limit of 10,000", async () => {
      const result = await functions.executeCustomQuery({
        sql: "SELECT ori FROM agencies",
        limit: 999999,  // Try to request way more than max
      });

      expect(result.row_count).toBeLessThanOrEqual(10000);
    });

    test("should correctly identify most common crime in CT for 2024", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT ucr_offense_code, COUNT(*) as count
          FROM offense_segment o
          JOIN agencies ag ON o.ori = ag.ori
          WHERE ag.state_abbr = 'CT'
            AND o.data_year = 2024
          GROUP BY ucr_offense_code
          ORDER BY count DESC
          LIMIT 1
        `,
        limit: 1,
      });

      expect(result.row_count).toBe(1);
      expect(result.results[0]).toHaveProperty("ucr_offense_code");
      expect(result.results[0]).toHaveProperty("count");
      console.log("Most common crime in CT (2024):", result.results[0]);
    });

    test("should sort CT agencies by incident count for most common crime", async () => {
      // First get most common crime
      const crimeResult = await functions.executeCustomQuery({
        sql: `
          SELECT ucr_offense_code, COUNT(*) as count
          FROM offense_segment o
          JOIN agencies ag ON o.ori = ag.ori
          WHERE ag.state_abbr = 'CT'
            AND o.data_year = 2024
          GROUP BY ucr_offense_code
          ORDER BY count DESC
          LIMIT 1
        `,
        limit: 1,
      });

      const mostCommonCrime = crimeResult.results[0].ucr_offense_code;

      // Then get agencies sorted by that crime
      const agencyResult = await functions.executeCustomQuery({
        sql: `
          SELECT
            ag.agency_name,
            ag.state_abbr,
            COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
          FROM offense_segment o
          JOIN agencies ag ON o.ori = ag.ori
          WHERE ag.state_abbr = 'CT'
            AND o.ucr_offense_code = '${mostCommonCrime}'
            AND o.data_year = 2024
          GROUP BY ag.agency_name, ag.state_abbr
          ORDER BY incident_count DESC
          LIMIT 10
        `,
        limit: 10,
      });

      expect(agencyResult.row_count).toBeGreaterThan(0);
      expect(agencyResult.results[0]).toHaveProperty("agency_name");
      expect(agencyResult.results[0]).toHaveProperty("incident_count");
      expect(agencyResult.results[0].state_abbr).toBe("CT");

      // Verify descending order
      for (let i = 1; i < agencyResult.results.length; i++) {
        expect(agencyResult.results[i - 1].incident_count).toBeGreaterThanOrEqual(
          agencyResult.results[i].incident_count
        );
      }

      console.log("Top CT agencies for", mostCommonCrime, ":");
      agencyResult.results.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.agency_name}: ${row.incident_count} incidents`);
      });
    });

    // === CTE (WITH) QUERY TESTS ===

    test("should support CTE (WITH clause) queries", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          WITH crime_counts AS (
            SELECT ucr_offense_code, COUNT(*) as count
            FROM offense_segment
            WHERE data_year = 2024
            GROUP BY ucr_offense_code
          )
          SELECT * FROM crime_counts ORDER BY count DESC LIMIT 5
        `,
        limit: 5,
      });

      expect(result.row_count).toBe(5);
      expect(result.results[0]).toHaveProperty("ucr_offense_code");
      expect(result.results[0]).toHaveProperty("count");
    });

    test("should execute single CTE query to answer: CT agencies sorted by most common crime", async () => {
      // This is the EXACT query the agent should be able to generate
      // to answer: "List all agencies in CT, sorted by most common crime statewide"
      const result = await functions.executeCustomQuery({
        sql: `
          WITH most_common_crime AS (
            SELECT ucr_offense_code
            FROM offense_segment o
            JOIN agencies ag ON o.ori = ag.ori
            WHERE ag.state_abbr = 'CT' AND o.data_year = 2024
            GROUP BY ucr_offense_code
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
          SELECT
            ag.agency_name,
            ag.state_abbr,
            mcc.ucr_offense_code as most_common_offense,
            COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
          FROM offense_segment o
          JOIN agencies ag ON o.ori = ag.ori
          CROSS JOIN most_common_crime mcc
          WHERE ag.state_abbr = 'CT'
            AND o.ucr_offense_code = mcc.ucr_offense_code
            AND o.data_year = 2024
          GROUP BY ag.agency_name, ag.state_abbr, mcc.ucr_offense_code
          ORDER BY incident_count DESC
          LIMIT 10
        `,
        limit: 10,
      });

      // Verify the query returns expected results
      expect(result.row_count).toBe(10);
      expect(result.results[0]).toHaveProperty("agency_name");
      expect(result.results[0]).toHaveProperty("most_common_offense");
      expect(result.results[0]).toHaveProperty("incident_count");
      expect(result.results[0].state_abbr).toBe("CT");
      // The most common offense should be 290 (Destruction/Damage/Vandalism)
      expect(result.results[0].most_common_offense).toBe("290");

      // Verify descending order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].incident_count).toBeGreaterThanOrEqual(
          result.results[i].incident_count
        );
      }

      console.log("=== SINGLE CTE QUERY RESULTS ===");
      console.log("Query: 'List all CT agencies sorted by most common crime (290)'");
      result.results.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.agency_name}: ${row.incident_count} incidents for offense ${row.most_common_offense}`);
      });
    });

    // === EDGE CASES ===

    test("should handle queries with multiple joins", async () => {
      const result = await functions.executeCustomQuery({
        sql: `
          SELECT
            ag.agency_name,
            ag.state_abbr,
            le.population,
            COUNT(*) as offense_count,
            ROUND((COUNT(*) * 100000.0) / le.population, 2) as rate_per_100k
          FROM offense_segment o
          JOIN agencies ag ON o.ori = ag.ori
          JOIN law_enforcement_employees le ON o.ori = le.ori AND o.data_year = le.data_year
          WHERE o.data_year = 2024
            AND ag.state_abbr = 'CT'
            AND le.population IS NOT NULL
            AND le.population > 50000
          GROUP BY ag.agency_name, ag.state_abbr, le.population
          ORDER BY rate_per_100k DESC
          LIMIT 5
        `,
        limit: 5,
      });

      expect(result.row_count).toBeGreaterThan(0);
      expect(result.results[0]).toHaveProperty("agency_name");
      expect(result.results[0]).toHaveProperty("population");
      expect(result.results[0]).toHaveProperty("rate_per_100k");
      console.log("Top CT agencies by crime rate per 100k (pop > 50k):", result.results);
    });
  });
});
