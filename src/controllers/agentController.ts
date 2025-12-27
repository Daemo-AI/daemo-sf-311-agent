/*
 * =========================================================================================
 *  CORE ENGINE CONTROLLER - DO NOT MODIFY
 * =========================================================================================
 *
 * This controller handles the low-level communication with the Daemo Agent API.
 * It manages:
 * - Query processing
 * - Streaming responses
 * - Thread management (history)
 * - LLM context and configuration
 *
 * All business logic and custom tools should be defined in 'src/services'.
 * =========================================================================================
 */

/**
 * Agent Controller - Handles AI agent queries and thread management
 */

import { Request, Response } from "express";
import { DaemoClient, StorageConfig } from "daemo-engine";
import { getSessionData } from "../services/daemoService";

// Lazy-load the client - don't instantiate until first use
let daemoClient: DaemoClient | null = null;

function getDaemoClient(): DaemoClient {
  if (!daemoClient) {
    // --- FIX: Use DAEMO_GATEWAY_URL consistent with daemoService.ts for clarity ---
    const agentUrl = process.env.DAEMO_GATEWAY_URL || "localhost:50052";
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

// --- FIX: Centralize StorageConfig creation ---
function buildStorageConfig(): StorageConfig | undefined {
  // If no persistent storage is configured, we explicitly return undefined.
  // This helps catch configuration errors early.
  console.warn(
    "[Agent Controller] No storage configured. Agent memory will not be persistent.",
  );
  return undefined;
}

function buildLlmConfig(max_tokens?: number) {
  const provider = process.env.LLM_PROVIDER || "gemini";
  const llmConfig: any = {
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
      // Optional: log a warning if you support custom providers
      console.warn(
        `[Agent Controller] No explicit API key mapping for provider '${provider}'.`,
      );
  }

  return llmConfig;
}

/**
 * Process a natural language query with the AI agent
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

    // Prepare LLM config from environment
    const llmConfig = buildLlmConfig(max_tokens);

    // --- FIX: Use the helper to build storage config ---
    const storageConfig = buildStorageConfig();

    // Get the client (will be created on first call)
    const client = getDaemoClient();

    // Process query
    const result = await client.processQuery(query, {
      threadId: thread_id,
      sessionId: sessionData.ServiceName,
      llmConfig,
      storageConfig,
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

  // Prepare LLM config from environment
  const llmConfig = buildLlmConfig(max_tokens);

  // Get the client (will be created on first call)
  const client = getDaemoClient();

  const onData = (data: any) => {
    res.write(`data: ${JSON.stringify(data, null, 2)}\n\n`);
  };

  const onError = (error: Error) => {
    console.error("Stream error: ", error);
    res.write(
      `event: error\ndata: ${JSON.stringify({ message: error.message }, null, 2)}\n\n`,
    );
    res.end();
  };

  const onEnd = () => {
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
        llmConfig,
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

    // Prepare storage config
    const storageConfig = buildStorageConfig();

    const client = getDaemoClient();
    const result = await client.createThread(
      sessionData.ServiceName,
      storageConfig,
    );

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

    // Prepare storage config
    const storageConfig = buildStorageConfig();

    const client = getDaemoClient();
    const result = await client.listThreads(
      sessionData.ServiceName,
      storageConfig,
    );

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

    // Prepare storage config
    const storageConfig = buildStorageConfig();

    const client = getDaemoClient();
    const result = await client.getThread(threadId, storageConfig);

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

    // Prepare storage config
    const storageConfig = buildStorageConfig();

    const client = getDaemoClient();
    const result = await client.deleteThread(threadId, storageConfig);

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
