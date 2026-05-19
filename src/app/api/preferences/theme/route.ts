import { NextRequest } from "next/server";

/**
 * Theme preference type
 */
export type ThemePreference = "light" | "dark" | "system";

/**
 * In-memory storage for theme preferences
 * In a production app, this would be stored in a database
 * For now, we use a simple Map keyed by session ID
 */
const themeStorage = new Map<string, ThemePreference>();

/**
 * GET /api/preferences/theme
 * Get the current theme preference for the session
 * 
 * Returns:
 * - 200: { theme: "light" | "dark" | "system" }
 * - 404: { error: "Theme preference not found" }
 */
export async function GET(req: NextRequest) {
  try {
    // Get session ID from cookie or header
    const sessionId = req.cookies.get("session-id")?.value || req.headers.get("x-session-id") || "default";
    
    const theme = themeStorage.get(sessionId);
    
    if (!theme) {
      return Response.json(
        { theme: "system" }, // Default to system preference
        { status: 200 }
      );
    }
    
    return Response.json({ theme });
  } catch (error) {
    console.error("Get theme preference error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/preferences/theme
 * Update the theme preference for the session
 * 
 * Body: { theme: "light" | "dark" | "system" }
 * 
 * Returns:
 * - 200: { theme: "light" | "dark" | "system", updated: true }
 * - 400: { error: "Invalid theme value" }
 * - 500: { error: "Error message" }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { theme } = body;
    
    // Validate theme value
    if (!theme || !["light", "dark", "system"].includes(theme)) {
      return Response.json(
        { error: "Invalid theme value. Must be 'light', 'dark', or 'system'" },
        { status: 400 }
      );
    }
    
    // Get session ID from cookie or header
    const sessionId = req.cookies.get("session-id")?.value || req.headers.get("x-session-id") || "default";
    
    // Store the preference
    themeStorage.set(sessionId, theme as ThemePreference);
    
    return Response.json({ 
      theme, 
      updated: true 
    });
  } catch (error) {
    console.error("Update theme preference error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/preferences/theme
 * Reset the theme preference to system default
 * 
 * Returns:
 * - 200: { deleted: true }
 * - 500: { error: "Error message" }
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get session ID from cookie or header
    const sessionId = req.cookies.get("session-id")?.value || req.headers.get("x-session-id") || "default";
    
    // Remove the preference
    themeStorage.delete(sessionId);
    
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("Delete theme preference error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}