/*
 * =========================================================================================
 *  SERVICE REGISTRY - CUSTOMIZATION POINT
 * =========================================================================================
 *
 * This file is where you register your custom functions/tools with the Daemo Engine.
 *
 * HOW TO CUSTOMIZE:
 * 1. Import your custom service class (e.g., MyCustomFunctions).
 * 2. Instantiate it inside 'initializeDaemoService'.
 * 3. Call 'builder.registerService(myCustomFunctions)'.
 * 4. Update the system prompt to reflect your agent's new persona.
 * =========================================================================================
 */

/**
 * Daemo Service - Registers CRM functions with the Daemo SDK
 */

import { DaemoBuilder, DaemoHostedConnection, SessionData } from "daemo-engine";
import { SF311Functions } from "./sf311Functions"; // Import new class
import * as fs from "fs";

let hostedConnection: DaemoHostedConnection | null = null;
let sessionData: SessionData | null = null;

export function initializeDaemoService(): SessionData {
  console.log("[Daemo] Initializing Daemo service...");

  const builder = new DaemoBuilder().withServiceName("sf_311_service")
    .withSystemPrompt(`You are a helpful SF 311 assistant with access to San Francisco's 311 case system.

You can help users:
- Search for 311 cases by status, neighborhood, service type, and age
- Get specific case details by case ID
- Analyze case statistics and trends

When users ask about cases that have been open for a certain time period:
- Use the days_old_min parameter to filter for cases OLDER than that many days
- For example, "cases open for more than 30 days" means days_old_min=30

Always provide clear, helpful information about the cases and their status.`);

  // Register the SF 311 service
  const sf311Functions = new SF311Functions();
  builder.registerService(sf311Functions);

  sessionData = builder.build();
  sessionData.Port = 50052;
  console.log(`[Daemo] Registered ${sessionData.Functions.length} functions`);

  return sessionData;
}

/**
 * Start the hosted connection to Daemo Gateway
 */
export async function startHostedConnection(
  sessionData: SessionData,
): Promise<void> {
  const agentApiKey = process.env.DAEMO_AGENT_API_KEY;
  const gatewayUrl = process.env.DAEMO_GATEWAY_URL || "localhost:50052";

  if (!agentApiKey) {
    console.warn(
      "[Daemo] DAEMO_AGENT_API_KEY not set. Hosted connection will not start.",
    );
    console.warn(
      "[Daemo] You can still use the agent endpoint with session_id parameter.",
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

/**
 * Stop the hosted connection
 */
export function stopHostedConnection(): void {
  if (hostedConnection) {
    hostedConnection.stop();
    hostedConnection = null;
    console.log("[Daemo] Hosted connection stopped");
  }
}

/**
 * Get the session data
 */
export function getSessionData(): SessionData | null {
  return sessionData;
}

/**
 * Check if hosted connection is active
 */
export function isHostedConnectionActive(): boolean {
  return hostedConnection?.isActive() ?? false;
}

export function debugSessionData() {
  const sf311Functions = new SF311Functions();
  const builder = new DaemoBuilder().withServiceName("sf311_service");

  // Register service
  builder.registerService(sf311Functions);

  // Build session data
  const sessionData = builder.build();

  // Write to file for inspection
  fs.writeFileSync(
    "session-data-debug.json",
    JSON.stringify(sessionData, null, 2),
  );

  console.log("\n=== SESSION DATA DEBUG ===\n");
  console.log(`Service Name: ${sessionData.ServiceName}`);
  console.log(`Total Functions: ${sessionData.Functions.length}`);
  console.log(
    `Total Definitions: ${Object.keys(sessionData.Definitions).length}`,
  );

  console.log("\n=== FUNCTION DETAILS ===\n");

  for (const func of sessionData.Functions.slice(0, 5)) {
    // First 5 functions
    console.log(`\nFunction: ${func.Name}`);
    console.log(`  Description: ${func.Description}`);
    console.log(`  Parameters (${func.Parameters.length}):`);

    if (func.Parameters.length === 0) {
      console.log("    ⚠️  NO PARAMETERS FOUND!");
    } else {
      for (const param of func.Parameters) {
        console.log(`    - ${param.name}: ${JSON.stringify(param.schema)}`);
        console.log(`      Required: ${param.required}`);
      }
    }

    console.log(`  Return Type: ${JSON.stringify(func.ReturnType)}`);
  }

  console.log("\n=== DEFINITIONS ===\n");
  for (const [name, schema] of Object.entries(sessionData.Definitions).slice(
    0,
    3,
  )) {
    console.log(`${name}:`, JSON.stringify(schema, null, 2));
  }

  console.log("\n✅ Debug data written to session-data-debug.json");

  return sessionData;
}

// If running this file directly
if (require.main === module) {
  debugSessionData();
}
