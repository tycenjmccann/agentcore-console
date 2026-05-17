import { NextResponse } from "next/server";
import type { ProviderAvailability } from "@/lib/workflow/types";

/**
 * GET /api/workflow/providers/availability
 * 
 * Check which AI model providers are available based on environment configuration.
 * - Bedrock: Always available (uses IAM authentication)
 * - OpenAI: Available if OPENAI_API_KEY_ARN is configured
 * - Gemini: Available if GEMINI_API_KEY_ARN is configured
 * 
 * Response is cached for 5 minutes to avoid repeated environment variable checks.
 */

let cachedAvailability: { data: ProviderAvailability; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Return cached result if still valid
    if (cachedAvailability && Date.now() - cachedAvailability.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedAvailability.data);
    }

    // Check environment variables for API key ARNs
    const openaiKeyArn = process.env.OPENAI_API_KEY_ARN;
    const geminiKeyArn = process.env.GEMINI_API_KEY_ARN;

    const availability: ProviderAvailability = {
      bedrock: true, // Always available via IAM
      openai: !!openaiKeyArn && openaiKeyArn.trim().length > 0,
      gemini: !!geminiKeyArn && geminiKeyArn.trim().length > 0,
    };

    // Update cache
    cachedAvailability = {
      data: availability,
      timestamp: Date.now(),
    };

    console.log("Provider availability check:", {
      bedrock: availability.bedrock,
      openai: availability.openai ? "configured" : "not configured",
      gemini: availability.gemini ? "configured" : "not configured",
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error checking provider availability:", error);
    
    // Return safe defaults on error (Bedrock only)
    return NextResponse.json(
      {
        bedrock: true,
        openai: false,
        gemini: false,
      },
      { status: 500 }
    );
  }
}
