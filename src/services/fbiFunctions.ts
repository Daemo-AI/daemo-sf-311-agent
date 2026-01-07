// src/services/fbiFunctions.ts
import { DaemoFunction } from "daemo-engine";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  GetAgenciesInput,
  GetSummarizedCrimeInput,
  GetNIBRSCrimeInput,
  GetArrestInput,
  GetNIBRSEstimationInput,
  GetHateCrimeInput,
  GetSupplementalInput,
  GetSHRInput,
  GetPEInput,
  GetParticipationInput,
  AgencyListOutput,
  TrendOutput,
  DetailedStatsOutput,
} from "./fbi.schemas";

configDotenv();

const FBI_BASE_URL = "https://api.usa.gov/crime/fbi/cde";

export class FBICrimeFunctions {
  private client: AxiosInstance;

  constructor() {
    const apiKey = process.env.FBI_API_KEY;
    this.client = axios.create({
      baseURL: FBI_BASE_URL,
      params: { API_KEY: apiKey },
    });
  }

  // --- Helper: Transform simple trend data ---
  private transformTrend(
    title: string,
    actuals: Record<string, any>,
    rates: Record<string, any> = {},
  ): z.infer<typeof TrendOutput> {
    const dataPoints: any[] = [];
    const mainKey = Object.keys(actuals)[0] || "";
    const rateKey = Object.keys(rates)[0] || "";
    const yearMap = actuals[mainKey] || {};
    const rateMap = rates[rateKey] || {};

    for (const [period, count] of Object.entries(yearMap)) {
      if (count !== null) {
        dataPoints.push({
          period,
          count: Number(count),
          rate: rateMap[period] ? Number(rateMap[period]) : null,
        });
      }
    }

    // Sort
    dataPoints.sort((a, b) => {
      if (a.period.includes("-")) {
        const [ma, ya] = a.period.split("-").map(Number);
        const [mb, yb] = b.period.split("-").map(Number);
        return ya - yb || ma - mb;
      }
      return parseInt(a.period) - parseInt(b.period);
    });

    return { title: mainKey || title, data: dataPoints, coverage: null };
  }

  @DaemoFunction({
    description:
      "Get all Law Enforcement Agencies in a state. Returns ORI, Name, and Type. Mandatory first step for agency-specific queries.",
    tags: ["fbi", "agency"],
    category: "FBI",
    inputSchema: GetAgenciesInput,
    outputSchema: AgencyListOutput,
  })
  async getAgencies(input: z.infer<typeof GetAgenciesInput>) {
    try {
      const res = await this.client.get(
        `/agency/byStateAbbr/${input.stateAbbr}`,
      );
      // Flatten { "COUNTY": [agencies...] }
      const flattened = Object.values(res.data).flat();
      return flattened.map((a: any) => ({
        ori: a.ori,
        agency_name: a.agency_name,
        agency_type_name: a.agency_type_name,
        state_abbr: a.state_abbr,
        latitude: a.latitude,
        longitude: a.longitude,
        is_nibrs: a.is_nibrs,
      }));
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  @DaemoFunction({
    description:
      "Get Summarized (SRS) Crime Data. Covers 1960-Present. Ideal for long-term trends of major crimes (Homicide, Robbery, etc).",
    tags: ["fbi", "srs", "summary"],
    category: "FBI",
    inputSchema: GetSummarizedCrimeInput,
    outputSchema: TrendOutput,
  })
  async getSummarizedData(input: z.infer<typeof GetSummarizedCrimeInput>) {
    let path = `/summarized/${input.level}`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.ori}`;
    path += `/${input.offense}`;

    try {
      const res = await this.client.get(path, {
        params: { from: `01-${input.fromYear}`, to: `12-${input.toYear}` },
      });
      return this.transformTrend(
        `SRS: ${input.offense}`,
        res.data.offenses?.actuals || {},
        res.data.offenses?.rates || {},
      );
    } catch (e: any) {
      return { title: "No Data", data: [] };
    }
  }

  @DaemoFunction({
    description:
      "Get NIBRS Incident Data. Detailed data usually available from 1991+. Covers specific offense codes like '13A' (Aggravated Assault).",
    tags: ["fbi", "nibrs"],
    category: "FBI",
    inputSchema: GetNIBRSCrimeInput,
    outputSchema: TrendOutput,
  })
  async getNIBRSData(input: z.infer<typeof GetNIBRSCrimeInput>) {
    let path = `/nibrs/${input.level}`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.ori}`;
    path += `/${input.offense}`;

    try {
      const res = await this.client.get(path, {
        params: {
          from: `01-${input.fromYear}`,
          to: `12-${input.toYear}`,
          type: "counts",
        },
      });
      return this.transformTrend(
        `NIBRS: ${input.offense}`,
        res.data.offenses?.actuals || {},
        res.data.offenses?.rates || {},
      );
    } catch (e: any) {
      return { title: "No Data", data: [] };
    }
  }

  @DaemoFunction({
    description:
      "Get Arrest Data. Counts of arrests made. Use 'all' for total arrests, or specific codes like '11' for Murder arrests.",
    tags: ["fbi", "arrest"],
    category: "FBI",
    inputSchema: GetArrestInput,
    outputSchema: TrendOutput,
  })
  async getArrestData(input: z.infer<typeof GetArrestInput>) {
    let path = `/arrest/${input.level}`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.ori}`;
    path += `/${input.offense}`;

    try {
      const res = await this.client.get(path, {
        params: {
          from: `01-${input.fromYear}`,
          to: `12-${input.toYear}`,
          type: "counts",
        },
      });
      return this.transformTrend(
        `Arrests: ${input.offense}`,
        res.data.actuals || {},
        res.data.rates || {},
      );
    } catch (e: any) {
      return { title: "No Data", data: [] };
    }
  }

  @DaemoFunction({
    description:
      "Get NIBRS Estimation Data. Provides statistically estimated counts to account for non-reporting agencies. Note: Uses numeric State IDs.",
    tags: ["fbi", "estimation"],
    category: "FBI",
    inputSchema: GetNIBRSEstimationInput,
    outputSchema: DetailedStatsOutput, // Returns the raw object array
  })
  async getNIBRSEstimation(input: z.infer<typeof GetNIBRSEstimationInput>) {
    let path = `/nibrs-estimation/${input.level}`;
    if (input.level === "state") path += `/${input.stateId}`;
    if (input.level === "region") path += `/${input.regionCode}`;
    path += `/${input.offense}`;

    try {
      const res = await this.client.get(path, { params: { year: input.year } });
      // The estimation endpoint returns an array of objects
      return {
        total_count: res.data.length,
        breakdown: res.data,
        trend_data: [],
      };
    } catch (e: any) {
      return { total_count: 0 };
    }
  }

  @DaemoFunction({
    description:
      "Get Hate Crime Data. Filter by Bias Motivation (e.g., '12' Anti-Black).",
    tags: ["fbi", "hate-crime"],
    category: "FBI",
    inputSchema: GetHateCrimeInput,
    outputSchema: DetailedStatsOutput,
  })
  async getHateCrimeData(input: z.infer<typeof GetHateCrimeInput>) {
    let path = `/hate-crime/${input.level}`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.ori}`;
    if (input.bias) path += `/${input.bias}`;

    try {
      const res = await this.client.get(path, {
        params: { from: `01-${input.fromYear}`, to: `12-${input.toYear}` },
      });
      // Flatten response for AI consumption
      const data = res.data.bias_section || res.data.incident_section || {};
      const actuals = res.data.actuals || {}; // Sometimes present for trends

      // Manually build trend data if available in 'actuals' key
      const trendData = [];
      if (actuals) {
        const mainKey = Object.keys(actuals)[0];
        if (mainKey && actuals[mainKey]) {
          for (const [pd, ct] of Object.entries(actuals[mainKey])) {
            trendData.push({ period: pd, count: Number(ct) });
          }
        }
      }

      return {
        total_count: trendData.length,
        breakdown: {
          victims: data.victim_type,
          offenses: data.offense_type,
          bias: data.bias || data.bias_category,
        },
        trend_data: trendData.sort((a, b) => a.period.localeCompare(b.period)),
      };
    } catch (e: any) {
      return { total_count: 0, trend_data: [] };
    }
  }

  @DaemoFunction({
    description:
      "Get Supplemental Property Crime Data (Burglary, Larceny, Motor Theft detailed).",
    tags: ["fbi", "property"],
    category: "FBI",
    inputSchema: GetSupplementalInput,
    outputSchema: TrendOutput,
  })
  async getSupplementalData(input: z.infer<typeof GetSupplementalInput>) {
    let path = `/supplemental/${input.level}`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.ori}`;
    path += `/${input.offense}`;

    try {
      const res = await this.client.get(path, {
        params: {
          from: `01-${input.fromYear}`,
          to: `12-${input.toYear}`,
          type: "counts",
        },
      });
      return this.transformTrend(
        `Supplemental: ${input.offense}`,
        res.data.actuals || {},
        res.data.rates || {},
      );
    } catch (e: any) {
      return { title: "No Data", data: [] };
    }
  }

  @DaemoFunction({
    description:
      "Get Supplemental Homicide Report (SHR) Data. Detailed homicide counts including weapon info.",
    tags: ["fbi", "homicide", "shr"],
    category: "FBI",
    inputSchema: GetSHRInput,
    outputSchema: DetailedStatsOutput,
  })
  async getSHRData(input: z.infer<typeof GetSHRInput>) {
    let path = `/shr/${input.level}`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.ori}`;

    try {
      const res = await this.client.get(path, {
        params: {
          from: `01-${input.fromYear}`,
          to: `12-${input.toYear}`,
          type: "counts",
        },
      });

      const actuals = res.data.actuals || {};
      const trendData = [];
      const mainKey = Object.keys(actuals)[0];
      if (mainKey && actuals[mainKey]) {
        for (const [pd, ct] of Object.entries(actuals[mainKey])) {
          trendData.push({ period: pd, count: Number(ct) });
        }
      }

      return {
        total_count: trendData.length,
        breakdown: {
          victim_demographics: res.data.victim_demographics,
          offender_demographics: res.data.offender_demographics,
          weapons: res.data.weapon_usage,
        },
        trend_data: trendData,
      };
    } catch (e: any) {
      return { total_count: 0, trend_data: [] };
    }
  }

  @DaemoFunction({
    description:
      "Get Police Employment (PE) Data. Officers vs Civilians count.",
    tags: ["fbi", "police"],
    category: "FBI",
    inputSchema: GetPEInput,
    outputSchema: TrendOutput,
  })
  async getPoliceEmployment(input: z.infer<typeof GetPEInput>) {
    let path = `/pe`;
    if (input.level === "state") path += `/${input.stateAbbr}`;
    if (input.level === "agency") path += `/${input.stateAbbr}/${input.ori}`; // Note: PE agency endpoint is /pe/{state}/{ori}

    try {
      const res = await this.client.get(path, {
        params: { from: input.fromYear, to: input.toYear },
      });
      // PE returns YYYY keys directly in actuals
      return this.transformTrend(
        `Police Employment`,
        res.data.actuals || {},
        res.data.rates || {},
      );
    } catch (e: any) {
      return { title: "No Data", data: [] };
    }
  }

  @DaemoFunction({
    description: "Get Use of Force / Participation Data.",
    tags: ["fbi", "uof", "participation"],
    category: "FBI",
    inputSchema: GetParticipationInput,
    outputSchema: DetailedStatsOutput,
  })
  async getParticipationData(input: z.infer<typeof GetParticipationInput>) {
    let path = `/participation/${input.level}/${input.collection}/`;
    if (input.level === "national") path += "nationalByYear";
    else if (input.level === "state") {
      path = `/participation/state/${input.stateAbbr}/${input.collection}/states`;
    }

    try {
      const res = await this.client.get(path, {
        params: { year: input.year, quarter: input.quarter },
      });

      return {
        total_count: Array.isArray(res.data) ? res.data.length : 0,
        breakdown: { raw_response: res.data },
        trend_data: [],
      };
    } catch (e: any) {
      return { total_count: 0, trend_data: [] };
    }
  }
}
