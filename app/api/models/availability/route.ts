import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if API key environment variables are set
    const openAiAvailable = !!process.env.OPENAI_API_KEY_ARN;
    const geminiAvailable = !!process.env.GEMINI_API_KEY_ARN;

    return NextResponse.json({
      openAiAvailable,
      geminiAvailable,
    });
  } catch (error) {
    console.error('Error checking model availability:', error);
    return NextResponse.json(
      { error: 'Failed to check model availability' },
      { status: 500 }
    );
  }
}
