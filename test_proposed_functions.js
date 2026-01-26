// Test suite for all proposed NIBRS functions
// This validates SQL queries against actual BigQuery data before implementation

const { BigQuery } = require("@google-cloud/bigquery");
const dotenv = require("dotenv");

dotenv.config();

const PROJECT_ID = "daemo-daemon-testing";
const DATASET = "nibrs_data";

class FunctionTester {
  constructor() {
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON not set");
    }

    const credentials = JSON.parse(serviceAccountJson);
    this.bigquery = new BigQuery({
      projectId: PROJECT_ID,
      credentials,
    });

    this.passedTests = 0;
    this.failedTests = 0;
    this.testResults = [];
  }

  async runQuery(sql) {
    const [rows] = await this.bigquery.query({ query: sql, location: "US" });
    return rows;
  }

  async test(name, sql, validator) {
    try {
      console.log(`\n🧪 Testing: ${name}`);
      console.log(`SQL Preview: ${sql.substring(0, 150)}...`);

      const start = Date.now();
      const results = await this.runQuery(sql);
      const duration = Date.now() - start;

      if (validator) {
        validator(results);
      }

      this.passedTests++;
      this.testResults.push({
        name,
        status: "PASS",
        duration,
        rowCount: results.length,
        sampleRow: results[0] || null
      });
      console.log(`✅ PASS (${duration}ms, ${results.length} rows)`);
      if (results[0]) {
        console.log(`   Sample columns: ${Object.keys(results[0]).join(", ")}`);
        console.log(`   Sample row:`, JSON.stringify(results[0]).substring(0, 200));
      }
    } catch (error) {
      this.failedTests++;
      this.testResults.push({
        name,
        status: "FAIL",
        error: error.message
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
  }

  printSummary() {
    console.log("\n" + "=".repeat(80));
    console.log(`TEST SUMMARY: ${this.passedTests} passed, ${this.failedTests} failed`);
    console.log("=".repeat(80));

    if (this.failedTests > 0) {
      console.log("\n❌ FAILED TESTS:");
      this.testResults
        .filter(r => r.status === "FAIL")
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    if (this.passedTests === this.testResults.length) {
      console.log("\n🎉 ALL TESTS PASSED! Ready for implementation.");
    }
  }
}

async function main() {
  const tester = new FunctionTester();

  // =========================================================================
  // CATEGORY 1: CORE AGGREGATION
  // =========================================================================

  // Test 1: getOffenseCounts - Basic count
  await tester.test(
    "getOffenseCounts - Homicides in California 2024",
    `
    SELECT
      ag.state_abbr,
      o.ucr_offense_code,
      COUNT(*) as offense_count,
      COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    WHERE o.ucr_offense_code = '09A'
      AND ag.state_abbr = 'CA'
      AND o.data_year = 2024
    GROUP BY ag.state_abbr, o.ucr_offense_code
    `,
    (results) => {
      if (results.length === 0) throw new Error("Expected at least one result");
      if (!results[0].offense_count) throw new Error("Missing offense_count");
    }
  );

  // Test 2: getOffenseCounts - Group by multiple fields
  await tester.test(
    "getOffenseCounts - Top 10 offense types nationally",
    `
    SELECT
      o.ucr_offense_code,
      COUNT(*) as offense_count
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    WHERE o.data_year = 2024
    GROUP BY o.ucr_offense_code
    ORDER BY offense_count DESC
    LIMIT 10
    `,
    (results) => {
      if (results.length !== 10) throw new Error("Expected 10 results");
    }
  );

  // Test 3: getOffenseCounts - With weapon filter
  await tester.test(
    "getOffenseCounts - Robberies with weapons in Texas",
    `
    SELECT
      COUNT(*) as offense_count
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    WHERE o.ucr_offense_code = '120'
      AND ag.state_abbr = 'TX'
      AND o.data_year = 2024
      AND o.type_weapon_force_involved1 IS NOT NULL
    `
  );

  // Test 4: getOffenseRates - State-level rates
  await tester.test(
    "getOffenseRates - Homicide rates by state 2024",
    `
    SELECT
      ag.state_abbr,
      COUNT(*) as offense_count,
      SUM(le.population) as total_population,
      ROUND((COUNT(*) * 100000.0) / NULLIF(SUM(le.population), 0), 2) as rate_per_100k
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON o.ori = le.ori AND o.data_year = le.data_year
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    WHERE o.ucr_offense_code = '09A'
      AND o.data_year = 2024
      AND le.population IS NOT NULL
    GROUP BY ag.state_abbr
    ORDER BY rate_per_100k DESC
    LIMIT 10
    `,
    (results) => {
      if (!results[0].rate_per_100k) throw new Error("Missing rate_per_100k");
    }
  );

  // Test 5: getOffenseRates - Agency-level with population filter
  await tester.test(
    "getOffenseRates - Violent crime rates in cities >100k population",
    `
    SELECT
      ag.agency_name,
      ag.state_abbr,
      le.population,
      COUNT(*) as offense_count,
      ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON o.ori = le.ori AND o.data_year = le.data_year
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    WHERE o.ucr_offense_code IN ('09A', '09B', '120', '13A')
      AND o.data_year = 2024
      AND le.population IS NOT NULL
      AND le.population >= 100000
    GROUP BY ag.agency_name, ag.state_abbr, le.population
    ORDER BY rate_per_100k DESC
    LIMIT 20
    `
  );

  // Test 6: getIncidentDetails - Mass casualty incidents
  await tester.test(
    "getIncidentDetails - Incidents with 4+ victims",
    `
    SELECT
      a.incident_number,
      a.ori,
      ag.agency_name,
      ag.state_abbr,
      a.incident_date,
      a.incident_date_hour,
      a.total_victim_segments,
      a.total_offense_segments
    FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
    WHERE a.data_year = 2024
      AND a.total_victim_segments >= 4
    ORDER BY a.total_victim_segments DESC
    LIMIT 10
    `
  );

  // Test 7: getClearanceStats - National clearance rate for homicides
  await tester.test(
    "getClearanceStats - Homicide clearance rates by state",
    `
    SELECT
      ag.state_abbr,
      COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)) as total_incidents,
      SUM(CASE WHEN a.total_arrestee_segments > 0 THEN 1 ELSE 0 END) as incidents_with_arrests,
      ROUND(100.0 * SUM(CASE WHEN a.total_arrestee_segments > 0 THEN 1 ELSE 0 END) /
        NULLIF(COUNT(DISTINCT CONCAT(a.ori, '-', a.incident_number)), 0), 2) as clearance_rate_pct
    FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON a.ori = ag.ori
    JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      ON a.ori = o.ori AND a.incident_number = o.incident_number
    WHERE a.data_year = 2024
      AND o.ucr_offense_code = '09A'
    GROUP BY ag.state_abbr
    HAVING total_incidents >= 10
    ORDER BY clearance_rate_pct DESC
    LIMIT 10
    `
  );

  // Test 8: getAgencyList - Agencies in a state with population
  await tester.test(
    "getAgencyList - Florida agencies with population >100k",
    `
    SELECT
      ag.ori,
      ag.agency_name,
      ag.state_abbr,
      ag.counties,
      ag.agency_type_name,
      le.population,
      le.officer_ct
    FROM \`${PROJECT_ID}.${DATASET}.agencies\` ag
    JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON ag.ori = le.ori AND le.data_year = 2024
    WHERE ag.state_abbr = 'FL'
      AND le.population IS NOT NULL
      AND le.population >= 100000
    ORDER BY le.population DESC
    LIMIT 20
    `
  );

  // =========================================================================
  // CATEGORY 2: TEMPORAL ANALYSIS
  // =========================================================================

  // Test 9: getOffensesByTimeOfDay
  await tester.test(
    "getOffensesByTimeOfDay - Aggravated assault patterns",
    `
    SELECT
      a.incident_date_hour as hour_of_day,
      COUNT(*) as offense_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
    JOIN \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      ON a.ori = o.ori AND a.incident_number = o.incident_number
    WHERE a.data_year = 2024
      AND a.incident_date_hour IS NOT NULL
      AND o.ucr_offense_code = '13A'
    GROUP BY a.incident_date_hour
    ORDER BY a.incident_date_hour
    `,
    (results) => {
      if (results.length < 20) throw new Error("Expected data for most hours");
    }
  );

  // Test 10: getOffensesByDayOfWeek
  await tester.test(
    "getOffensesByDayOfWeek - Weekly crime patterns",
    `
    SELECT
      EXTRACT(DAYOFWEEK FROM a.incident_date) as day_of_week,
      CASE EXTRACT(DAYOFWEEK FROM a.incident_date)
        WHEN 1 THEN 'Sunday'
        WHEN 2 THEN 'Monday'
        WHEN 3 THEN 'Tuesday'
        WHEN 4 THEN 'Wednesday'
        WHEN 5 THEN 'Thursday'
        WHEN 6 THEN 'Friday'
        WHEN 7 THEN 'Saturday'
      END as day_name,
      COUNT(*) as offense_count
    FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
    WHERE a.data_year = 2024
    GROUP BY day_of_week, day_name
    ORDER BY day_of_week
    `,
    (results) => {
      if (results.length !== 7) throw new Error("Expected 7 days");
    }
  );

  // Test 11: getOffensesByMonth
  await tester.test(
    "getOffensesByMonth - Seasonal patterns",
    `
    SELECT
      EXTRACT(MONTH FROM a.incident_date) as month_num,
      FORMAT_DATE('%B', a.incident_date) as month_name,
      COUNT(*) as offense_count
    FROM \`${PROJECT_ID}.${DATASET}.administrative_segment\` a
    WHERE a.data_year = 2024
    GROUP BY month_num, month_name
    ORDER BY month_num
    `,
    (results) => {
      if (results.length < 10) throw new Error("Expected data for most months");
    }
  );

  // Test 12: getYearOverYearTrends
  await tester.test(
    "getYearOverYearTrends - National crime trends 2020-2024",
    `
    WITH yearly_counts AS (
      SELECT
        o.data_year,
        COUNT(*) as offense_count,
        COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      WHERE o.data_year BETWEEN 2020 AND 2024
      GROUP BY o.data_year
    )
    SELECT
      data_year,
      offense_count,
      incident_count,
      LAG(offense_count) OVER (ORDER BY data_year) as prev_year_count,
      offense_count - LAG(offense_count) OVER (ORDER BY data_year) as yoy_change,
      ROUND(100.0 * (offense_count - LAG(offense_count) OVER (ORDER BY data_year)) /
        NULLIF(LAG(offense_count) OVER (ORDER BY data_year), 0), 2) as yoy_pct_change
    FROM yearly_counts
    ORDER BY data_year
    `,
    (results) => {
      if (results.length !== 5) throw new Error("Expected 5 years");
    }
  );

  // Test 13: getYearOverYearTrends - With rates
  await tester.test(
    "getYearOverYearTrends - Homicide rates over time",
    `
    WITH yearly_counts AS (
      SELECT
        o.data_year,
        COUNT(*) as offense_count,
        SUM(le.population) as total_population
      FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
      JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
        ON o.ori = le.ori AND o.data_year = le.data_year
      WHERE o.data_year BETWEEN 2020 AND 2024
        AND o.ucr_offense_code = '09A'
        AND le.population IS NOT NULL
      GROUP BY o.data_year
    )
    SELECT
      data_year,
      offense_count,
      total_population,
      ROUND((offense_count * 100000.0) / NULLIF(total_population, 0), 2) as rate_per_100k,
      LAG(offense_count) OVER (ORDER BY data_year) as prev_year_count
    FROM yearly_counts
    ORDER BY data_year
    `
  );

  // =========================================================================
  // CATEGORY 3: DEMOGRAPHIC ANALYSIS
  // =========================================================================

  // Test 14: getVictimDemographics - By sex and race
  await tester.test(
    "getVictimDemographics - Homicide victim demographics",
    `
    SELECT
      v.sex_of_victim,
      v.race_of_victim,
      COUNT(*) as victim_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
    WHERE v.type_of_victim = 'I'
      AND v.data_year = 2024
      AND v.ucr_offense_code1 = '09A'
      AND v.sex_of_victim IS NOT NULL
      AND v.race_of_victim IS NOT NULL
    GROUP BY v.sex_of_victim, v.race_of_victim
    ORDER BY victim_count DESC
    `
  );

  // Test 15: getVictimDemographics - Age distribution
  await tester.test(
    "getVictimDemographics - Victim age groups",
    `
    SELECT
      CASE
        WHEN SAFE_CAST(v.age_of_victim AS FLOAT64) < 18 THEN 'Juvenile'
        WHEN SAFE_CAST(v.age_of_victim AS FLOAT64) BETWEEN 18 AND 24 THEN '18-24'
        WHEN SAFE_CAST(v.age_of_victim AS FLOAT64) BETWEEN 25 AND 34 THEN '25-34'
        WHEN SAFE_CAST(v.age_of_victim AS FLOAT64) BETWEEN 35 AND 49 THEN '35-49'
        WHEN SAFE_CAST(v.age_of_victim AS FLOAT64) BETWEEN 50 AND 64 THEN '50-64'
        WHEN SAFE_CAST(v.age_of_victim AS FLOAT64) >= 65 THEN '65+'
        ELSE 'Unknown'
      END as age_group,
      COUNT(*) as victim_count
    FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
    WHERE v.type_of_victim = 'I'
      AND v.data_year = 2024
      AND v.ucr_offense_code1 IN ('09A', '120', '13A')
    GROUP BY age_group
    ORDER BY victim_count DESC
    `
  );

  // Test 16: getArresteeDemographics
  await tester.test(
    "getArresteeDemographics - Arrestee race/sex breakdown",
    `
    SELECT
      ar.sex_of_arrestee,
      ar.race_of_arrestee,
      COUNT(*) as arrestee_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
    WHERE ar.data_year = 2024
      AND ar.sex_of_arrestee IS NOT NULL
      AND ar.race_of_arrestee IS NOT NULL
    GROUP BY ar.sex_of_arrestee, ar.race_of_arrestee
    ORDER BY arrestee_count DESC
    LIMIT 20
    `
  );

  // Test 17: getArresteeDemographics - Juvenile arrests
  await tester.test(
    "getArresteeDemographics - Juvenile vs adult arrests",
    `
    SELECT
      CASE
        WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) < 18 THEN 'Juvenile'
        WHEN SAFE_CAST(ar.age_of_arrestee AS INT64) >= 18 THEN 'Adult'
        ELSE 'Unknown'
      END as age_category,
      COUNT(*) as arrestee_count
    FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
    WHERE ar.data_year = 2024
    GROUP BY age_category
    ORDER BY arrestee_count DESC
    `
  );

  // Test 18: getVictimOffenderRelationships
  await tester.test(
    "getVictimOffenderRelationships - Relationship patterns",
    `
    SELECT
      v.victim_relationship_to_offender1 as relationship,
      COUNT(*) as count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
    WHERE v.type_of_victim = 'I'
      AND v.data_year = 2024
      AND v.victim_relationship_to_offender1 IS NOT NULL
      AND v.ucr_offense_code1 = '13A'
    GROUP BY relationship
    ORDER BY count DESC
    LIMIT 20
    `
  );

  // Test 19: getInjuryTypes
  await tester.test(
    "getInjuryTypes - Assault injury patterns",
    `
    SELECT
      v.type_of_injury1 as injury_type,
      COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET}.victim_segment\` v
    WHERE v.type_of_victim = 'I'
      AND v.data_year = 2024
      AND v.type_of_injury1 IS NOT NULL
      AND v.ucr_offense_code1 IN ('13A', '13B')
    GROUP BY injury_type
    ORDER BY count DESC
    `
  );

  // =========================================================================
  // CATEGORY 4: WEAPON & LOCATION
  // =========================================================================

  // Test 20: getWeaponInvolvement
  await tester.test(
    "getWeaponInvolvement - Weapons in robberies",
    `
    SELECT
      o.type_weapon_force_involved1 as weapon_type,
      COUNT(*) as offense_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    WHERE o.data_year = 2024
      AND o.ucr_offense_code = '120'
      AND o.type_weapon_force_involved1 IS NOT NULL
    GROUP BY weapon_type
    ORDER BY offense_count DESC
    `
  );

  // Test 21: getLocationTypes
  await tester.test(
    "getLocationTypes - Where burglaries occur",
    `
    SELECT
      o.location_type,
      COUNT(*) as offense_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    WHERE o.data_year = 2024
      AND o.ucr_offense_code = '220'
      AND o.location_type IS NOT NULL
    GROUP BY location_type
    ORDER BY offense_count DESC
    `
  );

  // =========================================================================
  // CATEGORY 5: COMPARISON & RANKING
  // =========================================================================

  // Test 22: rankAgenciesByCrime - Top 20 safest/most dangerous
  await tester.test(
    "rankAgenciesByCrime - Safest cities >100k",
    `
    SELECT
      ag.agency_name,
      ag.state_abbr,
      le.population,
      COUNT(*) as offense_count,
      ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON o.ori = le.ori AND o.data_year = le.data_year
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    WHERE o.data_year = 2024
      AND le.population IS NOT NULL
      AND le.population >= 100000
    GROUP BY ag.agency_name, ag.state_abbr, le.population
    ORDER BY rate_per_100k ASC
    LIMIT 20
    `
  );

  // Test 23: compareAgencies - Multiple specific agencies
  await tester.test(
    "compareAgencies - NYPD vs LAPD vs Chicago (by name search)",
    `
    SELECT
      ag.agency_name,
      ag.state_abbr,
      le.population,
      COUNT(*) as total_offenses,
      ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k,
      SUM(CASE WHEN o.ucr_offense_code IN ('09A', '09B') THEN 1 ELSE 0 END) as homicides,
      SUM(CASE WHEN o.ucr_offense_code = '120' THEN 1 ELSE 0 END) as robberies
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON o.ori = le.ori AND o.data_year = le.data_year
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    WHERE o.data_year = 2024
      AND le.population IS NOT NULL
      AND (
        ag.agency_name LIKE '%New York%Police%'
        OR ag.agency_name LIKE '%Los Angeles%Police%'
        OR ag.agency_name LIKE '%Chicago%Police%'
      )
    GROUP BY ag.agency_name, ag.state_abbr, le.population
    ORDER BY le.population DESC
    `
  );

  // Test 24: getPeerComparison - Similar-sized agencies
  await tester.test(
    "getPeerComparison - Cities similar to Austin TX",
    `
    WITH target_city AS (
      SELECT le.population
      FROM \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON le.ori = ag.ori
      WHERE ag.agency_name LIKE '%Austin%Police%'
        AND ag.state_abbr = 'TX'
        AND le.data_year = 2024
      LIMIT 1
    )
    SELECT
      ag.agency_name,
      ag.state_abbr,
      le.population,
      COUNT(*) as offense_count,
      ROUND((COUNT(*) * 100000.0) / NULLIF(le.population, 0), 2) as rate_per_100k
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON o.ori = le.ori AND o.data_year = le.data_year
    JOIN \`${PROJECT_ID}.${DATASET}.agencies\` ag ON o.ori = ag.ori
    CROSS JOIN target_city tc
    WHERE o.data_year = 2024
      AND le.population IS NOT NULL
      AND le.population BETWEEN tc.population * 0.8 AND tc.population * 1.2
    GROUP BY ag.agency_name, ag.state_abbr, le.population
    ORDER BY rate_per_100k
    LIMIT 20
    `
  );

  // =========================================================================
  // CATEGORY 6: SPECIALIZED
  // =========================================================================

  // Test 25: getHateCrimeStats
  await tester.test(
    "getHateCrimeStats - Bias motivation breakdown",
    `
    SELECT
      o.bias_motivation,
      COUNT(*) as offense_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_total
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    WHERE o.data_year = 2024
      AND o.bias_motivation IS NOT NULL
      AND o.bias_motivation != '88'
    GROUP BY bias_motivation
    ORDER BY offense_count DESC
    `
  );

  // Test 26: getArrestStats
  await tester.test(
    "getArrestStats - Arrest patterns by offense type",
    `
    SELECT
      ar.ucr_arrest_offense_code,
      COUNT(*) as arrest_count,
      COUNT(DISTINCT ar.ori || '-' || ar.incident_number) as incidents_with_arrests
    FROM \`${PROJECT_ID}.${DATASET}.arrestee_segment\` ar
    WHERE ar.data_year = 2024
    GROUP BY ar.ucr_arrest_offense_code
    ORDER BY arrest_count DESC
    LIMIT 20
    `
  );

  // Test 27: searchAgencies
  await tester.test(
    "searchAgencies - Find agencies by name",
    `
    SELECT
      ori,
      agency_name,
      state_abbr,
      counties,
      agency_type_name
    FROM \`${PROJECT_ID}.${DATASET}.agencies\`
    WHERE LOWER(agency_name) LIKE '%chicago%'
      OR LOWER(counties) LIKE '%cook%'
    ORDER BY
      CASE
        WHEN LOWER(agency_name) LIKE 'chicago%' THEN 1
        ELSE 2
      END,
      agency_name
    LIMIT 20
    `
  );

  // =========================================================================
  // EDGE CASES & VALIDATION
  // =========================================================================

  // Test 28: Data completeness check
  await tester.test(
    "Data Validation - Check for NULL handling",
    `
    SELECT
      COUNT(*) as total_records,
      COUNT(CASE WHEN ori IS NULL THEN 1 END) as null_ori,
      COUNT(CASE WHEN incident_number IS NULL THEN 1 END) as null_incident,
      COUNT(CASE WHEN ucr_offense_code IS NULL THEN 1 END) as null_offense_code
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\`
    WHERE data_year = 2024
    `
  );

  // Test 29: Population join validation
  await tester.test(
    "Data Validation - Population data availability",
    `
    SELECT
      o.data_year,
      COUNT(DISTINCT o.ori) as total_agencies,
      COUNT(DISTINCT CASE WHEN le.population IS NOT NULL THEN o.ori END) as agencies_with_population,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN le.population IS NOT NULL THEN o.ori END) /
        COUNT(DISTINCT o.ori), 2) as pct_coverage
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\` o
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\` le
      ON o.ori = le.ori AND o.data_year = le.data_year
    WHERE o.data_year = 2024
    GROUP BY o.data_year
    `
  );

  // Test 30: Year range validation
  await tester.test(
    "Data Validation - Available years in each table",
    `
    SELECT
      'offense' as table_name,
      MIN(data_year) as min_year,
      MAX(data_year) as max_year,
      COUNT(DISTINCT data_year) as year_count
    FROM \`${PROJECT_ID}.${DATASET}.offense_segment\`
    UNION ALL
    SELECT
      'lee' as table_name,
      MIN(data_year) as min_year,
      MAX(data_year) as max_year,
      COUNT(DISTINCT data_year) as year_count
    FROM \`${PROJECT_ID}.${DATASET}.law_enforcement_employees\`
    `
  );

  tester.printSummary();
}

// Run all tests
main().catch(console.error);
