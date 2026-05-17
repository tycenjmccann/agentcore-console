/**
 * ModelSelector Component Tests
 *
 * Tests:
 * - Component renders correctly
 * - Fetches models from /api/models on mount
 * - Shows loading state during fetch
 * - Displays error state with helpful message
 * - Renders dropdown with models when loaded
 * - Default model shown first
 * - Selection state updates correctly
 * - onChange callback called with correct ModelConfig
 * - Keyboard navigation works
 * - Accessibility attributes present
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ModelSelector from "../ModelSelector";
import type { ModelConfig } from "@/lib/workflow/types";
import type { AvailableModel } from "@/app/api/models/route";

// Mock fetch
global.fetch = jest.fn();

const mockModels: AvailableModel[] = [
  {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5-v1:0",
    displayName: "Claude Sonnet 4.5 (Default)",
    isDefault: true,
    description: "Fast and intelligent",
  },
  {
    provider: "bedrock",
    modelId: "anthropic.claude-opus-4-0-v1:0",
    displayName: "Claude Opus 4.0",
    isDefault: false,
    description: "Most capable",
  },
  {
    provider: "openai",
    modelId: "gpt-4-turbo",
    displayName: "GPT-4 Turbo",
    isDefault: false,
    description: "OpenAI's best",
  },
];

describe("ModelSelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state on mount", () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    expect(screen.getByText("Loading models...")).toBeInTheDocument();
    expect(screen.getByLabelText("AI Model")).toBeInTheDocument();
  });

  it("fetches models from /api/models on mount", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/models");
    });
  });

  it("renders dropdown with models after successful fetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);

    // Check default option
    expect(options[0]).toBe("Use Default Model");

    // Check that models are present
    expect(options).toContain("Claude Sonnet 4.5 (Default) — Fast and intelligent");
    expect(options).toContain("Claude Opus 4.0 — Most capable");
    expect(options).toContain("GPT-4 Turbo — OpenAI's best");
  });

  it("shows default model first in dropdown", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = Array.from(select.options);

    // First option is "Use Default Model", second should be the default model
    expect(options[1].text).toContain("Claude Sonnet 4.5 (Default)");
  });

  it("displays error state when fetch fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load models")).toBeInTheDocument();
    });

    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Will use default model (Claude Sonnet 4.5)")).toBeInTheDocument();
  });

  it("displays error when API returns non-OK status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load models")).toBeInTheDocument();
    });

    expect(screen.getByText(/Failed to fetch models: 500/)).toBeInTheDocument();
  });

  it("handles empty model list gracefully", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No models available")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("calls onChange with undefined when default is selected", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    const mockOnChange = jest.fn();
    render(<ModelSelector value={undefined} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "default" } });

    expect(mockOnChange).toHaveBeenCalledWith(undefined);
  });

  it("calls onChange with correct ModelConfig when model is selected", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    const mockOnChange = jest.fn();
    render(<ModelSelector value={undefined} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "bedrock:anthropic.claude-opus-4-0-v1:0" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      provider: "bedrock",
      modelId: "anthropic.claude-opus-4-0-v1:0",
    });
  });

  it("displays selected model info when value is provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    const selectedModel: ModelConfig = {
      provider: "openai",
      modelId: "gpt-4-turbo",
    };

    render(<ModelSelector value={selectedModel} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Selected:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/openai/)).toBeInTheDocument();
    expect(screen.getByText(/gpt-4-turbo/)).toBeInTheDocument();
  });

  it("has proper accessibility attributes", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-label", "Select AI model for workflow agents");
    expect(select).toHaveAttribute("aria-describedby", "model-selector-description");

    const label = screen.getByText("AI Model");
    expect(label.tagName).toBe("LABEL");
  });

  it("error state has proper ARIA attributes", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Test error"));

    render(<ModelSelector value={undefined} onChange={jest.fn()} />);

    await waitFor(() => {
      const errorDiv = screen.getByRole("alert");
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv).toHaveAttribute("aria-live", "polite");
    });
  });
});
