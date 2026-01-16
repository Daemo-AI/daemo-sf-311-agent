/*
 * =========================================================================================
 *  CORE ENGINE CONTROLLER - DO NOT MODIFY
 * =========================================================================================
 *
 * This controller handles the low-level communication with the Daemo Agent API.
 * It manages:
 * - Query processing (via HTTP REST API)
 * - Streaming responses (via Server-Sent Events)
 * - Thread management (history)
 * - LLM context and configuration
 *
 * All business logic and custom tools should be defined in 'src/services'.
 * =========================================================================================
 */

/**
 * Agent Controller - Handles AI agent queries and thread management
 * Now uses HTTP REST endpoints instead of gRPC for improved reliability
 */

import { Request, Response } from "express";
import { DaemoClient, LlmConfig } from "daemo-engine";
import { getSessionData } from "../services/daemoService";

// Lazy-load the gRPC client
let daemoClient: DaemoClient | null = null;

function getDaemoClient(): DaemoClient {
  if (!daemoClient) {
    const agentUrl = process.env.DAEMO_GATEWAY_URL || "https://engine.daemo.ai:50052";
    console.log(
      "[Agent Controller] Initializing DaemoClient with URL:",
      agentUrl,
    );
    daemoClient = new DaemoClient({
      daemoAgentUrl: agentUrl,
      agentApiKey: process.env.DAEMO_AGENT_API_KEY,
    });
  }
  return daemoClient;
}

// Helper to build LLM config only if environment variables are present
function buildLlmConfig(max_tokens?: number): LlmConfig | undefined {
  const provider = process.env.LLM_PROVIDER;

  // If no provider is set in the environment, return undefined.
  // This tells the Daemo Engine to use its internal default (Phase 1) configuration.
  if (!provider) {
    console.log(
      "[Agent Controller] No LLM_PROVIDER set. Using Engine defaults.",
    );
    return undefined;
  }

  const llmConfig: LlmConfig = {
    provider,
    maxTokens: max_tokens,
  };

  if (process.env.LLM_MODEL) {
    llmConfig.model = process.env.LLM_MODEL;
  }

  // Choose API key based strictly on provider
  switch (provider) {
    case "gemini":
      llmConfig.apiKey = process.env.GEMINI_API_KEY;
      break;
    case "anthropic":
      llmConfig.apiKey = process.env.ANTHROPIC_API_KEY;
      break;
    case "openai":
      llmConfig.apiKey = process.env.OPENAI_API_KEY;
      break;
    default:
      console.log(
        `[Agent Controller] Using provider '${provider}'. API Key will be handled by environment or Engine.`,
      );
  }

  return llmConfig;
}

/**
 * Process a natural language query with the AI agent using HTTP REST
 * POST /agent/query
 */
const processQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = undefined;
    const { query, thread_id, context, max_tokens, analysis_mode } = req.body;

    if (!query) {
      res.status(400).json({ error: "Query is required" });
      return;
    }

    // Get session data
    const sessionData = getSessionData();
    if (!sessionData) {
      res.status(500).json({
        error: "Daemo service not initialized",
      });
      return;
    }

    // Use gRPC client with retry logic for query processing
    const client = getDaemoClient();
    const llmConfig = buildLlmConfig(max_tokens);

    // Retry logic for transient gRPC errors
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await client.processQuery(query, {
          threadId: thread_id,
          sessionId: sessionData.ServiceName,
          llmConfig,
          role,
          contextJson: context ? JSON.stringify(context) : undefined,
          analysisMode: analysis_mode,
        });

        res.status(200).json({
          success: result.success,
          response: result.response,
          threadId: result.threadId,
          toolInteractions: result.toolInteractions,
          executionTimeMs: result.executionTimeMs,
        });
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`[Agent Controller] Query attempt ${attempt}/3 failed:`, error.message);
        
        // Only retry on connection errors
        if (error.code === 14 || error.message?.includes("UNAVAILABLE") || error.message?.includes("ECONNRESET")) {
          if (attempt < 3) {
            console.log(`[Agent Controller] Retrying in ${attempt * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            // Reset the client to force reconnection
            daemoClient = null;
            continue;
          }
        }
        throw error;
      }
    }
    
    throw lastError || new Error("Query failed after retries");
  } catch (error: any) {
    console.error("Error processing query:", error);
    res.status(500).json({
      error: "Failed to process query",
      message: error.message,
    });
  }
};

/**
 * Process a natural language query with the AI agent and stream the response
 * POST /agent/query-stream
 */
const processQueryStreamed = (req: Request, res: Response) => {
  const role = undefined;
  const { query, thread_id, context, max_tokens, analysis_mode } = req.body;

  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  // Get session data
  const sessionData = getSessionData();
  if (!sessionData) {
    res.status(500).json({
      error: "Daemo service not initialized",
    });
    return;
  }

  // Set headers for Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Prepare LLM config (undefined if no env vars set)
  const llmConfig = buildLlmConfig(max_tokens);

  // Get the client (will be created on first call)
  const client = getDaemoClient();

  // Transform SDK events to the expected frontend format
  const onData = (data: any) => {
    console.log("[Stream] Received data:", JSON.stringify(data).slice(0, 200));
    
    // The SDK may send data with or without a type field
    // We need to transform it to match the expected frontend format
    let transformedData = data;
    
    // If the data already has a type, pass it through
    if (data.type) {
      transformedData = data;
    }
    // If it looks like a final response (has 'success' and 'response' fields)
    else if (data.success !== undefined && data.response !== undefined) {
      transformedData = {
        type: "finalResponse",
        ...data
      };
    }
    // If it looks like a tool call (has 'toolName' and 'parameters')
    else if (data.toolName && data.parameters !== undefined) {
      transformedData = {
        type: "toolCall",
        toolName: data.toolName,
        parameters: data.parameters
      };
    }
    // If it looks like a tool result (has 'toolName' and 'result' or 'success')
    else if (data.toolName && (data.result !== undefined || data.success !== undefined)) {
      transformedData = {
        type: "toolResult",
        toolName: data.toolName,
        success: data.success ?? true,
        result: data.result,
        errorMessage: data.errorMessage
      };
    }
    // If it looks like a thought/content event
    else if (data.content && typeof data.content === 'string') {
      transformedData = {
        type: "thought",
        content: data.content
      };
    }
    
    res.write(`data: ${JSON.stringify(transformedData)}\n\n`);
  };

  const onError = (error: Error) => {
    console.error("Stream error: ", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`,
    );
    res.end();
  };

  const onEnd = () => {
    console.log("[Stream] Stream ended");
    res.write(`event: end\ndata: {}\n\n`);
    res.end();
  };

  try {
    const stream = client.processQueryStreamed(
      query,
      { onData, onError, onEnd },
      {
        threadId: thread_id,
        sessionId: sessionData.ServiceName,
        llmConfig, // If undefined, Engine uses default
        role,
        contextJson: context ? JSON.stringify(context) : undefined,
        analysisMode: analysis_mode,
      },
    );

    // Handle client closing connection
    res.on("close", () => {
      console.log("Client closed connection. Cancelling gRPC stream.");
      stream.cancel();
    });
  } catch (error) {
    console.error("Synchronous error during stream initiation: ", error);
    res.status(500).send("Failed to initiate agent stream.");
  }
};

/**
 * Create a new conversation thread
 * POST /agent/threads
 */
const createThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionData = getSessionData();
    if (!sessionData) {
      res.status(500).json({ error: "Daemo service not initialized" });
      return;
    }

    const client = getDaemoClient();

    const result = await client.createThread(sessionData.ServiceName);

    res.status(201).json({
      success: result.success,
      threadId: result.threadId,
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    console.error("Error creating thread:", error);
    res.status(500).json({
      error: "Failed to create thread",
      message: error.message,
    });
  }
};

/**
 * List all threads
 * GET /agent/threads
 */
const listThreads = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionData = getSessionData();
    if (!sessionData) {
      res.status(500).json({ error: "Daemo service not initialized" });
      return;
    }

    const client = getDaemoClient();

    const result = await client.listThreads(sessionData.ServiceName);

    res.status(200).json({
      success: result.success,
      threads: result.threads,
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    console.error("Error listing threads:", error);
    res.status(500).json({
      error: "Failed to list threads",
      message: error.message,
    });
  }
};

/**
 * Get a specific thread
 * GET /agent/threads/:threadId
 */
const getThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params;

    const client = getDaemoClient();

    const result = await client.getThread(threadId);

    res.status(200).json({
      success: result.success,
      thread: result.thread,
      recentMessages: result.recentMessages,
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    console.error("Error getting thread:", error);
    res.status(500).json({
      error: "Failed to get thread",
      message: error.message,
    });
  }
};

/**
 * Delete a thread
 * DELETE /agent/threads/:threadId
 */
const deleteThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params;

    const client = getDaemoClient();

    const result = await client.deleteThread(threadId);

    res.status(200).json({
      success: result.success,
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    console.error("Error deleting thread:", error);
    res.status(500).json({
      error: "Failed to delete thread",
      message: error.message,
    });
  }
};

export default {
  processQuery,
  processQueryStreamed,
  createThread,
  listThreads,
  getThread,
  deleteThread,
};
