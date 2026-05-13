import { Task, TaskEvent, Blueprint, Agent } from "./types";

const ABCA_API_URL = process.env.ABCA_API_URL || "";
const ABCA_API_KEY = process.env.ABCA_API_KEY || "";

async function abcaFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${ABCA_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(ABCA_API_KEY ? { "x-api-key": ABCA_API_KEY } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`ABCA API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Tasks
export async function listTasks(): Promise<Task[]> {
  return abcaFetch<Task[]>("/tasks");
}

export async function getTask(taskId: string): Promise<Task> {
  return abcaFetch<Task>(`/tasks/${taskId}`);
}

export async function createTask(params: {
  task_description: string;
  repo: string;
  issue_number?: number;
}): Promise<Task> {
  return abcaFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function cancelTask(taskId: string): Promise<void> {
  await abcaFetch(`/tasks/${taskId}/cancel`, { method: "POST" });
}

// Task Events
export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  return abcaFetch<TaskEvent[]>(`/tasks/${taskId}/events`);
}

// Blueprints
export async function listBlueprints(): Promise<Blueprint[]> {
  return abcaFetch<Blueprint[]>("/blueprints");
}

export async function getBlueprint(blueprintId: string): Promise<Blueprint> {
  return abcaFetch<Blueprint>(`/blueprints/${blueprintId}`);
}

// Agents (may map to blueprints in ABCA)
export async function listAgents(): Promise<Agent[]> {
  return abcaFetch<Agent[]>("/agents");
}

export async function getAgent(agentId: string): Promise<Agent> {
  return abcaFetch<Agent>(`/agents/${agentId}`);
}

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    await abcaFetch("/health");
    return true;
  } catch {
    return false;
  }
}
