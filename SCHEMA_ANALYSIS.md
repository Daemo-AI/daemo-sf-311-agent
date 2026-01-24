# FBI NIBRS Agent - Critical Schema & Implementation Issues

## Executive Summary

The agent has **severe issues** that explain why it struggles with even simple queries:

1. **Only ONE function implemented** (executeCustomQuery) - requires LLM to write SQL for everything
2. **Schema documentation has ERRORS** - references columns that don't exist
3. **Year mismatch** - System prompt defaults to 2025 but law_enforcement_employees only has data through 2024
4. **Missing 20+ functions** - All defined schemas are unused
5. **NO TESTS** - Zero test coverage

---

## Issue #1: Schema Documentation Errors

### ❌ WRONG: `city_name` Column Does Not Exist

**System Prompt Says** (line 494 in daemoService.ts):
```
| city_name         | STRING  | City where agency is located                                   |
```

**Reality**: The `agencies` table has **NO `city_name` column**!

**Actual Agencies Table Schema**:
```
ori: STRING
counties: STRING
is_nibrs: BOOL
latitude: FLOAT64
longitude: FLOAT64
state_abbr: STRING
state_name: STRING            ✅ This exists (correct)
agency_name: STRING
agency_type_name: STRING
nibrs_start_date: DATE
```

**Impact**: Any query the LLM writes that references `city_name` will FAIL with error:
```
Unrecognized name: city_name
```

---

## Issue #2: Year Range Mismatch - DATA UNAVAILABLE

### ❌ CRITICAL: Default to 2025 but LEE data only through 2024

**System Prompt Says** (lines 692-695):
```
⚠️ **MANDATORY RULE**: When analyzing crime data WITHOUT a specified time period:
- **ALWAYS use data_year = 2025** (single most recent complete year)
```

**Reality - Actual Year Ranges**:
- **offense_segment**: 2020-2025 (6 years) ✅
- **law_enforcement_employees**: 1960-2024 (65 years) ❌ **NO 2025 DATA**

**Impact**: When LLM defaults to 2025 and tries to join with law_enforcement_employees for per-capita calculations:
```sql
-- This query will return ZERO results because LEE has no 2025 data
SELECT ag.state_abbr, COUNT(*) as offenses
FROM offense_segment o
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year  -- ❌ No match for 2025
WHERE o.data_year = 2025
```

**Result**: User query fails or returns empty results, agent appears broken.

**Solution**: Default to **data_year = 2024** (most recent year with BOTH offense and population data).

---

## Issue #3: Missing Columns in System Prompt

The user's provided schema shows these columns in `agencies` that are MISSING from system prompt:

**Missing columns NOT documented**:
- `state_code` (exists in DB)
- `county_code` (exists in DB)
- `population` (exists in DB - though marked as STRING)
- `msa_code` (exists in DB)

**Documented but NOT in DB**:
- `city_name` (does not exist!)

---

## Issue #4: Only ONE Function Implemented

### What Exists:
```typescript
class NIBRSCrimeFunctions {
  @DaemoFunction({...})
  async executeCustomQuery(input) { ... }
}
```

### What's Missing (All Defined in nibrs.schemas.ts but NOT Implemented):

1. ❌ `searchAgencies` - Find agencies by state/name/type
2. ❌ `getIncidentCounts` - Count incidents by various groupings
3. ❌ `getOffenseSummary` - Summarize offenses by type/location/weapon
4. ❌ `getVictimDemographics` - Victim demographics analysis
5. ❌ `getArresteeDemographics` - Arrestee demographics analysis
6. ❌ `getCrimeTrends` - Time series crime trends
7. ❌ `getWeaponAnalysis` - Weapon usage patterns
8. ❌ `getBiasAnalysis` - Hate crime bias analysis
9. ❌ `getLocationAnalysis` - Crime by location type
10. ❌ `getInjuryAnalysis` - Victim injury analysis
11. ❌ `getRelationshipAnalysis` - Victim-offender relationships
12. ❌ `getClearanceAnalysis` - Case clearance rates
13. ❌ `getTimePattern` - Hour of day patterns
14. ❌ `getVictimsByOffense` - Victim details by offense
15. ❌ `getArresteesByOffense` - Arrestee details by offense
16. ❌ `getOffenseDemographicCross` - Cross-tabulation analysis
17. ❌ `getAttemptedCompleted` - Attempted vs completed crimes
18. ❌ `getIncidentLevelStats` - Incident-level statistics
19. ❌ `getAgenciesByPopulation` - Filter agencies by population
20. ❌ `getCrimeRatesByPopulation` - Per-capita crime rates

**Impact**:
- LLM must write SQL for EVERYTHING
- Higher error rate (SQL syntax mistakes)
- No validated, tested query patterns
- Slower responses (more tokens, more iterations)
- Cannot leverage optimized, pre-built queries

---

## Issue #5: Example Query "Sort all agencies in CT by incident counts"

**User's Question**: "Sort all the agencies in CT by the incident counts they have for the most common crime state-wide"

**Why This Fails**:

### Step 1: LLM needs to find most common crime in CT
```sql
-- LLM writes this query
SELECT ucr_offense_code, COUNT(*) as count
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE ag.state_abbr = 'CT'
  AND o.data_year = 2025  -- ❌ Default from system prompt
GROUP BY ucr_offense_code
ORDER BY count DESC
LIMIT 1
```

**Potential Issues**:
- Defaults to 2025 (may have incomplete data vs 2024)
- Query is correct IF 2025 data is complete

### Step 2: LLM needs to count incidents per agency for that crime
```sql
-- LLM writes this query
SELECT
  ag.agency_name,
  ag.city_name,  -- ❌ FAILS HERE - column doesn't exist!
  COUNT(*) as incident_count
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE ag.state_abbr = 'CT'
  AND o.ucr_offense_code = '23H'  -- Most common code found
  AND o.data_year = 2025
GROUP BY ag.agency_name, ag.city_name
ORDER BY incident_count DESC
```

**Result**: Query fails with "Unrecognized name: city_name"

### Step 3: Even if fixed, population rate queries fail
```sql
-- If LLM tries per-capita rates
SELECT
  ag.agency_name,
  COUNT(*) as crimes,
  le.population,
  ROUND((COUNT(*) * 100000.0) / le.population, 2) as rate_per_100k
FROM offense_segment o
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN agencies ag ON o.ori = ag.ori
WHERE ag.state_abbr = 'CT'
  AND o.data_year = 2025  -- ❌ No LEE data for 2025!
GROUP BY ag.agency_name, le.population
```

**Result**: Zero results because no 2025 population data exists.

---

## Issue #6: No Tests

**Current test script** (package.json line 7):
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

**Impact**:
- No validation that executeCustomQuery works correctly
- No verification of schema accuracy
- No test cases for common query patterns
- Cannot detect regressions
- No CI/CD confidence

---

## Recommended Fixes

### Priority 1: Fix System Prompt (Immediate)

1. **Remove `city_name` references** - Column doesn't exist
2. **Change default year to 2024** - Most recent year with complete LEE data
3. **Add missing columns** - Document state_code, county_code, etc.
4. **Add warning about year ranges** - Explain LEE data only through 2024

### Priority 2: Implement Core Functions (High Value)

Implement at least these 5 functions to handle 80% of queries:

1. **`searchAgencies`** - Basic agency lookup (state, name filters)
2. **`getIncidentCounts`** - Count incidents by various dimensions
3. **`getCrimeTrends`** - Time series for specific crimes/states
4. **`getOffenseSummary`** - Offense breakdown by multiple factors
5. **`getCrimeRatesByPopulation`** - Per-capita rates (most valuable!)

**Benefits**:
- Tested, validated SQL queries
- Type-safe inputs/outputs
- Better error handling
- Faster execution (fewer LLM iterations)
- Higher success rate

### Priority 3: Add Comprehensive Tests (Critical)

Create test suite covering:
- Schema validation (verify all documented columns exist)
- Year range validation
- Sample queries for each implemented function
- Edge cases (null values, empty results, invalid inputs)
- Integration tests with real BigQuery data

### Priority 4: Validate & Document Actual Schema

- Query BigQuery INFORMATION_SCHEMA for all tables
- Generate accurate schema documentation
- Include column types, nullability, sample values
- Document known data quality issues
- Add data dictionaries for codes (location_type, weapon codes, etc.)

---

## Test Results for Example Query

Let me run a corrected version of the CT agencies query:

```sql
-- Step 1: Find most common crime in CT (2024 data)
SELECT ucr_offense_code, COUNT(*) as count
FROM `daemo-daemon-testing.nibrs_data.offense_segment` o
JOIN `daemo-daemon-testing.nibrs_data.agencies` ag ON o.ori = ag.ori
WHERE ag.state_abbr = 'CT'
  AND o.data_year = 2024  -- ✅ Fixed to 2024
GROUP BY ucr_offense_code
ORDER BY count DESC
LIMIT 1;

-- Step 2: Count by agency (WITHOUT city_name)
SELECT
  ag.agency_name,
  ag.state_abbr,
  COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
FROM `daemo-daemon-testing.nibrs_data.offense_segment` o
JOIN `daemo-daemon-testing.nibrs_data.agencies` ag ON o.ori = ag.ori
WHERE ag.state_abbr = 'CT'
  AND o.ucr_offense_code = '23H'  -- Most common
  AND o.data_year = 2024
GROUP BY ag.agency_name, ag.state_abbr
ORDER BY incident_count DESC;
```

These queries WILL work because they:
✅ Use data_year = 2024 (data exists)
✅ Don't reference city_name
✅ Use proper JOINs and table names
✅ Count DISTINCT incidents properly

---

## Conclusion

The agent is fundamentally broken due to:
1. ❌ Schema documentation errors (city_name doesn't exist)
2. ❌ Year mismatch (default 2025 but LEE only has 2024)
3. ❌ Only one function (forces LLM to write all SQL)
4. ❌ No tests (can't validate anything works)
5. ❌ 20+ missing functions (all schemas unused)

**Fixing these issues will dramatically improve agent reliability.**
