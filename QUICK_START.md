# Quick Start - FBI Population Data Integration

## What Changed?

The agent now uses the **FBI Law Enforcement Employees dataset** for all population queries.

### Key Improvements

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| Data Source | `agencies.population` (STRING) | `law_enforcement_employees.population` (INTEGER) |
| Year-Specific | ❌ No | ✅ Yes (2015-2024) |
| Categories | Custom/hardcoded | FBI official categories |
| Consistency | ❌ Different each time | ✅ Always identical |
| SQL Complexity | SAFE_CAST required | Direct INTEGER comparison |

---

## Quick Command Reference

### Find agencies by population

```typescript
// Large urban (>500K)
const large = await daemo.nibrs_crime_service.getAgenciesByPopulation({
  minPopulation: 500000,
  toYear: 2024
});

// Small rural (<50K) in Texas
const small = await daemo.nibrs_crime_service.getAgenciesByPopulation({
  stateAbbr: "TX",
  maxPopulation: 50000,
  toYear: 2024
});
```

### Calculate per-capita crime rates

```typescript
// Robbery rates by population category
const rates = await daemo.nibrs_crime_service.getCrimeRatesByPopulation({
  offenseCode: "120",
  populationCategory: "all",
  groupBy: "population_category",
  fromYear: 2025,
  toYear: 2025
});
```

### Custom SQL with population

```sql
SELECT
  le.population_group_desc,
  o.ucr_offense_code,
  COUNT(*) as count,
  ROUND((COUNT(*) / SUM(le.population)) * 100000, 2) as rate_per_100k
FROM offense_segment o
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year
WHERE o.data_year = 2025
  AND le.population >= 500000
GROUP BY le.population_group_desc, o.ucr_offense_code
ORDER BY rate_per_100k DESC
```

---

## Critical SQL Pattern

**ALWAYS join on BOTH ori AND data_year:**

```sql
-- ✅ CORRECT
JOIN law_enforcement_employees le
  ON o.ori = le.ori AND o.data_year = le.data_year

-- ❌ WRONG (will match wrong years!)
JOIN law_enforcement_employees le ON o.ori = le.ori
```

---

## Testing

Run your original inconsistent query 3 times and verify:

1. ✅ Results are identical
2. ✅ Uses `law_enforcement_employees` table
3. ✅ Mentions "FBI population data"
4. ✅ Shows FBI categories like "Cities from 500,000 thru 999,999"

---

## Documentation

- **`FBI_POPULATION_DATA_GUIDE.md`** - Complete guide with examples
- Table: `daemo-daemon-testing.nibrs_data.law_enforcement_employees`

---

## Rebuild & Test

```bash
cd daemo-sf-311-agent
npm run build
npm start

# Test with:
# "Compare weapon usage in robberies between large urban (>500K) and small rural (<50K) agencies"
```

---

## Need Help?

See `FBI_POPULATION_DATA_GUIDE.md` for:
- Full table schema
- Common query patterns
- Troubleshooting
- Migration notes
