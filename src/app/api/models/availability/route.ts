import { NextResponse } from "next/server";
import type { ProviderAvailability } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const availability: ProviderAvailability = {
      bedrock: true, // Always available via IAM
      openai: !!process.env.OPENAI_API_KEY_ARN,
      gemini: !!process.env.GEMINI_API_KEY_ARN,
    };

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error checking model availability:", error);
    return NextResponse.json(
      { error: "Failed to check model availability" },
      { status: 500 }
    );
  }
}
