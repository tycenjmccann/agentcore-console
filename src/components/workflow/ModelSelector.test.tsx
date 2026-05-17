import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModelSelector } from "./ModelSelector";
import type { ModelsResponse } from "@/lib/workflow/model-config";

// Mock fetch
global.fetch = jest.fn();

const mockModels: ModelsResponse = {
  models: [
    {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5",
      displayName: "Claude Sonnet 4.5",
      description: "Balanced performance and speed",
      isDefault: true,
    },
    {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-4",
      displayName: "Claude Opus 4",
      description: "Highest capability model",
      isDefault: false,
    },
    {
      provider: "openai",
      modelId: "gpt-4-turbo",
      displayName: "GPT-4 Turbo",
      description: "Fast and capable",
      isDefault: false,
    },
    {
      provider: "gemini",
      modelId: "gemini-pro",
      displayName: "Gemini Pro",
      isDefault: false,
    },
  ],
};

describe("ModelSelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    (fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ModelSelector value={null} onChange={jest.fn()} />);
    expect(screen.getByText("Loading models...")).toBeInTheDocument();
  });

  it("fetches and displays models", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(<ModelSelector value={null} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith("/api/models");
  });

  it("auto-selects default model", async () => {
    const onChange = jest.fn();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(<ModelSelector value={null} onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5",
      });
    });
  });

  it("displays selected model with default badge", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(
      <ModelSelector
        value={{ provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5" }}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4.5")).toBeInTheDocument();
    });

    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("[bedrock]")).toBeInTheDocument();
  });

  it("opens dropdown on button click", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(
      <ModelSelector
        value={{ provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5" }}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId("model-dropdown")).toBeInTheDocument();
    });
  });

  it("groups models by provider", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(
      <ModelSelector
        value={{ provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5" }}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("model-selector-button"));

    await waitFor(() => {
      expect(screen.getByText("bedrock")).toBeInTheDocument();
      expect(screen.getByText("openai")).toBeInTheDocument();
      expect(screen.getByText("gemini")).toBeInTheDocument();
    });
  });

  it("calls onChange when selecting a model", async () => {
    const onChange = jest.fn();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(
      <ModelSelector
        value={{ provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5" }}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("model-selector-button"));

    await waitFor(() => {
      expect(screen.getByTestId("model-dropdown")).toBeInTheDocument();
    });

    const opusOption = screen.getByTestId("model-option-bedrock-anthropic.claude-opus-4");
    fireEvent.click(opusOption);

    expect(onChange).toHaveBeenCalledWith({
      provider: "bedrock",
      modelId: "anthropic.claude-opus-4",
    });
  });

  it("shows error state on fetch failure", async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<ModelSelector value={null} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("retries fetch on retry button click", async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(<ModelSelector value={null} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    // Mock successful response for retry
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });
  });

  it("is disabled when disabled prop is true", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(
      <ModelSelector
        value={{ provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5" }}
        onChange={jest.fn()}
        disabled={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });

    const button = screen.getByTestId("model-selector-button");
    expect(button).toBeDisabled();
  });

  it("displays model descriptions", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    render(
      <ModelSelector
        value={{ provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5" }}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-selector-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("model-selector-button"));

    await waitFor(() => {
      expect(screen.getByText("Balanced performance and speed")).toBeInTheDocument();
      expect(screen.getByText("Highest capability model")).toBeInTheDocument();
    });
  });
});
