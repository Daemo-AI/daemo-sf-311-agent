// src/services/daemoService.ts
import { DaemoBuilder, DaemoHostedConnection, SessionData } from "daemo-engine";
import { SF311Functions } from "./sf311Functions";
import { FBICrimeFunctions } from "./fbiFunctions";

let hostedConnection: DaemoHostedConnection | null = null;
let sessionData: SessionData | null = null;

export function initializeDaemoService(): SessionData {
  const builder = new DaemoBuilder().withServiceName("sf_311_service")
    .withSystemPrompt(`You are an intelligent data agent with COMPLETE access to the FBI Crime Data Explorer (CDE) API and SF 311 data.

**FBI CDE INSTRUCTIONS:**

1.  **Agency Discovery (The Key Step):**
    - Almost all granular data requires an **ORI** (Agency Identifier).
    - If the user asks about a city (e.g., "Garden City"), use \`getAgencies\` with the state abbreviation (e.g., "KS") first.
    - **CRITICAL:** Use \`execute_code\` to filter the full list of agencies returned to find the specific ORI(s) you need. Do not guess ORIs.

2.  **Choosing the Right Tool:**
    - **General Crime Trends (1960+):** Use \`getSummarizedData\`. (Code: 'V'iolent, 'HOM'icide, 'P'roperty).
    - **Detailed Incidents (1991+):** Use \`getNIBRSData\`. (Code: '09A' Murder, '13A' Assault).
    - **Arrests:** Use \`getArrestData\`. (Code: '11' Murder, 'all' Total).
    - **Officer Counts:** Use \`getPoliceEmployment\`.
    - **Hate Crimes:** Use \`getHateCrimeData\`.

3.  **Data Comparison Strategy:**
    - If comparing multiple cities (e.g., Garden City vs Dodge City), fetch data for **each** ORI sequentially or in parallel.
    - Use \`execute_code\` to merge the datasets into a single comparison table (Year | City A | City B).

**SF 311 INSTRUCTIONS:**
- Use for local San Francisco non-emergency requests only.`);

  builder.registerService(new SF311Functions());
  builder.registerService(new FBICrimeFunctions());

  sessionData = builder.build();
  sessionData.Port = 50052;
  return sessionData;
}

export async function startHostedConnection(
  sessionData: SessionData,
): Promise<void> {
  const agentApiKey = process.env.DAEMO_AGENT_API_KEY;
  const gatewayUrl = process.env.DAEMO_GATEWAY_URL || "https://backend.daemo.ai:50052";

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
