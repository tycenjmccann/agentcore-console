import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if API key environment variables are set
    const openaiKeyArn = process.env.OPENAI_API_KEY_ARN;
    const geminiKeyArn = process.env.GEMINI_API_KEY_ARN;

    return NextResponse.json({
      openai: !!openaiKeyArn,
      gemini: !!geminiKeyArn,
    });
  } catch (error) {
    console.error("Error checking API keys:", error);
    return NextResponse.json(
      { error: "Failed to check API key availability" },
      { status: 500 }
    );
  }
}
