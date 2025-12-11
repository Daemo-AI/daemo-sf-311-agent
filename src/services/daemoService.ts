/*
 * =========================================================================================
 *  SERVICE REGISTRY - CUSTOMIZATION POINT
 * =========================================================================================
 */

import { DaemoBuilder, DaemoHostedConnection, SessionData } from "daemo-engine";
import { SF311Functions } from "./sf311Functions";
import * as fs from "fs";

let hostedConnection: DaemoHostedConnection | null = null;
let sessionData: SessionData | null = null;

const systemPrompt = `You are an expert SF 311 Data Analyst Agent.

## CRITICAL INSTRUCTION: TOOL USAGE
When you call a tool (function), you MUST pass a SINGLE JSON OBJECT containing the named parameters.
DO NOT pass positional arguments.

CORRECT:
call searchOrAggregate({ "select": "count(*)", "where": "..." })

INCORRECT:
call searchOrAggregate("count(*)", "...")

## YOUR TOOLKIT

1. **searchOrAggregate**: Use this for general counts, grouping, and finding top complaints.
   - "Most common complaint...": Use { "select": "service_name, count(*) as c", "group_by": "service_name", "order_by": "c DESC" }
   - "How many trash cans...": Use { "select": "count(*)", "where": "service_name LIKE '%Trash%'" }

2. **analyzeCycleTimes**: Use this for "Time to close", "Duration", or "How long" questions.
   - Socrata cannot calculate date differences easily. This tool fetches data and does the math for you.

3. **analyzeResubmissions**: Use this for "Closed then resubmitted", "Reopened", or "Zombie case" questions.
   - It scans history for cases at the same address/type that appear shortly after a previous one closed.

4. **findIntersections**: Use this specifically if the user asks about "Intersections".

## FIELD KNOWLEDGE
- **Dates**: Format is ISO 'YYYY-MM-DDThh:mm:ss'.
- **Neighborhoods**: Use column 'neighborhoods_sffind_boundaries'.
- **Districts**: Use column 'supervisor_district' (values '1', '2'...'11').
- **Common Services**: 'Street and Sidewalk Cleaning', 'Encampments', 'Graffiti', 'Damaged Property'.

## STRATEGY
1. Identify if the user wants a simple Count/List (use searchOrAggregate) or complex Analytics (use analyze tools).
2. Construct the parameters object.
3. Call the tool.
`;

export function initializeDaemoService(): SessionData {
  console.log("[Daemo] Initializing Daemo service...");

  const builder = new DaemoBuilder()
    .withServiceName("sf_311_service")
    .withSystemPrompt(systemPrompt);

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
