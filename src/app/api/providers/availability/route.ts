import { NextResponse } from "next/server";
import type { ProviderAvailability } from "@/lib/workflow/types";

/**
 * GET /api/providers/availability
 * 
 * Returns which AI model providers are available based on environment configuration.
 * - Bedrock: Always available (uses IAM authentication)
 * - OpenAI: Available if OPENAI_API_KEY_ARN is set
 * - Gemini: Available if GEMINI_API_KEY_ARN is set
 */
export async function GET() {
  try {
    const availability: ProviderAvailability = {
      bedrock: true, // Always available via IAM
      openai: !!process.env.OPENAI_API_KEY_ARN,
      gemini: !!process.env.GEMINI_API_KEY_ARN,
    };

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error checking provider availability:", error);
    return NextResponse.json(
      { error: "Failed to check provider availability" },
      { status: 500 }
    );
  }
}
