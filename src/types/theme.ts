/**
 * Theme preference types for the application
 */

/**
 * Valid theme values
 */
export type ThemePreference = "light" | "dark" | "system";

/**
 * Theme preference API response
 */
export interface ThemePreferenceResponse {
  theme: ThemePreference;
}

/**
 * Theme preference update request
 */
export interface UpdateThemeRequest {
  theme: ThemePreference;
}

/**
 * Theme preference update response
 */
export interface UpdateThemeResponse {
  theme: ThemePreference;
  updated: boolean;
}

/**
 * Theme preference delete response
 */
export interface DeleteThemeResponse {
  deleted: boolean;
}

/**
 * API error response
 */
export interface ThemeApiError {
  error: string;
}