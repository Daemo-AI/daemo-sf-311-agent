// src/services/fbiFunctions.ts
import { DaemoFunction } from "daemo-engine";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { configDotenv } from "dotenv";
import {
  GetAgenciesByStateInput,
  GetSummarizedDataInput,
  GetNationalNibrsInput,
  GetHateCrimeInput,
  GetArrestDataInput,
  AgencyOutputSchema,
  TrendOutputSchema,
  HateCrimeOutputSchema,
} from "./fbi.schemas";

configDotenv();

const FBI_BASE_URL = "https://api.usa.gov/crime/fbi/cde";

export class FBICrimeFunctions {
  private client: AxiosInstance;

  constructor() {
    const apiKey = process.env.FBI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️ Warning: FBI_API_KEY is missing. Requests will likely fail.",
      );
    }

    this.client = axios.create({
      baseURL: FBI_BASE_URL,
      params: { API_KEY: apiKey },
    });
  }

  /**
   * Helper to transform the nested dictionary response from FBI (Year -> Value)
   * into a cleaner Array of Objects for the AI to read.
   */
  private transformTrendData(
    title: string,
    actuals: Record<string, any>,
    rates?: Record<string, any>,
  ): z.infer<typeof TrendOutputSchema> {
    // The API returns nested keys like { "Virginia Offenses": { "2020": 123 } }
    // We need to flatten this.
    const dataPoints: any[] = [];

    // Find the primary key in actuals (e.g. "Virginia Offenses")
    const actualKeys = Object.keys(actuals);
    if (actualKeys.length === 0) return { title, data: [] };

    const primaryKey = actualKeys[0];
    const yearMap = actuals[primaryKey] || {};

    const rateKey = rates ? Object.keys(rates)[0] : null;
    const rateMap = rateKey && rates ? rates[rateKey] : {};

    Object.keys(yearMap).forEach((year) => {
      dataPoints.push({
        year: year,
        count: yearMap[year],
        rate: rateMap[year] || null,
      });
    });

    // Sort by year
    dataPoints.sort((a, b) => parseInt(a.year) - parseInt(b.year));

    return {
      title: primaryKey,
      data: dataPoints,
    };
  }

  @DaemoFunction({
    description:
      "Find Law Enforcement Agencies (Police Departments) within a specific US State. Returns the ORI (Agency ID) needed for specific agency queries.",
    tags: ["fbi", "agency", "police"],
    category: "FBICrime",
    inputSchema: GetAgenciesByStateInput,
    outputSchema: AgencyOutputSchema,
  })
  async getAgenciesByState(
    input: z.infer<typeof GetAgenciesByStateInput>,
  ): Promise<z.infer<typeof AgencyOutputSchema>> {
    try {
      const response = await this.client.get(
        `/agency/byStateAbbr/${input.stateAbbr}`,
      );

      // API returns { "COUNTY_NAME": [ {agency...} ] }
      // Flatten this into a single list of agencies
      const allAgencies: any[] = [];
      Object.values(response.data).forEach((countyAgencies: any) => {
        if (Array.isArray(countyAgencies)) {
          allAgencies.push(...countyAgencies);
        }
      });

      return allAgencies
        .map((a) => ({
          ori: a.ori,
          agency_name: a.agency_name,
          agency_type_name: a.agency_type_name,
          state_abbr: a.state_abbr,
          latitude: a.latitude,
          longitude: a.longitude,
        }))
        .slice(0, 50); // Limit to 50 to avoid token overflow
    } catch (error: any) {
      throw new Error(
        `FBI API Error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description:
      "Get historical trend data (Summarized SRS) for a specific offense in a specific state. Ideal for seeing crime rates over the last 10-20 years. Use 'V' for Violent Crime and 'P' for Property Crime.",
    tags: ["fbi", "stats", "historical"],
    category: "FBICrime",
    inputSchema: GetSummarizedDataInput,
    outputSchema: TrendOutputSchema,
  })
  async getStateCrimeTrends(
    input: z.infer<typeof GetSummarizedDataInput>,
  ): Promise<z.infer<typeof TrendOutputSchema>> {
    try {
      // The API expects 'from' and 'to' as integers for this endpoint?
      // Docs say mm-yyyy usually, but let's try constructing ranges based on example usage.
      // Based on docs: ?from=01-YYYY&to=12-YYYY covers the full year.
      const from = `01-${input.fromYear}`;
      const to = `12-${input.toYear}`;

      const response = await this.client.get(
        `/summarized/state/${input.stateAbbr}/${input.offense}`,
        {
          params: { from, to },
        },
      );

      const actuals = response.data.offenses?.actuals || {};
      const rates = response.data.offenses?.rates || {};

      return this.transformTrendData(
        `Crime Trends: ${input.offense} in ${input.stateAbbr}`,
        actuals,
        rates,
      );
    } catch (error: any) {
      throw new Error(
        `FBI API Error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description:
      "Get detailed National NIBRS crime statistics for specific offenses (e.g., Aggravated Assault, Robbery). Returns counts and clearance rates.",
    tags: ["fbi", "national", "nibrs"],
    category: "FBICrime",
    inputSchema: GetNationalNibrsInput,
    outputSchema: TrendOutputSchema,
  })
  async getNationalCrimeStats(
    input: z.infer<typeof GetNationalNibrsInput>,
  ): Promise<z.infer<typeof TrendOutputSchema>> {
    try {
      const from = `01-${input.fromYear}`;
      const to = `12-${input.toYear}`;

      const response = await this.client.get(
        `/nibrs/national/${input.offense}`,
        {
          params: { from, to, type: "counts" },
        },
      );

      const actuals = response.data.offenses?.actuals || {};
      const rates = response.data.offenses?.rates || {};

      return this.transformTrendData(
        `National Stats: ${input.offense}`,
        actuals,
        rates,
      );
    } catch (error: any) {
      throw new Error(
        `FBI API Error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description:
      "Get Hate Crime statistics. Can be filtered by State and specific Bias motivation (e.g., Anti-Black, Anti-Jewish). Returns victim types, offense types, and location types.",
    tags: ["fbi", "hate-crime"],
    category: "FBICrime",
    inputSchema: GetHateCrimeInput,
    outputSchema: HateCrimeOutputSchema,
  })
  async getHateCrimeStats(
    input: z.infer<typeof GetHateCrimeInput>,
  ): Promise<z.infer<typeof HateCrimeOutputSchema>> {
    try {
      const from = `01-${input.fromYear}`;
      const to = `12-${input.toYear}`;

      let url = "/hate-crime";

      // Construct URL based on specificity
      if (input.stateAbbr) {
        url += `/state/${input.stateAbbr}`;
      } else {
        url += `/national`;
      }

      if (input.biasCode) {
        url += `/${input.biasCode}`;
      }

      const response = await this.client.get(url, {
        params: { from, to },
      });

      // Navigate the flexible response structure
      const data =
        response.data?.bias_section || response.data?.general_section || {};

      return {
        victim_types: data.victim_type || {},
        offense_types: data.offense_type || {},
        location_types: data.location_type || {},
        bias_motivation: data.incident_section?.bias || {},
      };
    } catch (error: any) {
      throw new Error(
        `FBI API Error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  @DaemoFunction({
    description:
      "Get Arrest statistics for a specific state. Shows arrest rates and counts.",
    tags: ["fbi", "arrests"],
    category: "FBICrime",
    inputSchema: GetArrestDataInput,
    outputSchema: TrendOutputSchema,
  })
  async getArrestData(
    input: z.infer<typeof GetArrestDataInput>,
  ): Promise<z.infer<typeof TrendOutputSchema>> {
    try {
      const from = `01-${input.fromYear}`;
      const to = `12-${input.toYear}`;

      const response = await this.client.get(
        `/arrest/state/${input.stateAbbr}/${input.offense}`,
        {
          params: { from, to, type: "counts" },
        },
      );

      const actuals = response.data?.actuals || {};
      const rates = response.data?.rates || {};

      return this.transformTrendData(
        `Arrests in ${input.stateAbbr}`,
        actuals,
        rates,
      );
    } catch (error: any) {
      throw new Error(
        `FBI API Error: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
