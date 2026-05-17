import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables for API keys
    const openaiKeyArn = process.env.OPENAI_API_KEY_ARN;
    const geminiKeyArn = process.env.GEMINI_API_KEY_ARN;

    return NextResponse.json({
      bedrock: true, // Always available via IAM
      openai: !!openaiKeyArn,
      gemini: !!geminiKeyArn,
    });
  } catch (error) {
    console.error('Error checking model availability:', error);
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
