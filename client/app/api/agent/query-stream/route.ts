import { NextRequest } from "next/server";

export const maxDuration = 120; // Allow up to 2 minutes for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to the Express backend's streaming endpoint
    const response = await fetch("http://localhost:5000/agent/query-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: errorText || "Backend error" }),
        { 
          status: response.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Check if we got a stream back
    if (!response.body) {
      return new Response(
        JSON.stringify({ error: "No response body from backend" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Create a TransformStream to pipe the SSE data through
    const { readable, writable } = new TransformStream();
    
    // Pipe the backend response to our response
    response.body.pipeTo(writable);

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Streaming proxy error:", error);
    
    if (error instanceof Error) {
      // Connection refused or other network error
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        return new Response(
          JSON.stringify({ error: "Backend server is not running. Please start the backend with 'npm run dev' in the root directory." }),
          { 
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
