// sf_311_agent/src/services/socrataClient.ts
import axios from "axios";
import { configDotenv } from "dotenv";

configDotenv();

const DATASET_ID = "vw6y-z8j6"; // SF 311 Cases
const BASE_URL = `https://data.sfgov.org/api/v3/views/${DATASET_ID}/query.json`;

export class SocrataClient {
  private appToken: string;

  constructor() {
    this.appToken = process.env.SF_DATA_APP_TOKEN || "";
    if (!this.appToken) {
      console.warn(
        "Warning: SF_DATA_APP_TOKEN is missing. Rate limits will be low.",
      );
    }
  }

  /**
   * Execute a SoQL Query
   */
  async executeQuery<T>(soqlQuery: string): Promise<T[]> {
    try {
      console.log(`[SoQL] Executing: ${soqlQuery}`);

      const response = await axios.post(
        BASE_URL,
        { query: soqlQuery },
        {
          headers: {
            "X-App-Token": this.appToken,
            "Content-Type": "application/json",
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Socrata API Error:",
        error.response?.data || error.message,
      );
      throw new Error(`Failed to fetch 311 data: ${error.message}`);
    }
  }
}
