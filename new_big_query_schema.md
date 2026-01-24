# NIBRS CRIME DATA - BIGQUERY SCHEMA

## Dataset: \`daemo-daemon-testing.nibrs_data\`

## TABLES

### \`agencies\`

field name mode type description
ori STRING
counties STRING
state_abbr STRING
state_name STRING
agency_name STRING
agency_type_name STRING
nibrs_start_date DATE

**Example query:**
SELECT ori, counties, state_abbr, state_name, agency_name, agency_type_name, nibrs_start_date
FROM
`daemo-daemon-testing.nibrs_data.agencies`
LIMIT 2;

ori counties state_abbr state_name agency_name agency_type_name nibrs_start_date
AL0032500 MONTGOMERY AL Alabama "Department of Conservation, Montgomery" Other State Agency 2020-11-01
AL0080800 BLOUNT AL Alabama Hayden Police Department City 2021-01-01

### \`administrative_segment\`

field name mode type description
state_code STRING
ori STRING
incident_number STRING
incident_date DATE
incident_date_hour INTEGER
total_offense_segments INTEGER
total_victim_segments INTEGER
total_offender_segments INTEGER
total_arrestee_segments INTEGER
cleared_exceptionally STRING
data_year INTEGER

**Example query:**
SELECT state_code, ori, incident_number, incident_date, incident_date_hour, total_offense_segments, total_victim_segments, total_offender_segments, total_arrestee_segments, cleared_exceptionally, data_year
FROM `daemo-daemon-testing.nibrs_data.administrative_segment`
LIMIT 2;

state_code ori incident_number incident_date incident_date_hour total_offense_segments total_victim_segments total_offender_segments total_arrestee_segments cleared_exceptionally data_year
1 AL0010700 4E9WPB3O6CM4 2020-05-01 16 1 1 1 0 N 2020
1 AL0010900 Q C7FPVT8M81 2020-11-04 8 1 1 1 0 N 2020

### \`arrestee_segment\`

field name mode type description
state_code STRING
ori STRING
incident_number STRING
incident_date DATE
arrestee_sequence_number INTEGER
arrest_transaction_number STRING
arrest_date DATE
type_of_arrest STRING
multiple_arrestee_segment_indicator STRING
ucr_arrest_offense_code STRING
type_weapon_involved1 STRING
age_of_arrestee STRING
sex_of_arrestee STRING
race_of_arrestee STRING
ethnicity_of_arrestee STRING
residence_status_of_arrestee STRING
disposition_arrestee_under_18 STRING
data_year INTEGER
db_id STRING

**Example query:**
SELECT state_code, ori, incident_number, incident_date, arrestee_sequence_number, arrest_transaction_number, arrest_date, type_of_arrest, multiple_arrestee_segment_indicator, ucr_arrest_offense_code, type_weapon_involved1, age_of_arrestee, sex_of_arrestee, race_of_arrestee, ethnicity_of_arrestee, residence_status_of_arrestee, disposition_arrestee_under_18, data_year, db_id
FROM `daemo-daemon-testing.nibrs_data.arrestee_segment`
LIMIT 2;

state_code ori incident_number incident_date arrestee_sequence_number arrest_transaction_number arrest_date type_of_arrest multiple_arrestee_segment_indicator ucr_arrest_offense_code type_weapon_involved1 age_of_arrestee sex_of_arrestee race_of_arrestee ethnicity_of_arrestee residence_status_of_arrestee disposition_arrestee_under_18 data_year db_id
1 AL0010500 H-DC6BAEOZTJ 2020-09-28 2 5701881B5B97 2020-09-28 S N 35A 1 38 M W N N 2020 2020_67
1 AL0010500 XE0Y1WSQO0T4 2020-12-17 2 9849F248B471 2020-12-17 O N 23C 1 53 F W N N 2020 2020_87

### \`law_enforcement_employees\`

field name mode type description
data_year NULLABLE INTEGER
ori NULLABLE STRING
pub_agency_name NULLABLE STRING
state_abbr NULLABLE STRING
division_name NULLABLE STRING
region_name NULLABLE STRING
county_name NULLABLE STRING
agency_type_name NULLABLE STRING
population_group_desc NULLABLE STRING
population NULLABLE INTEGER
male_officer_ct NULLABLE INTEGER
male_cilvilian_ct NULLABLE INTEGER
male_total_ct NULLABLE INTEGER
female_officer_ct NULLABLE INTEGER
female_cilvilian_ct NULLABLE INTEGER
female_total_ct NULLABLE INTEGER
officer_ct NULLABLE INTEGER
civilian_ct NULLABLE INTEGER
total_pe_ct NULLABLE INTEGER
pe_ct_per_1000 NULLABLE STRING

**Example query:**
SELECT data_year, ori, pub_agency_name, state_abbr, division_name, region_name, county_name, agency_type_name, population_group_desc, population, male_officer_ct, male_cilvilian_ct, male_total_ct, female_officer_ct, female_cilvilian_ct, female_total_ct, officer_ct, civilian_ct, total_pe_ct, pe_ct_per_1000
FROM `daemo-daemon-testing.nibrs_data.law_enforcement_employees`
LIMIT 2;

data_year ori pub_agency_name pub_agency_unit state_abbr division_name region_name county_name agency_type_name population_group_desc population male_officer_ct male_cilvilian_ct male_total_ct female_officer_ct female_cilvilian_ct female_total_ct officer_ct civilian_ct total_pe_ct pe_ct_per_1000
2024 AK0010100 Anchorage NULL AK Pacific West ANCHORAGE City "Cities from 250,000 thru 499,999" 286958 322 44 366 44 124 168 366 168 534 1.86
2023 AK0010100 Anchorage NULL AK Pacific West ANCHORAGE City "Cities from 250,000 thru 499,999" 285026 352 43 395 48 123 171 400 166 566 1.99

### \`offense_segment\`

field name mode type description
state_code STRING
ori STRING
incident_number STRING
incident_date DATE
ucr_offense_code STRING
offense_attempted_or_completed STRING
offender_suspected_of_using1 STRING
location_type STRING
num_premises_entered INTEGER
method_of_entry STRING
type_of_criminal_activity1 STRING
type_weapon_force_involved1 STRING
automatic_weapon_indicator1 STRING
bias_motivation STRING
data_year INTEGER

**Example query:**
SELECT state_code, ori, incident_number, incident_date, ucr_offense_code, offense_attempted_or_completed, offender_suspected_of_using1, location_type, type_of_criminal_activity1, type_weapon_force_involved1, automatic_weapon_indicator1, bias_motivation, data_year
FROM `daemo-daemon-testing.nibrs_data.offense_segment`
LIMIT 2;

state_code ori incident_number incident_date ucr_offense_code offense_attempted_or_completed offender_suspected_of_using1 location_type type_of_criminal_activity1 type_weapon_force_involved1 automatic_weapon_indicator1 bias_motivation data_year
1 AL0010100 2228YGACZ--X 2024-03-30 09A C N 13 N 12.0 88 2024
1 AL0010200 81E3U8XF86Q4 2021-03-21 09A C N 20 11.0 A 88 2021

### \`victim_segment\`

field name mode type description
state_code STRING
ori STRING
incident_number STRING
incident_date DATE
victim_sequence_number INTEGER
ucr_offense_code1 STRING
type_of_victim STRING
age_of_victim STRING
sex_of_victim STRING
race_of_victim STRING
ethnicity_of_victim STRING
residence_status_of_victim STRING
agg_assault_homicide_circumstance1 STRING
additional_justifiable_homicide_circumstance STRING
type_of_injury1 STRING
offender_sequence_number INTEGER
victim_relationship_to_offender1 STRING
data_year INTEGER

**Example query:**
SELECT
state_code,
ori,
incident_number,
incident_date,
victim_sequence_number,
ucr_offense_code1,
type_of_victim,
age_of_victim,
sex_of_victim,
race_of_victim,
ethnicity_of_victim,
residence_status_of_victim,
agg_assault_homicide_circumstance1,
additional_justifiable_homicide_circumstance,
type_of_injury1,
offender_sequence_number,
victim_relationship_to_offender1,
data_year
FROM `daemo-daemon-testing.nibrs_data.victim_segment`
WHERE age_of_victim IS NOT NULL
OR sex_of_victim IS NOT NULL
OR race_of_victim IS NOT NULL
OR ethnicity_of_victim IS NOT NULL
LIMIT 10

ori counties state_abbr state_name agency_name agency_type_name nibrs_start_date
state_code ori incident_number incident_date victim_sequence_number ucr_offense_code1 type_of_victim age_of_victim sex_of_victim race_of_victim ethnicity_of_victim residence_status_of_victim agg_assault_homicide_circumstance1 additional_justifiable_homicide_circumstance type_of_injury1 offender_sequence_number victim_relationship_to_offender1 data_year
12 ILCPD0000 K2NKB4LF39G 2024-05-31 1 100 I 0.0 M W N N N ST 2024
31 NY0303000 F20NJWIHEMRC 2024-01-14 1 11B I 0.0 M U U U N AQ 2024
31 NY0303000 380J45LRMDSF 2024-06-07 1 120 I 0.0 F A N U M ST 2024
31 NY0303000 C900WEWLOKP8 2024-11-04 3 120 I 0.0 U U U U M RU 2024
12 ILCPD0000 K51U8LS61AEM 2023-01-05 2 120 I 0.0 M A N U N RU 2023
17 LA0530000 K24LDS CRW5 2023-11-28 1 120 I 0.0 M W N R L RU 2023
31 NY0303000 7X0IY10WBLP0 2025-09-26 2 120 I 0.0 M U U U N ST 2025
12 ILCPD0000 X 1T 5HB-F39 2025-02-25 1 120 I 0.0 F U U U N ST 2025
31 NY0303000 A0MQVPCNF1W 2024-09-15 2 120 I 0.0 U U U U N RU 2024
31 NY0303000 EH0U73626XZJ 2024-10-18 1 13A I 0.0 M I N U 2.0 M ST 2024
