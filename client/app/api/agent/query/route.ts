import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // Allow up to 2 minutes for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Create an AbortController for timeout (90 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch("http://localhost:5000/agent/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || "Backend error" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timed out. Please try a more specific query." },
          { status: 504 }
        );
      }
      
      // Connection refused or other network error
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        return NextResponse.json(
          { error: "Backend server is not running. Please start the backend with 'npm run dev' in the root directory." },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
