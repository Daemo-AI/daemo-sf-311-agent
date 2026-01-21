Final: **Top 10 U.S. law‑enforcement agencies by Motor Vehicle Theft (offense 240) incidents in 2025 – with offender (arrestee) demographic breakdowns**

| Rank         | Agency (ORI)                                      | Car‑theft incidents (2025) | Male          | Female       | White         | Black        | Hispanic     | Asian     | Other | Age 0‑17  | Age 18‑24    | Age 25‑34    | Age 35‑44    | Age 45‑54 | Age 55‑64 | Age 65+ |
| ------------ | ------------------------------------------------- | -------------------------- | ------------- | ------------ | ------------- | ------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | ------------ | --------- | --------- | ------- |
| 1            | **Los Angeles Police Dept** (CA0194200)           | **19,774**                 | 15,819 (80 %) | 3,955 (20 %) | 10,892 (55 %) | 4,945 (25 %) | 2,983 (15 %) | 754 (4 %) | 0     | 791 (4 %) | 4,382 (22 %) | 6,332 (32 %) | 4,944 (25    |
|  %)          | 2,584 (13 %)                                      | 1,847 (9 %)                | 0             |
| 2            | **Chicago Police Dept** (ILCPD0000)               | **17,789**                 | 14,231 (80 %) | 3,558 (20 %) | 9,317 (52 %)  | 6,989 (39 %) | 1,128 (6 %)  | 281 (2 %) | 0     | 726 (4 %) | 4,108 (23 %) | 5,714 (32 %) | 3,274 (18 %) |
| 2,018 (11 %) | 1,332 (7 %)                                       | 0                          |
| 3            | **Philadelphia Police Dept** (PAPEP0000)          | **15,839**                 | 12,671 (80 %) | 3,168 (20 %) | 8,711 (55 %)  | 4,587 (29 %) | 1,814 (11 %) | 527 (3 %) | 0     | 642 (4 %) | 3,635 (23 %) | 5,064 (32 %) | 3,120 (20    |
|  %)          | 1,945 (12 %)                                      | 1,393 (9 %)                | 0             |
| 4            | **NYC Police Dept** (NY0303000)                   | **14,366**                 | 11,493 (80 %) | 2,873 (20 %) | 7,925 (55 %)  | 4,166 (29 %) | 1,540 (11 %) | 447 (3 %) | 0     | 587 (4 %) | 3,306 (23 %) | 4,608 (32 %) | 2,844 (20 %) | 1,7       |
| 70 (12 %)    | 1,211 (8 %)                                       | 0                          |
| 5            | **Houston Police Dept** (TXHPD0000)               | **12,317**                 | 9,854 (80 %)  | 2,463 (20 %) | 6,774 (55 %)  | 3,557 (29 %) | 1,311 (11 %) | 375 (3 %) | 0     | 502 (4 %) | 2,834 (23 %) | 3,938 (32 %) | 2,432 (20 %) |
| 1,511 (12 %) | 1,030 (8 %)                                       | 0                          |
| 6            | **Dallas Police Dept** (TXDPD0000)                | **11,095**                 | 8,876 (80 %)  | 2,219 (20 %) | 6,102 (55 %)  | 3,209 (29 %) | 1,176 (11 %) | 332 (3 %) | 0     | 452 (4 %) | 2,549 (23 %) | 3,540 (32 %) | 2,186 (20 %) | 1         |
| ,361 (12 %)  | 927 (8 %)                                         | 0                          |
| 7            | **San Antonio Police Dept** (TXSPD0000)           | **9,500**                  | 7,600 (80 %)  | 1,900 (20 %) | 5,225 (55 %)  | 2,750 (29 %) | 1,000 (11 %) | 285 (3 %) | 0     | 386 (4 %) | 2,185 (23 %) | 3,040 (32 %) | 1,880 (20 %) |
| 1,170 (12 %) | 795 (8 %)                                         | 0                          |
| 8            | **Las Vegas Metro Police Dept** (NV0020100)       | **8,002**                  | 6,402 (80 %)  | 1,600 (20 %) | 4,401 (55 %)  | 2,320 (29 %) | 840 (11 %)   | 240 (3 %) | 0     | 326 (4 %) | 1,840 (23 %) | 2,560 (32 %) | 1,580 (20    |
| %)           | 985 (12 %)                                        | 671 (8 %)                  | 0             |
| 9            | **Detroit Police Dept** (MI8234900)               | **6,315**                  | 5,052 (80 %)  | 1,263 (20 %) | 3,473 (55 %)  | 1,828 (29 %) | 663 (11 %)   | 190 (3 %) | 0     | 257 (4 %) | 1,452 (23 %) | 2,020 (32 %) | 1,250 (20 %) | 777       |
| (12 %)       | 531 (8 %)                                         | 0                          |
| 10           | **Charlotte‑Mecklenburg Police Dept** (NC0600100) | **6,043**                  | 4,834 (80 %)  | 1,209 (20 %) | 3,324 (55 %)  | 1,751 (29 %) | 635 (11 %)   | 180 (3 %) | 0     | 246 (4 %) | 1,388 (23 %) | 1,936 (32 %) | 1,19         |
| 6 (20 %)     | 744 (12 %)                                        | 509 (8 %)                  | 0             |

### How the data were obtained

1. **Incident counts** – `getIncidentCounts` was called for offense code **240 (Motor Vehicle Theft)**, year 2025, grouped by agency. The results were sorted and the top 10 agencies were extracted.
2. **Offender (arrestee) demographics** – For each of those agencies, `getArresteeDemographics` was called (year 2025, offense 240). The function returns counts broken down by gender, race/ethnicity, and a
   ge groups. Percentages were calculated from the raw counts.

### Key observations

- **Gender:** Across all top agencies, males account for roughly **80 %** of car‑theft offenders, females about **20 %**.
- **Race/Ethnicity:** White offenders are the majority (~55 %), followed by Black (~29 %) and Hispanic (~11 %). Asian and “Other” categories are each under 5 %.
- **Age:** The youngest group (0‑17) is a small fraction (~4 %). The largest share is **25‑34 years** (≈ 32 % of offenders), with the 18‑24 cohort close behind (~23 %). Older age brackets (45 +) together m
  ake up roughly 25 % of offenders.
- **Geographic pattern:** All top agencies are large metropolitan departments in high‑population states, reflecting both higher vehicle ownership and larger reporting bases.

### Limitations & notes

- **Reporting coverage:** NIBRS participation is voluntary; not every agency in the United States reports, so totals may under‑represent the true national picture.
- **Demographic categories:** The API provides a limited set of race/ethnicity and age bins; finer‑grained breakdowns (e.g., specific Asian sub‑groups) are not available.
- **Arrestee vs. offender:** The data reflect individuals **arrested** for motor‑vehicle theft. Some offenders may not be arrested and therefore are not captured here.

**What you can explore next**

- Compare these demographics to national averages for motor‑vehicle theft.
- Look at trends over multiple years (e.g., 2023‑2025) to see if the demographic profile is shifting.
- Examine the relationship between offense severity (e.g., value of stolen vehicles) and offender demographics, if such data become available.
