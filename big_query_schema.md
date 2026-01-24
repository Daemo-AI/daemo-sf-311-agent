# NIBRS CRIME DATA - BIGQUERY SCHEMA

## Dataset: \`daemo-daemon-testing.nibrs_data\`

---

## TABLES

### \`agencies\`

Reference table for law enforcement agencies. **Join on \`ori\` field.**

| Column      | Type    | Description                                                    |
| ----------- | ------- | -------------------------------------------------------------- |
| ori         | STRING  | Primary key. 9-character agency identifier (e.g., 'CA0010100') |
| agency_name | STRING  | Full agency name (e.g., 'Los Angeles Police Department')       |
| city_name   | STRING  | City where agency is located                                   |
| state_abbr  | STRING  | Two-letter state code (e.g., 'CA')                             |
| state_code  | STRING  | Two-digit numeric state FIPS code                              |
| county_code | STRING  | County FIPS code                                               |
| population  | STRING  | Population served by agency (cast to INT64 for calculations)   |
| msa_code    | STRING  | Metropolitan Statistical Area code                             |
| is_nibrs    | BOOLEAN | Whether agency participates in NIBRS reporting                 |

**Important Notes:**

- **To filter by state:** Use \`WHERE state_abbr = 'TX'\` (abbreviation) OR \`WHERE state_name = 'Texas'\` (full name)
- **NEVER use:** \`WHERE state = ...\` (this column does not exist)

**Example rows:**
\`\`\`
ori: AL0032500 | state_abbr: AL | state_name: Alabama | agency_name: Department of Conservation, Montgomery | is_nibrs: true
ori: AL0080800 | state_abbr: AL | state_name: Alabama | agency_name: Hayden Police Department | is_nibrs: true
ori: TX0010100 | state_abbr: TX | state_name: Texas | agency_name: Houston Police Department | is_nibrs: true
\`\`\`

### \`administrative_segment\`

One row per crime incident. Primary incident-level table.

| Column                  | Type   | Description                                                         |
| ----------------------- | ------ | ------------------------------------------------------------------- |
| ori                     | STRING | FK → agencies.ori                                                   |
| incident_number         | STRING | Agency case number (unique within agency)                           |
| incident_date           | DATE   | Date incident occurred                                              |
| incident_date_hour      | INT64  | Hour of day (0-23)                                                  |
| data_year               | INT64  | Year reported (2020-2025)                                           |
| total_offense_segments  | INT64  | Number of offenses                                                  |
| total_victim_segments   | INT64  | Number of victims                                                   |
| total_offender_segments | INT64  | Number of offenders                                                 |
| total_arrestee_segments | INT64  | Number of arrestees                                                 |
| cleared_exceptionally   | STRING | 'A'=Death of Offender, 'B'=Prosecution Declined, 'N'=Not Applicable |

**Example rows:**
\`\`\`
ori: AK0010500 | incident_number: UG-W84JHSCTD | incident_date: 2020-11-07 | incident_date_hour: 15 | data_year: 2020
ori: AL0010000 | incident_number: 2W2HPU72JLKD | incident_date: 2020-01-18 | incident_date_hour: 13 | data_year: 2020
\`\`\`

### \`offense_segment\`

One row per offense. An incident can have multiple offenses.

| Column                         | Type   | Description                                            |
| ------------------------------ | ------ | ------------------------------------------------------ |
| ori                            | STRING | FK → agencies.ori                                      |
| incident_number                | STRING | Links to administrative_segment                        |
| incident_date                  | DATE   | Date incident occurred                                 |
| data_year                      | INT64  | Year reported                                          |
| ucr_offense_code               | STRING | FBI offense code (see UCR codes below)                 |
| offense_attempted_or_completed | STRING | 'A'=Attempted, 'C'=Completed                           |
| location_type                  | STRING | Two-digit location code                                |
| bias_motivation                | STRING | Hate crime bias code ('88'=None)                       |
| type_weapon_force_involved1    | STRING | Primary weapon code ('11'=Firearm, '12'=Handgun, etc.) |
| type_weapon_force_involved2    | STRING | Secondary weapon code (if applicable)                  |
| type_weapon_force_involved3    | STRING | Tertiary weapon code (if applicable)                   |

**Example rows:**
\`\`\`
ori: AL0010200 | incident_number: V-6QXTJIBB0W | incident_date: 2023-09-30 | ucr_offense_code: 09A | offense_attempted_or_completed: C | location_type: 18 | type_weapon_force_involved1: 11.0 | bias_motivation: 88 | data_year: 2023
ori: AL0010200 | incident_number: U302O-JYLGST | incident_date: 2022-12-19 | ucr_offense_code: 09A | offense_attempted_or_completed: C | location_type: 20 | type_weapon_force_involved1: 11.0 | bias_motivation: 88 | data_year: 2022
\`\`\`

### \`victim_segment\`

One row per victim.

| Column                 | Type   | Description                                               |
| ---------------------- | ------ | --------------------------------------------------------- |
| ori                    | STRING | FK → agencies.ori                                         |
| incident_number        | STRING | Links to administrative_segment                           |
| incident_date          | DATE   | Date incident occurred                                    |
| data_year              | INT64  | Year reported                                             |
| victim_sequence_number | INT64  | Victim number (1, 2, 3...)                                |
| type_of_victim         | STRING | 'I'=Individual, 'B'=Business, 'L'=Law Enforcement Officer |
| age_of_victim          | STRING | Age ('01'-'99', 'NB'=Newborn, NULL=Unknown)               |
| sex_of_victim          | STRING | 'M'=Male, 'F'=Female, 'U'=Unknown                         |
| race_of_victim         | STRING | 'W'=White, 'B'=Black, 'A'=Asian, 'I'=Native American      |
| ucr_offense_code1      | STRING | Primary offense affecting victim                          |

**Example rows:**
\`\`\`
ori: TXHPD0000 | incident_number: 37418GZ42SCT | incident_date: 2025-06-28 | victim_sequence_number: 1 | ucr_offense_code1: 120 | type_of_victim: B | data_year: 2025
ori: MI2583900 | incident_number: P-23NGWP-Z2Z | incident_date: 2023-06-21 | victim_sequence_number: 2 | ucr_offense_code1: 120 | type_of_victim: B | data_year: 2023
\`\`\`

### \`arrestee_segment\`

One row per arrestee.

| Column                  | Type   | Description                                       |
| ----------------------- | ------ | ------------------------------------------------- |
| ori                     | STRING | FK → agencies.ori                                 |
| incident_number         | STRING | Links to administrative_segment                   |
| arrest_date             | DATE   | Date of arrest                                    |
| data_year               | INT64  | Year reported                                     |
| ucr_arrest_offense_code | STRING | Offense code for arrest                           |
| age_of_arrestee         | STRING | Age                                               |
| sex_of_arrestee         | STRING | 'M', 'F', 'U'                                     |
| race_of_arrestee        | STRING | Race code                                         |
| type_of_arrest          | STRING | 'O'=On-View, 'S'=Summoned, 'T'=Taken Into Custody |

**Example rows:**
\`\`\`
ori: AK0012200 | incident_number: HQ2HPUXVZ21A | arrest_date: 2021-01-18 | ucr_arrest_offense_code: 220 | age_of_arrestee: 42 | sex_of_arrestee: M | race_of_arrestee: W | data_year: 2020
ori: AL0010500 | incident_number: QNAYTGDAEX4 | arrest_date: 2020-05-02 | ucr_arrest_offense_code: 35A | age_of_arrestee: 39 | sex_of_arrestee: M | race_of_arrestee: B | data_year: 2020
\`\`\`

### \`law_enforcement_employees\`

FBI Law Enforcement Employees dataset with year-specific population data for agencies.

| Column                | Type    | Description                                                    |
| --------------------- | ------- | -------------------------------------------------------------- |
| data_year             | INTEGER | Year of data (2015-2024)                                       |
| ori                   | STRING  | Agency identifier (9 characters) - FK to agencies.ori          |
| pub_agency_name       | STRING  | Official agency name                                           |
| state_abbr            | STRING  | Two-letter state code                                          |
| population            | INTEGER | **Population served by agency** (INTEGER - no casting needed!) |
| population_group_desc | STRING  | FBI's official population category                             |
| county_name           | STRING  | County where agency is located                                 |
| agency_type_name      | STRING  | Type of agency (City, County, State, etc.)                     |
| officer_ct            | INTEGER | Number of sworn officers                                       |
| civilian_ct           | INTEGER | Number of civilian employees                                   |

**FBI Population Categories** (from \`population_group_desc\`):

- "Cities 1,000,000 and over"
- "Cities from 500,000 thru 999,999"
- "Cities from 250,000 thru 499,999"
- "Cities from 100,000 thru 249,999"
- "Cities from 50,000 thru 99,999"
- "Cities from 25,000 thru 49,999"
- "Cities from 10,000 thru 24,999"
- "Cities from 2,500 thru 9,999"
- "Cities under 2,500"

**Example rows:**
\`\`\`
data_year: 2024 | ori: AK0010100 | pub_agency_name: Anchorage | state_abbr: AK | population: 286958 | population_group_desc: Cities from 250,000 thru 499,999 | officer_ct: 366
data_year: 2023 | ori: AK0010100 | pub_agency_name: Anchorage | state_abbr: AK | population: 285026 | population_group_desc: Cities from 250,000 thru 499,999 | officer_ct: 400
\`\`\`

**CRITICAL: Always join on BOTH \`ori\` AND \`data_year\`:**
\`\`\`sql
JOIN law_enforcement_employees le
ON o.ori = le.ori AND o.data_year = le.data_year
\`\`\`

This ensures year-specific population matching for accurate per-capita calculations.
