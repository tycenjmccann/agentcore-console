/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ModelSelector from "@/components/ModelSelector";
import type { ModelConfig } from "@/lib/workflow/types";

// Mock fetch
global.fetch = jest.fn();

const mockModels = [
  {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5-v1:0",
    displayName: "Claude Sonnet 4.5",
    isDefault: true,
    description: "Recommended for most workflows",
  },
  {
    provider: "bedrock",
    modelId: "anthropic.claude-opus-v1:0",
    displayName: "Claude Opus",
    isDefault: false,
    description: "Most capable model",
  },
  {
    provider: "openai",
    modelId: "gpt-4-turbo",
    displayName: "GPT-4 Turbo",
    isDefault: false,
  },
];

describe("ModelSelector", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it("renders loading state initially", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    expect(screen.getByText(/loading available models/i)).toBeInTheDocument();
  });

  it("fetches and displays available models", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/select ai model/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/models");
    expect(screen.getByText(/claude sonnet 4\.5/i)).toBeInTheDocument();
    expect(screen.getByText(/claude opus/i)).toBeInTheDocument();
    expect(screen.getByText(/gpt-4 turbo/i)).toBeInTheDocument();
  });

  it("displays error state on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/will use default model/i)
    ).toBeInTheDocument();
  });

  it("displays empty state when no models available", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText(/no models available/i)).toBeInTheDocument();
    });
  });

  it("calls onChange with correct ModelConfig when selection changes", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/select ai model/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/select ai model/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "openai:gpt-4-turbo" } });

    expect(onChange).toHaveBeenCalledWith({
      provider: "openai",
      modelId: "gpt-4-turbo",
    });
  });

  it("calls onChange with undefined when default is selected", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const onChange = jest.fn();
    const initialValue: ModelConfig = {
      provider: "openai",
      modelId: "gpt-4-turbo",
    };
    render(<ModelSelector value={initialValue} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/select ai model/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/select ai model/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("renders disabled state correctly", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} disabled={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/select ai model/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/select ai model/i) as HTMLSelectElement;
    expect(select).toBeDisabled();
  });

  it("displays default option as first choice", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/select ai model/i)).toBeInTheDocument();
    });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent(/use default/i);
  });

  it("sorts default models to the top", async () => {
    const unsortedModels = [
      mockModels[2], // OpenAI (not default)
      mockModels[0], // Claude Sonnet (default)
      mockModels[1], // Claude Opus (not default)
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: unsortedModels }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/select ai model/i)).toBeInTheDocument();
    });

    const options = screen.getAllByRole("option");
    // First option is "Use Default", second should be the default model
    expect(options[1]).toHaveTextContent(/claude sonnet 4\.5.*\(default\)/i);
  });

  it("includes accessibility attributes", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const onChange = jest.fn();
    render(<ModelSelector onChange={onChange} />);

    await waitFor(() => {
      const select = screen.getByLabelText(/select ai model/i);
      expect(select).toHaveAttribute("aria-label");
      expect(select).toHaveAttribute("id", "model-selector");
    });
  });
});
