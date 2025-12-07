import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler";
import { configDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import authController from "./controllers/authController";
import { authMiddleware } from "./middlewares/authMiddleware";
import { adminMiddleware } from "./middlewares/adminMiddleware";
import { CrmFunctions } from "./services/crmFunctions";
import {
  initializeDaemoService,
  startHostedConnection,
} from "./services/daemoService";
import agentController from "./controllers/agentController";

// Load environment variables
configDotenv();

// Initialize Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_KEY as string,
);

async function startServer() {
  try {
    // Test Supabase connection
    const { error } = await supabase.from("health_check").select("*").limit(1);

    if (error) {
      throw new Error(`Supabase connection error: ${error.message}`);
    }

    console.log("Connected to Supabase successfully!");

    // Initialize Daemo Service
    console.log("\n=== Initializing Daemo Service ===");
    const crmFunctions = new CrmFunctions();
    const sessionData = initializeDaemoService(crmFunctions);
    console.log(
      `Registered ${sessionData.Functions.length} CRM functions with Daemo`,
    );

    // Start hosted connection if API key is provided
    await startHostedConnection(sessionData);

    // Create a new express application instance
    const app = express();

    // Logging middleware
    app.use(morgan("dev"));

    // Add CORS middleware
    app.use(cors());

    // Middleware to parse JSON and URL-encoded bodies
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Error handling middleware
    app.use(errorHandler);

    // Define the root path with a greeting message
    app.get("/", (_: Request, res: Response) => {
      res.json({ message: "Welcome to Daemo CRM!" });
    });

    // --- PUBLIC ROUTES ---
    app.post("/auth/register", authController.register);
    app.post("/auth/login", authController.login);

    // --- PROTECTED ROUTES ---
    // Apply auth middleware to all routes defined after this line
    app.use(authMiddleware);

    // Define test endpoint with a greeting message
    app.get("/hello/:name", (req: Request, res: Response) => {
      res.json({ message: `Hello ${req.params.name ?? "World"}!` });
    });

    // Agent routes
    app.post("/agent/query", agentController.processQuery);
    app.post("/agent/query-stream", agentController.processQueryStreamed);
    app.post("/agent/threads", agentController.createThread);
    app.get("/agent/threads", agentController.listThreads);
    app.get("/agent/threads/:threadId", agentController.getThread);
    app.delete("/agent/threads/:threadId", agentController.deleteThread);

    // Set the network port
    const port = process.env.PORT || 5000;

    // Start the Express server
    app.listen(port, () => {
      console.log(`The server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Error starting service:\n", error);
    process.exit(1);
  }
}

startServer();
