// src/services/daemoService.ts
import { DaemoBuilder, DaemoHostedConnection, SessionData } from "daemo-engine";
import { NIBRSCrimeFunctions } from "./nibrsFunctions";

let hostedConnection: DaemoHostedConnection | null = null;
let sessionData: SessionData | null = null;

// NIBRS BigQuery Schema Documentation
export const NIBRS_SCHEMA_DOCS = `
# NIBRS CRIME DATA - BIGQUERY SCHEMA

## Dataset: \`daemo-daemon-testing.nibrs_data\`

## TABLES

### \`agencies\`

Reference table for law enforcement agencies. **Join on \`ori\` field.**

| Column | Type | Description |
|--------|------|-------------|
| ori | STRING | Primary key. Agency identifier (e.g., 'AL0010100') |
| counties | STRING | County name(s) where agency operates |
| state_abbr | STRING | Two-letter state code (e.g., 'CA', 'TX') - **USE THIS FOR STATE FILTERS** |
| state_name | STRING | Full state name (e.g., 'California', 'Texas') |
| agency_name | STRING | Full agency name (e.g., 'Los Angeles Police Department') |
| agency_type_name | STRING | Type of agency (e.g., 'City', 'County', 'State Police', 'Other State Agency') |
| nibrs_start_date | DATE | Date agency began NIBRS reporting |



SELECT ori, counties, state_abbr, state_name, agency_name, agency_type_name, nibrs_start_date
FROM \`daemo-daemon-testing.nibrs_data.agencies\`
LIMIT 2;

**Example rows:**
\`\`\`
ori: AL0032500 | counties: MONTGOMERY | state_abbr: AL | state_name: Alabama | agency_name: Department of Conservation, Montgomery | agency_type_name: Other State Agency | nibrs_start_date: 2020-11-01
ori: AL0080800 | counties: BLOUNT | state_abbr: AL | state_name: Alabama | agency_name: Hayden Police Department | agency_type_name: City | nibrs_start_date: 2021-01-01
\`\`\`

---

### \`administrative_segment\`

One row per crime incident. Primary incident-level table.

| Column | Type | Description |
|--------|------|-------------|
| state_code | STRING | Numeric state code (e.g., '1'=AL) |
| ori | STRING | FK → agencies.ori |
| incident_number | STRING | Agency case number (unique within agency) |
| incident_date | DATE | Date incident occurred |
| incident_date_hour | INTEGER | Hour of day (0-23) |
| total_offense_segments | INTEGER | Number of offenses |
| total_victim_segments | INTEGER | Number of victims |
| total_offender_segments | INTEGER | Number of offenders |
| total_arrestee_segments | INTEGER | Number of arrestees |
| cleared_exceptionally | STRING | 'A'=Death of Offender, 'B'=Prosecution Declined, 'N'=Not Applicable |
| data_year | INTEGER | Year reported (2020-2025) |

**Example rows:**
\`\`\`
state_code: 1 | ori: AL0010700 | incident_number: 4E9WPB3O6CM4 | incident_date: 2020-05-01 | incident_date_hour: 16 | total_offense_segments: 1 | total_victim_segments: 1 | total_offender_segments: 1 | total_arrestee_segments: 0 | cleared_exceptionally: N | data_year: 2020
\`\`\`

---

### \`arrestee_segment\`

One row per arrestee.

| Column | Type | Description |
|--------|------|-------------|
| state_code | STRING | Numeric state code |
| ori | STRING | FK → agencies.ori |
| incident_number | STRING | Links to administrative_segment |
| incident_date | DATE | Date incident occurred |
| arrestee_sequence_number | INTEGER | Arrestee number (1, 2, 3...) |
| arrest_transaction_number | STRING | Unique arrest transaction ID |
| arrest_date | DATE | Date of arrest |
| type_of_arrest | STRING | 'O'=On-View, 'S'=Summoned, 'T'=Taken Into Custody |
| multiple_arrestee_segment_indicator | STRING | Multiple arrestee indicator |
| ucr_arrest_offense_code | STRING | Offense code for arrest |
| type_weapon_involved1 | STRING | Weapon code |
| age_of_arrestee | STRING | Age |
| sex_of_arrestee | STRING | 'M', 'F', 'U' |
| race_of_arrestee | STRING | Race code |
| ethnicity_of_arrestee | STRING | Ethnicity code |
| residence_status_of_arrestee | STRING | Residence status |
| disposition_arrestee_under_18 | STRING | Disposition for juvenile |
| data_year | INTEGER | Year reported |
| db_id | STRING | Internal database ID |

**Example rows:**
\`\`\`
state_code: 1 | ori: AL0010500 | incident_number: H-DC6BAEOZTJ | incident_date: 2020-09-28 | arrestee_sequence_number: 2 | arrest_date: 2020-09-28 | type_of_arrest: S | ucr_arrest_offense_code: 35A | age_of_arrestee: 38 | sex_of_arrestee: M | race_of_arrestee: W | data_year: 2020
\`\`\`

---

### \`law_enforcement_employees\`

FBI Law Enforcement Employees dataset with year-specific population data.

| Column | Type | Description |
|--------|------|-------------|
| data_year | INTEGER | Year of data **(1960-2024 ONLY - NO 2025 DATA!)** |
| ori | STRING | Agency identifier - FK to agencies.ori |
| pub_agency_name | STRING | Official agency name |
| state_abbr | STRING | Two-letter state code |
| division_name | STRING | Geographic division |
| region_name | STRING | Geographic region |
| county_name | STRING | County where agency is located |
| agency_type_name | STRING | Type of agency (City, County, State, etc.) |
| population_group_desc | STRING | FBI's official population category |
| population | INTEGER | **Population of the agency** |
| male_officer_ct | INTEGER | Male officers |
| male_cilvilian_ct | INTEGER | Male civilians |
| male_total_ct | INTEGER | Male total |
| female_officer_ct | INTEGER | Female officers |
| female_cilvilian_ct | INTEGER | Female civilians |
| female_total_ct | INTEGER | Female total |
| officer_ct | INTEGER | Total sworn officers |
| civilian_ct | INTEGER | Total civilian employees |
| total_pe_ct | INTEGER | Total personnel |
| pe_ct_per_1000 | STRING | Personnel per 1000 population |

**Example rows:**
\`\`\`
data_year: 2024 | ori: AK0010100 | pub_agency_name: Anchorage | state_abbr: AK | division_name: Pacific | region_name: West | county_name: ANCHORAGE | agency_type_name: City | population_group_desc: Cities from 250,000 thru 499,999 | population: 286958 | officer_ct: 366 | civilian_ct: 168 | total_pe_ct: 534 | pe_ct_per_1000: 1.86
\`\`\`

**⚠️ WARNING: LEE data only available through 2024. For per-capita queries, MUST use data_year ≤ 2024.**

---

### \`offense_segment\`

One row per offense. An incident can have multiple offenses.

| Column | Type | Description |
|--------|------|-------------|
| state_code | STRING | Numeric state code |
| ori | STRING | FK → agencies.ori |
| incident_number | STRING | Links to administrative_segment |
| incident_date | DATE | Date incident occurred |
| ucr_offense_code | STRING | FBI offense code (see UCR codes below) |
| offense_attempted_or_completed | STRING | 'A'=Attempted, 'C'=Completed |
| offender_suspected_of_using1 | STRING | Drug/alcohol/computer code |
| location_type | STRING | Two-digit location code |
| num_premises_entered | INTEGER | Number of premises entered (for burglary) |
| method_of_entry | STRING | How premises were entered |
| type_of_criminal_activity1 | STRING | Criminal activity code |
| type_weapon_force_involved1 | STRING | Primary weapon code ('11.0'=Firearm, '12.0'=Handgun) |
| automatic_weapon_indicator1 | STRING | 'A'=Automatic weapon used |
| bias_motivation | STRING | Hate crime bias code ('88'=None) |
| data_year | INTEGER | Year reported |

**Example rows:**
\`\`\`
state_code: 1 | ori: AL0010100 | incident_number: 2228YGACZ--X | incident_date: 2024-03-30 | ucr_offense_code: 09A | offense_attempted_or_completed: C | location_type: 13 | type_weapon_force_involved1: 12.0 | bias_motivation: 88 | data_year: 2024
\`\`\`

---

### \`victim_segment\`

One row per victim.

| Column | Type | Description |
|--------|------|-------------|
| state_code | STRING | Numeric state code |
| ori | STRING | FK → agencies.ori |
| incident_number | STRING | Links to administrative_segment |
| incident_date | DATE | Date incident occurred |
| victim_sequence_number | INTEGER | Victim number (1, 2, 3...) |
| ucr_offense_code1 | STRING | Primary offense affecting victim |
| type_of_victim | STRING | 'I'=Individual, 'B'=Business, 'L'=Law Enforcement Officer |
| age_of_victim | STRING | Age ('0.0' for infant, numeric string, NULL=Unknown) |
| sex_of_victim | STRING | 'M'=Male, 'F'=Female, 'U'=Unknown |
| race_of_victim | STRING | 'W'=White, 'B'=Black, 'A'=Asian, 'I'=Native American, 'U'=Unknown |
| ethnicity_of_victim | STRING | 'H'=Hispanic, 'N'=Not Hispanic, 'U'=Unknown |
| residence_status_of_victim | STRING | Residence status |
| agg_assault_homicide_circumstance1 | STRING | Circumstance code for aggravated assault/homicide |
| additional_justifiable_homicide_circumstance | STRING | Additional circumstance for justifiable homicide |
| type_of_injury1 | STRING | Injury type code |
| offender_sequence_number | INTEGER | Related offender sequence |
| victim_relationship_to_offender1 | STRING | Relationship code (e.g., 'AQ'=Acquaintance, 'ST'=Stranger) |
| data_year | INTEGER | Year reported |

**Example rows:**
\`\`\`
state_code: 12 | ori: ILCPD0000 | incident_number: K2NKB4LF39G | incident_date: 2024-05-31 | victim_sequence_number: 1 | ucr_offense_code1: 100 | type_of_victim: I | age_of_victim: 0.0 | sex_of_victim: M | race_of_victim: W | ethnicity_of_victim: N | type_of_injury1: N | victim_relationship_to_offender1: ST | data_year: 2024
\`\`\`

---

## KEY UCR OFFENSE CODES

| Code | Description |
|------|-------------|
| 09A | Murder & Nonnegligent Manslaughter |
| 09B | Negligent Manslaughter |
| 100 | Kidnapping/Abduction |
| 11A | Rape |
| 11B | Sodomy |
| 120 | Robbery |
| 13A | Aggravated Assault |
| 13B | Simple Assault |
| 13C | Intimidation |
| 220 | Burglary/Breaking & Entering |
| 23H | Larceny/Theft (All Other) |
| 23C | Shoplifting |
| 240 | Motor Vehicle Theft |
| 290 | Destruction/Damage/Vandalism |
| 35A | Drug/Narcotic Violations |
| 35B | Drug Equipment Violations |
| 520 | Weapon Law Violations |

---

## COMMON QUERY PATTERNS

### Join tables on ori AND incident_number:

\`\`\`sql
FROM \`daemo-daemon-testing.nibrs_data.administrative_segment\` a
JOIN \`daemo-daemon-testing.nibrs_data.offense_segment\` o
  ON a.ori = o.ori AND a.incident_number = o.incident_number
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON a.ori = ag.ori
\`\`\`

### Filter by year:

\`\`\`sql
WHERE data_year = 2024
\`\`\`

### Filter by state (use agencies table):

\`\`\`sql
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
WHERE ag.state_abbr = 'CA'
\`\`\`

### Count distinct incidents:

\`\`\`sql
COUNT(DISTINCT CONCAT(ori, '-', incident_number)) as incident_count
\`\`\`

### Calculate crime rate per 100k using law_enforcement_employees:

\`\`\`sql
SELECT
  ag.state_abbr,
  COUNT(*) as offenses,
  SUM(le.population) as total_population,
  ROUND((COUNT(*) * 100000.0) / SUM(le.population), 2) as rate_per_100k
FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
JOIN \`daemo-daemon-testing.nibrs_data.law_enforcement_employees\` le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
WHERE o.data_year = 2024
  AND le.population IS NOT NULL
GROUP BY ag.state_abbr
\`\`\`

---

## EXAMPLE QUERIES

### 1. Homicide Rates by State (Per Capita)

\`\`\`sql
SELECT
  ag.state_abbr,
  COUNT(*) as homicides,
  SUM(le.population) as total_population,
  ROUND((COUNT(*) * 100000.0) / SUM(le.population), 2) as homicide_rate_per_100k
FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
JOIN \`daemo-daemon-testing.nibrs_data.law_enforcement_employees\` le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
WHERE o.ucr_offense_code = '09A'
  AND o.data_year = 2024
  AND le.population IS NOT NULL
GROUP BY ag.state_abbr
ORDER BY homicide_rate_per_100k DESC
LIMIT 10
\`\`\`

### 2. Most Common Crimes Nationally

\`\`\`sql
SELECT
  o.ucr_offense_code,
  COUNT(*) as offense_count
FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
WHERE o.data_year = 2024
GROUP BY o.ucr_offense_code
ORDER BY offense_count DESC
LIMIT 10
\`\`\`

### 3. Crime Rate by Agency (for large agencies)

\`\`\`sql
SELECT
  ag.agency_name,
  ag.state_abbr,
  COUNT(*) as crimes,
  le.population,
  ROUND((COUNT(*) * 100000.0) / le.population, 2) as rate_per_100k
FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
JOIN \`daemo-daemon-testing.nibrs_data.law_enforcement_employees\` le
  ON o.ori = le.ori AND o.data_year = le.data_year
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
WHERE o.data_year = 2024
  AND le.population > 100000
GROUP BY ag.agency_name, ag.state_abbr, le.population
ORDER BY rate_per_100k DESC
LIMIT 20
\`\`\`

### 4. Victim Demographics

\`\`\`sql
SELECT
  sex_of_victim,
  race_of_victim,
  COUNT(*) as count
FROM \`daemo-daemon-testing.nibrs_data.victim_segment\`
WHERE type_of_victim = 'I'
  AND data_year = 2024
GROUP BY sex_of_victim, race_of_victim
ORDER BY count DESC
LIMIT 20
\`\`\`

### 5. Agencies in a State

\`\`\`sql
SELECT
  ori,
  agency_name,
  state_abbr,
  counties,
  agency_type_name,
  nibrs_start_date
FROM \`daemo-daemon-testing.nibrs_data.agencies\`
WHERE state_abbr = 'CT'
ORDER BY agency_name
LIMIT 20
\`\`\`

---

## IMPORTANT GUIDELINES

### DEFAULT TIME PERIOD

**MANDATORY RULE**: When analyzing crime data WITHOUT a specified time period:
- **ALWAYS use data_year = 2024** (most recent year with COMPLETE data)
- This ensures consistent, reliable, and comparable results
- NEVER use multiple years unless explicitly requested

### DATA AVAILABILITY

**CRITICAL DATA AVAILABILITY**:
- **offense_segment**: Data available 2020-2025
- **law_enforcement_employees**: Data available 1960-2024 **NO 2025 DATA!**
- **For per-capita queries**: MUST use data_year ≤ 2024

### POPULATION-BASED QUERIES

**CRITICAL**: For per-capita rates or population comparisons:
1. **ALWAYS use \`law_enforcement_employees\` table**
2. **ALWAYS join on BOTH \`ori\` AND \`data_year\`** for year-specific accuracy
3. **ALWAYS use data_year ≤ 2024** (no 2025 LEE data exists)
4. **Filter out NULL populations**: \`WHERE le.population IS NOT NULL\`

### FINAL RESPONSE FORMAT

**MANDATORY**: Your final response MUST be end-user friendly:
- **NEVER include code blocks** in your final response
- **NEVER show technical details** to the user
- Present data using **markdown tables**, **bullet points**, **numbered lists**
- Focus on insights and statistics
- Use plain language

---

## DATA CAVEATS

- NIBRS data is voluntarily reported - not all agencies participate
- Data availability varies by state and year
- Small numbers (<30) may not be statistically reliable
- 2025 offense data exists but is likely incomplete
- Population data (LEE) only available through 2024
`;

// Direct Mode System Prompt - Used when the agent runs without tool calling
export const DIRECT_MODE_SYSTEM_PROMPT = `You are an expert crime data analyst with deep knowledge of the FBI's National Incident-Based Reporting System (NIBRS) database stored in Google BigQuery. Here is the schema of the DB:

${NIBRS_SCHEMA_DOCS}

**YOUR PRIMARY TOOL: executeCustomQuery**

You have ONE powerful tool: \`executeCustomQuery\` - which allows you to execute ANY SQL query against the NIBRS BigQuery database to answer questions about crime data.

**HOW executeCustomQuery WORKS:**

1. **Input**: A SQL SELECT query (or CTE starting with WITH)
2. **Output**: Query results as rows with columns
3. **Security**: Only SELECT queries are allowed (no INSERT, UPDATE, DELETE, etc.)
4. **Table names**: Write \`offense_segment\` - automatically converted to fully qualified names
5. **Limit**: Results are automatically limited to 10,000 rows maximum

**EXAMPLE: Finding most common crime in a state and sorting agencies by it (SINGLE CTE QUERY):**

\`\`\`sql
WITH most_common_crime AS (
  SELECT ucr_offense_code
  FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
  JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
  WHERE ag.state_abbr = 'CT' AND o.data_year = 2024
  GROUP BY ucr_offense_code
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
SELECT
  ag.agency_name,
  mcc.ucr_offense_code as most_common_offense,
  COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
CROSS JOIN most_common_crime mcc
WHERE ag.state_abbr = 'CT'
  AND o.ucr_offense_code = mcc.ucr_offense_code
  AND o.data_year = 2024
GROUP BY ag.agency_name, mcc.ucr_offense_code
ORDER BY incident_count DESC
LIMIT 10
\`\`\`

When asked about specific agencies or locations, write SQL queries using \`executeCustomQuery\` to fetch the relevant data and provide accurate, up-to-date statistics.`;

export function initializeDaemoService(): SessionData {
  const builder = new DaemoBuilder().withServiceName("nibrs_crime_service")
    .withSystemPrompt(`You are an intelligent crime data analyst with COMPLETE access to the FBI NIBRS (National Incident-Based Reporting System) crime database via Google BigQuery. Here is the schema for the FBI NIBRS BigQuery Dataset:

${NIBRS_SCHEMA_DOCS}

**YOUR PRIMARY TOOL: executeCustomQuery**

You have ONE powerful function: \`executeCustomQuery\` - which executes SQL queries against the NIBRS BigQuery database.

**HOW executeCustomQuery WORKS:**

Call it with a SQL query string:
- Accepts SELECT queries (and CTEs starting with WITH)
- Automatically qualifies table names (write \`offense_segment\` not the full path)
- Returns results as rows with columns
- Limits results to 10,000 rows max

**EXAMPLE: Finding most common crime and sorting agencies by it (SINGLE QUERY):**

\`\`\`sql
WITH most_common_crime AS (
  SELECT ucr_offense_code
  FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
  JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
  WHERE ag.state_abbr = 'CT' AND o.data_year = 2024
  GROUP BY ucr_offense_code
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
SELECT
  ag.agency_name,
  mcc.ucr_offense_code as most_common_offense,
  COUNT(DISTINCT CONCAT(o.ori, '-', o.incident_number)) as incident_count
FROM \`daemo-daemon-testing.nibrs_data.offense_segment\` o
JOIN \`daemo-daemon-testing.nibrs_data.agencies\` ag ON o.ori = ag.ori
CROSS JOIN most_common_crime mcc
WHERE ag.state_abbr = 'CT'
  AND o.ucr_offense_code = mcc.ucr_offense_code
  AND o.data_year = 2024
GROUP BY ag.agency_name, mcc.ucr_offense_code
ORDER BY incident_count DESC
LIMIT 10
\`\`\`


**IMPORTANT:** Present results in a clear, user-friendly format WITHOUT showing SQL code to the user.`);

  builder.registerService(new NIBRSCrimeFunctions());

  sessionData = builder.build();
  sessionData.Port = 50052;
  return sessionData;
}

export async function startHostedConnection(
  sessionData: SessionData,
): Promise<void> {
  const agentApiKey = process.env.DAEMO_AGENT_API_KEY;
  const gatewayUrl = process.env.DAEMO_GATEWAY_URL || "localhost:50052";

  if (!agentApiKey) {
    console.warn(
      "[Daemo] DAEMO_AGENT_API_KEY not set. Hosted connection will not start.",
    );
    return;
  }

  console.log(`[Daemo] Starting hosted connection to ${gatewayUrl}...`);

  hostedConnection = new DaemoHostedConnection(
    {
      daemoGatewayUrl: gatewayUrl,
      agentApiKey: agentApiKey,
    },
    sessionData,
  );

  await hostedConnection.start();
  console.log("[Daemo] Hosted connection started successfully");
}

export function stopHostedConnection(): void {
  if (hostedConnection) {
    hostedConnection.stop();
    hostedConnection = null;
    console.log("[Daemo] Hosted connection stopped");
  }
}

export function getSessionData(): SessionData | null {
  return sessionData;
}
