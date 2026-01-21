# NIBRS Agent Enhancement - Implementation Plan

## Current State Analysis

### Existing Functions (19 total)
✅ Basic queries, demographics, trends, weapon/bias/location analysis
✅ New offense-level analysis (victims/arrestees by offense, cross-tabs, attempted/completed, incident stats)

### Gap Analysis Summary
- **30+ questions** require population data for per-capita rates
- **10+ questions** require day-of-week analysis
- **5+ questions** require multi-victim incident filtering
- **5+ questions** require MSA/metro area aggregation
- **3+ questions** require multi-offense pattern analysis
- **2+ questions** require time-to-arrest calculations
- **3+ questions** require statistical analysis (Gini, correlation)

## Population Data Strategy

### Problem
The `agencies` table schema indicates a `population` column exists, but:
1. Current `searchAgencies` function doesn't SELECT it
2. Need to verify if data actually exists in BigQuery

### Solution Options

**Option A: Use existing population column (if it exists)**
```sql
SELECT ori, agency_name, population, ...
FROM agencies
WHERE population IS NOT NULL
```
- **Pros**: No external dependencies, fast
- **Cons**: May be incomplete or outdated

**Option B: Add US Census API integration**
- Fetch population data from census.gov API
- Cache results in memory or database
- **Pros**: Most accurate, up-to-date
- **Cons**: External dependency, rate limits, complexity

**Option C: Static population lookup table**
- Hardcode population data for major cities
- **Pros**: Simple, reliable
- **Cons**: Limited coverage, manual maintenance

### Recommended Approach
1. **First**: Check if population column exists and has data
2. **If yes**: Use existing data (Option A)
3. **If no/incomplete**: Add Census API integration (Option B) OR provide guidance for users to add their own data

## Implementation Plan - Phase by Phase

### PHASE 1: Critical Enhancements (Enables 40+ questions)

#### 1.1 Add Population Support
**New/Modified Functions**:
- ✏️ **Modify `searchAgencies`**: Add `population` to SELECT
- 🆕 **Add `getCrimeRatesByAgency`**: Calculate crimes per 100k population
  - Input: stateAbbr, minPopulation, maxPopulation, offenseCode, year
  - Output: Agency name, crime count, population, rate_per_100k
- 🆕 **Add `getSimilarAgencies`**: Find agencies with similar population
  - Input: ori OR population range
  - Output: List of comparable agencies

**Query Example**:
```sql
SELECT
  ag.agency_name,
  COUNT(*) as crime_count,
  CAST(ag.population AS INT64) as population,
  ROUND(COUNT(*) * 100000.0 / CAST(ag.population AS INT64), 2) as rate_per_100k
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE ag.population IS NOT NULL
  AND CAST(ag.population AS INT64) > 0
  AND o.data_year = 2024
GROUP BY ag.ori, ag.agency_name, ag.population
ORDER BY rate_per_100k DESC
```

#### 1.2 Add Day-of-Week Analysis
**New/Modified Functions**:
- ✏️ **Modify `getTimePatterns`**: Add 'day_of_week' and 'day_offense' to groupBy enum
- 🆕 **Add `getWeekendVsWeekday`**: Compare weekend vs weekday patterns
  - Use: `EXTRACT(DAYOFWEEK FROM incident_date)` (1=Sunday, 7=Saturday)
  - Weekend: DAYOFWEEK IN (1, 7)
  - Weekday: DAYOFWEEK BETWEEN 2 AND 6

**Query Example**:
```sql
SELECT
  CASE
    WHEN EXTRACT(DAYOFWEEK FROM o.incident_date) IN (1, 7) THEN 'Weekend'
    ELSE 'Weekday'
  END as period,
  COUNT(*) as offense_count
FROM offense_segment o
WHERE o.data_year = 2024
GROUP BY period
```

#### 1.3 Add Multi-Victim Incident Filtering
**New Function**:
- 🆕 **Add `getIncidentsByVictimCount`**: Filter incidents by victim count
  - Input: minVictims, maxVictims, offenseCode, year, includeWeapon
  - Output: Incident details with victim counts
  - **Use case**: Mass shootings (4+ victims + firearm weapon)

**Query Example**:
```sql
SELECT
  a.ori,
  a.incident_number,
  a.incident_date,
  a.total_victim_segments,
  STRING_AGG(DISTINCT o.ucr_offense_code) as offense_codes,
  STRING_AGG(DISTINCT o.type_weapon_force_involved1) as weapons
FROM administrative_segment a
JOIN offense_segment o
  ON a.ori = o.ori AND a.incident_number = o.incident_number
WHERE a.total_victim_segments >= 4
  AND o.type_weapon_force_involved1 IN ('11','12','13','14','15')  -- Firearms
  AND a.data_year = 2024
GROUP BY a.ori, a.incident_number, a.incident_date, a.total_victim_segments
```

### PHASE 2: High-Value Additions (Enables 15+ questions)

#### 2.1 MSA/Metropolitan Area Analysis
**New Function**:
- 🆕 **Add `getMSAStatistics`**: Aggregate by metropolitan area
  - Input: msaCode, year, offenseCode
  - Output: MSA-level crime statistics
  - **Note**: `msa_code` column exists in agencies table

**Query Example**:
```sql
SELECT
  ag.msa_code,
  COUNT(*) as crime_count,
  COUNT(DISTINCT ag.ori) as agency_count
FROM offense_segment o
JOIN agencies ag ON o.ori = ag.ori
WHERE ag.msa_code IS NOT NULL
  AND o.data_year = 2024
GROUP BY ag.msa_code
```

#### 2.2 Time-to-Arrest Analysis
**New Function**:
- 🆕 **Add `getTimeToArrest`**: Calculate days between incident and arrest
  - Input: offenseCode, year, groupBy (offense, state, overall)
  - Output: Average/median days to arrest

**Query Example**:
```sql
SELECT
  ar.ucr_arrest_offense_code,
  AVG(DATE_DIFF(ar.arrest_date, a.incident_date, DAY)) as avg_days_to_arrest,
  APPROX_QUANTILES(DATE_DIFF(ar.arrest_date, a.incident_date, DAY), 100)[OFFSET(50)] as median_days
FROM arrestee_segment ar
JOIN administrative_segment a
  ON ar.ori = a.ori AND ar.incident_number = a.incident_number
WHERE ar.arrest_date >= a.incident_date
  AND ar.data_year = 2024
GROUP BY ar.ucr_arrest_offense_code
```

#### 2.3 City Name Resolution Enhancement
**New Function**:
- 🆕 **Add `searchAgenciesByCity`**: Fuzzy city name matching
  - Input: cityName, stateAbbr
  - Output: Matched agencies
  - **Approach**: Use LIKE '%city%' matching on agency_name

### PHASE 3: Advanced Analytics (Enables 10+ questions)

#### 3.1 Multi-Offense Pattern Analysis
**New Function**:
- 🆕 **Add `getIncidentOffensePatterns`**: Which crimes occur together
  - Input: year, state, minCoOccurrence
  - Output: Offense pairs/triplets that commonly occur in same incident

**Query Example**:
```sql
WITH incident_offenses AS (
  SELECT
    ori,
    incident_number,
    ARRAY_AGG(DISTINCT ucr_offense_code ORDER BY ucr_offense_code) as offense_array
  FROM offense_segment
  WHERE data_year = 2024
  GROUP BY ori, incident_number
  HAVING COUNT(DISTINCT ucr_offense_code) >= 2
)
SELECT
  offense_array,
  COUNT(*) as co_occurrence_count
FROM incident_offenses
GROUP BY offense_array
ORDER BY co_occurrence_count DESC
LIMIT 100
```

#### 3.2 Statistical Analysis Functions
**New Function**:
- 🆕 **Add `getStatisticalAnalysis`**: Advanced statistical calculations
  - Gini coefficient (crime inequality across agencies)
  - Correlation (agency size vs crime rate)
  - Percentile rankings

**Gini Coefficient Query**:
```sql
WITH crime_counts AS (
  SELECT
    ag.ori,
    COUNT(*) as crime_count
  FROM offense_segment o
  JOIN agencies ag ON o.ori = ag.ori
  WHERE o.data_year = 2024
  GROUP BY ag.ori
),
sorted AS (
  SELECT
    crime_count,
    ROW_NUMBER() OVER (ORDER BY crime_count) as rank,
    COUNT(*) OVER () as total_agencies
  FROM crime_counts
)
SELECT
  -- Gini coefficient calculation
  (SUM((2 * rank - total_agencies - 1) * crime_count) /
   (total_agencies * SUM(crime_count))) as gini_coefficient
FROM sorted
```

#### 3.3 Enhanced Clearance Analysis
**Modification**:
- ✏️ **Modify `getClearanceAnalysis`**: Add 'offense' to groupBy options

#### 3.4 Quarterly Trend Support
**Modification**:
- ✏️ **Modify `getCrimeTrends`**: Add 'quarter' to granularity enum

**Query Example**:
```sql
SELECT
  CONCAT('Q', CAST(EXTRACT(QUARTER FROM o.incident_date) AS STRING),
         '-', CAST(o.data_year AS STRING)) as quarter,
  COUNT(*) as crime_count
FROM offense_segment o
WHERE o.data_year BETWEEN 2020 AND 2024
GROUP BY quarter
ORDER BY quarter
```

## Function Summary

### New Functions (11 total)
1. ✅ `getCrimeRatesByAgency` - Per-capita crime rates
2. ✅ `getSimilarAgencies` - Find comparable agencies by population
3. ✅ `getWeekendVsWeekday` - Weekend vs weekday patterns
4. ✅ `getIncidentsByVictimCount` - Multi-victim incidents (mass events)
5. ✅ `getMSAStatistics` - Metropolitan area aggregation
6. ✅ `getTimeToArrest` - Days between incident and arrest
7. ✅ `searchAgenciesByCity` - Better city name matching
8. ✅ `getIncidentOffensePatterns` - Co-occurring offenses
9. ✅ `getStatisticalAnalysis` - Gini, correlation, percentiles
10. ✅ `getResidentialVsCommercial` - Location type comparisons
11. ✅ `getClearanceByOffense` - Clearance rates per offense type

### Modified Functions (4 total)
1. ✏️ `searchAgencies` - Add population column
2. ✏️ `getTimePatterns` - Add day_of_week grouping
3. ✏️ `getClearanceAnalysis` - Add offense grouping
4. ✏️ `getCrimeTrends` - Add quarterly granularity

### Total Functions After Implementation
**Current**: 19 functions
**After Phase 1-3**: 30 functions

## Questions Enabled by Phase

### Phase 1 (Critical)
Enables: Q1, Q7, Q8, Q11, Q12, Q14, Q15, Q18, Q21, Q26, Q31, Q43, Q46, Q48, Q49, Q51, Q52, Q71, Q77, Q79, Q80, Q88, Q89, Q92, Q94, Q95, Q97, Q99 (28 questions)

### Phase 2 (High Value)
Enables: Q2, Q4, Q8, Q11, Q34, Q47, Q52 (7 questions)

### Phase 3 (Advanced)
Enables: Q9, Q13, Q14, Q30, Q33, Q48, Q83, Q85 (8 questions)

## Total Coverage
After all phases: **~75 out of 100 questions** answerable

### Remaining Unanswerable Questions (25)
- Q3: Carjacking (not a specific offense code)
- Q10: Marijuana legalization correlation (requires external data)
- Q32: Repeat offenders (no person ID)
- Q47: Migration patterns (requires external data)
- ~20 others that depend on data not in NIBRS or require external enrichment

## Implementation Checklist

### Pre-Implementation
- [ ] Verify population column exists in agencies table
- [ ] Test query performance on large datasets
- [ ] Review BigQuery quotas and costs

### Phase 1 Implementation
- [ ] Modify searchAgencies to include population
- [ ] Add getCrimeRatesByAgency
- [ ] Add getSimilarAgencies
- [ ] Modify getTimePatterns for day of week
- [ ] Add getWeekendVsWeekday
- [ ] Add getIncidentsByVictimCount
- [ ] Update schemas for all new/modified functions
- [ ] Test with sample queries

### Phase 2 Implementation
- [ ] Add getMSAStatistics
- [ ] Add getTimeToArrest
- [ ] Add searchAgenciesByCity
- [ ] Update schemas
- [ ] Test with sample queries

### Phase 3 Implementation
- [ ] Add getIncidentOffensePatterns
- [ ] Add getStatisticalAnalysis
- [ ] Modify getClearanceAnalysis
- [ ] Modify getCrimeTrends for quarterly
- [ ] Update schemas
- [ ] Test with sample queries

### Post-Implementation
- [ ] Update system prompts with new function guidance
- [ ] Test with all 100 questions
- [ ] Document which questions are/aren't answerable
- [ ] Performance optimization if needed

## Risk Mitigation

### Performance Concerns
- Large JOINs on incident-level data may be slow
- Solution: Add appropriate WHERE filters, use LIMIT
- Consider pre-aggregated tables for common queries

### Data Quality
- Population data may be missing/outdated
- Solution: Handle NULL population gracefully, provide warnings

### Query Complexity
- Some queries (Gini, patterns) are computationally expensive
- Solution: Set reasonable LIMIT defaults, warn users about long-running queries
