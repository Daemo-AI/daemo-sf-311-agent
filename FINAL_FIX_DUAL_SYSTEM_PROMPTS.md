# Final Fix: Dual System Prompts Issue - January 24, 2026

## The Real Problem

The agent has **TWO system prompts** in `daemoService.ts`:

1. **DIRECT_MODE_SYSTEM_PROMPT** (lines 9-486) - ✅ Was already fixed
2. **Main system prompt** (lines 490+) - ❌ **Had the WRONG schema**

I only fixed the first one, but **the agent was using the second one**!

## Evidence from Latest Test

Looking at your engine logs, the agent was still trying to use wrong column names that were documented in the second system prompt:
- Trying `city_name` in agencies table ❌ (doesn't exist)
- Trying `county_code` in agencies table ❌ (doesn't exist)
- Trying `population` in agencies table ❌ (doesn't exist)

## What Was Wrong in the Second System Prompt

### The `agencies` Table Schema (lines 522-536)

**BEFORE (WRONG - columns that don't exist):**
```
| ori         | STRING  | Primary key
| agency_name | STRING  | Full agency name
| city_name   | STRING  | City where agency is located  ← WRONG!
| state_abbr  | STRING  | Two-letter state code
| state_code  | STRING  | Two-digit numeric state FIPS code  ← WRONG!
| county_code | STRING  | County FIPS code  ← WRONG!
| population  | STRING  | Population served by agency  ← WRONG!
| msa_code    | STRING  | Metropolitan Statistical Area code  ← WRONG!
| is_nibrs    | BOOLEAN | Whether agency participates in NIBRS
```

**AFTER (CORRECT - actual BigQuery columns):**
```
| ori               | STRING  | Primary key
| agency_name       | STRING  | Full agency name
| agency_type_name  | STRING  | Type of agency ← NOW INCLUDED
| state_abbr        | STRING  | Two-letter state code
| state_name        | STRING  | Full state name ← NOW INCLUDED
| counties          | STRING  | County name(s) ← NOW INCLUDED (not county_code!)
| latitude          | FLOAT   | Geographic latitude ← NOW INCLUDED
| longitude         | FLOAT   | Geographic longitude ← NOW INCLUDED
| is_nibrs          | BOOLEAN | Whether agency participates in NIBRS
| nibrs_start_date  | DATE    | Date agency began NIBRS reporting ← NOW INCLUDED
```

## Files Modified

**File:** `/src/services/daemoService.ts`

**Lines changed:** 522-543 (the agencies table schema in the main system prompt)

## Changes Made

1. **Removed non-existent columns:**
   - ❌ `city_name` - doesn't exist in BigQuery
   - ❌ `state_code` (in agencies table) - doesn't exist
   - ❌ `county_code` - doesn't exist (actual column is `counties`)
   - ❌ `population` - doesn't exist in agencies (only in `law_enforcement_employees`)
   - ❌ `msa_code` - doesn't exist

2. **Added missing columns:**
   - ✅ `agency_type_name` - Type of agency
   - ✅ `state_name` - Full state name
   - ✅ `counties` - County names (NOT `county_code`)
   - ✅ `latitude` - GPS latitude
   - ✅ `longitude` - GPS longitude
   - ✅ `nibrs_start_date` - Date started NIBRS reporting

## Why This Matters

### Before the Fix

The agent's behavior:
1. Reads system prompt: "agencies table has `city_name` column"
2. Generates SQL: `SELECT city_name FROM agencies WHERE...`
3. BigQuery error: "Unrecognized name: city_name"
4. Agent tries again with different approach
5. Eventually gives up or falls back to predefined functions

**Result:** Agent can't execute custom SQL queries successfully

### After the Fix

The agent's behavior:
1. Reads system prompt: "agencies table has `agency_name`, `state_abbr`, `counties`, etc."
2. Generates SQL with CORRECT column names
3. Query succeeds on first attempt

**Result:** Agent can execute custom SQL queries successfully!

## Complete List of All Fixes Applied

This is the THIRD and final fix in a series:

### Fix #1: Table Qualification (CRITICAL_FIXES_APPLIED.md)
- Issue: BigQuery queries failed with "Table must be qualified with a dataset"
- Solution: All table names now use `` `daemo-daemon-testing.nibrs_data.table_name` ``
- Status: ✅ Fixed

### Fix #2: CTE Support (conversation history)
- Issue: `executeCustomQuery` rejected queries starting with `WITH`
- Solution: Updated security validation to allow CTEs
- Status: ✅ Fixed

### Fix #3: `offense_segment` Schema - `state_code` Column (SCHEMA_FIX_JAN_24.md)
- Issue: `offense_segment` table schema was incomplete - missing `state_code` column
- Solution: Added `state_code` column to schema documentation
- Status: ✅ Fixed (in FIRST system prompt only)

### Fix #4: THIS FIX - `agencies` Schema in Second System Prompt
- Issue: Second system prompt had completely wrong `agencies` table schema
- Solution: Replaced with correct schema matching actual BigQuery columns
- Status: ✅ Fixed (in SECOND system prompt)

## Testing

### Verification

```bash
npx tsc --noEmit
✓ Success (no TypeScript errors)
```

### Schema Verified

```bash
$ grep -A 5 "agency_type_name" src/services/daemoService.ts
| agency_type_name  | STRING  | Type of agency...
$ grep "city_name" src/services/daemoService.ts
# No results (removed from second prompt)
```

## Next Steps

1. **Restart the agent** (CRITICAL - must reload the corrected system prompt):
   ```bash
   npm run dev
   ```

2. **Test with the original query:**
   > "List all agencies in CT, then sort them by the number of incidents for the most common crime statewide"

3. **Expected behavior:**
   - Agent should now use correct column names
   - Custom SQL queries should work
   - No more "Unrecognized name: city_name" errors
   - No more "Unrecognized name: county_code" errors

## Why Previous Fixes Didn't Work

You asked: "Why are you unable to solve this problem?"

**Answer:** I **did** fix the schema, but only in the FIRST system prompt. The agent was using the SECOND system prompt, which still had the wrong schema!

There are TWO complete system prompts in `daemoService.ts`:
1. `export const DIRECT_MODE_SYSTEM_PROMPT` - I fixed this one ✅
2. `.withSystemPrompt(...)` in `initializeDaemoService()` - I missed this one ❌

This is why restarting didn't help - the agent was still loading the wrong schema from the second prompt.

## Summary

- ✅ **Problem identified:** Two system prompts, only one was fixed
- ✅ **Root cause:** Second system prompt had incorrect `agencies` table schema with non-existent columns
- ✅ **Solution applied:** Replaced wrong schema with correct BigQuery columns
- ✅ **Verification:** TypeScript compiles successfully
- ⚠️ **Action required:** Restart agent to load corrected system prompt

---

**Status:** ✅ **READY FOR TESTING**

**Next action:** Restart the agent with `npm run dev` and test the original query.

If the agent still fails after restart, please share the NEW error logs so I can investigate what other issues might exist.
