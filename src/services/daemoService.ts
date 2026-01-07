// src/services/daemoService.ts

import { DaemoBuilder, DaemoHostedConnection, SessionData } from "daemo-engine";
import { SF311Functions } from "./sf311Functions";
import { FBICrimeFunctions } from "./fbiFunctions"; // <--- IMPORT THIS

let hostedConnection: DaemoHostedConnection | null = null;
let sessionData: SessionData | null = null;

export function initializeDaemoService(): SessionData {
  console.log("[Daemo] Initializing Daemo service...");

  // Update System Prompt to include FBI capabilities
  const builder = new DaemoBuilder().withServiceName("sf_311_service")
    .withSystemPrompt(`You are an intelligent government data assistant.

You have access to two major datasets:
1. **SF 311**: Live service requests from San Francisco (potholes, graffiti, etc.).
2. **FBI Crime Data Explorer (CDE)**: National and State-level crime statistics, including NIBRS data, Hate Crimes, and Arrest records.

**Guidelines:**
- When a user asks about local SF issues (cleanliness, infrastructure), use the SF 311 tools.
- When a user asks about crime rates, violence, arrests, or hate crimes (either in SF specifically or nationally), use the FBI Crime tools.
- You can combine data! For example, if asked about safety in SF, you might look up 311 graffiti reports AND FBI crime stats for California.
- When using FBI tools, always check the State Abbreviation (e.g., 'CA' for California).
- For FBI Crime trends, use the 'summarized' or 'nibrs' tools to get historical data.

Always provide clear, helpful, data-backed answers.`);

  // 1. Register the SF 311 service
  const sf311Functions = new SF311Functions();
  builder.registerService(sf311Functions);

  // 2. Register the FBI Crime service
  const fbiFunctions = new FBICrimeFunctions();
  builder.registerService(fbiFunctions);

  sessionData = builder.build();
  sessionData.Port = 50052;
  console.log(`[Daemo] Registered ${sessionData.Functions.length} functions`);

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
