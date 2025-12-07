/**
 * Daemo Service - Registers CRM functions with the Daemo SDK
 */

import { DaemoBuilder, DaemoHostedConnection, SessionData } from "daemo-engine";
import { CrmFunctions } from "./crmFunctions";
import * as fs from "fs";

let hostedConnection: DaemoHostedConnection | null = null;
let sessionData: SessionData | null = null;

/**
 * Initialize Daemo service and register all CRM functions
 */
export function initializeDaemoService(
  crmFunctions: CrmFunctions,
): SessionData {
  console.log("[Daemo] Initializing Daemo service...");

  const builder = new DaemoBuilder().withServiceName("crm_service")
    .withSystemPrompt(`You are a helpful CRM assistant with access to a customer relationship management system.

You can help users:
- Manage contacts (create, read, update, delete)
- Manage deals (create, read, update, delete, change stages)
- Manage notes (create, read, search with semantic similarity)
- Manage users

When users ask questions, use the available functions to retrieve or modify data.
Always be helpful, accurate, and provide relevant information from the CRM database.

Important guidelines:
- When creating contacts, deals, or notes, ensure all required fields are provided
- Email addresses must be unique for contacts
- Deal stages follow a specific pipeline: Lead Identified -> Meeting Scheduled -> Demo Completed -> Proposal Sent -> Follow-Up -> Contract Sent -> Closed Won/Lost
- Notes support semantic search using embeddings
- Always validate IDs before operations
- Provide clear error messages if operations fail`);

  // Register the CRM service with all decorated functions
  builder.registerService(crmFunctions);

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
  const crmFunctions = new CrmFunctions();
  const builder = new DaemoBuilder().withServiceName("crm_service");

  // Register service
  builder.registerService(crmFunctions);

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
