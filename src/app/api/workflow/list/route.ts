import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow/list
 *
 * Enhanced workflow list endpoint supporting the collapsible history sidebar.
 * Supports pagination, filtering, sorting, and returns summary statistics.
 *
 * Query params:
 *   - limit: number (default: 50, max: 100) — items per page
 *   - cursor: string — opaque cursor for pagination (base64 encoded startedAt)
 *   - search: string — filter by title or epicId (case-insensitive)
 *   - status: "active" | "completed" | "error" | "all" (default: "all")
 *   - sort: "startedAt" | "title" | "phase" (default: "startedAt")
 *   - order: "asc" | "desc" (default: "desc")
 *   - includeStats: "true" | "false" (default: "true") — include summary counts
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Parse pagination params
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 100);
    const cursor = searchParams.get("cursor") || null;
    const search = searchParams.get("search")?.toLowerCase() || "";
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "startedAt";
    const order = searchParams.get("order") || "desc";
    const includeStats = searchParams.get("includeStats") !== "false";

    // Fetch all workflows from DynamoDB
    const allWorkflows = await listWorkflowsFromDynamo();

    // Filter by status
    let filtered = allWorkflows.filter((w: Record<string, unknown>) => {
      if (status === "all") return true;
      const phase = w.phase as string;
      if (status === "active") return phase !== "complete" && phase !== "error";
      if (status === "completed") return phase === "complete";
      if (status === "error") return phase === "error";
      return true;
    });

    // Filter by search query
    if (search) {
      filtered = filtered.filter((w: Record<string, unknown>) => {
        const input = w.input as { title?: string; description?: string } | undefined;
        const title = (input?.title || "").toLowerCase();
        const epicId = ((w.epicId as string) || "").toLowerCase();
        const id = ((w.id as string) || "").toLowerCase();
        return title.includes(search) || epicId.includes(search) || id.includes(search);
      });
    }

    // Sort
    filtered.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      let cmp = 0;
      if (sort === "startedAt") {
        cmp = new Date(b.startedAt as string).getTime() - new Date(a.startedAt as string).getTime();
      } else if (sort === "title") {
        const aTitle = ((a.input as { title?: string })?.title || "").toLowerCase();
        const bTitle = ((b.input as { title?: string })?.title || "").toLowerCase();
        cmp = aTitle.localeCompare(bTitle);
      } else if (sort === "phase") {
        cmp = ((a.phase as string) || "").localeCompare((b.phase as string) || "");
      }
      return order === "asc" ? cmp : -cmp;
    });

    // Calculate statistics before pagination (on filtered set matches "all" status for full stats)
    let stats = undefined;
    if (includeStats) {
      const total = allWorkflows.length;
      const active = allWorkflows.filter((w: Record<string, unknown>) => {
        const phase = w.phase as string;
        return phase !== "complete" && phase !== "error";
      }).length;
      const completed = allWorkflows.filter((w: Record<string, unknown>) => w.phase === "complete").length;
      const errorCount = allWorkflows.filter((w: Record<string, unknown>) => w.phase === "error").length;

      stats = { total, active, completed, error: errorCount, filtered: filtered.length };
    }

    // Apply cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      try {
        const decodedCursor = Buffer.from(cursor, "base64").toString("utf-8");
        const cursorIndex = filtered.findIndex(
          (w: Record<string, unknown>) => (w.id as string) === decodedCursor
        );
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      } catch {
        // Invalid cursor — start from beginning
      }
    }

    const page = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;
    const nextCursor = hasMore && page.length > 0
      ? Buffer.from(page[page.length - 1].id as string).toString("base64")
      : null;

    // Map to summary format for sidebar (lightweight payload)
    const workflows = page.map((w: Record<string, unknown>) => {
      const input = w.input as { title?: string; description?: string } | undefined;
      return {
        id: w.id,
        phase: w.phase,
        epicId: w.epicId,
        input: {
          title: input?.title || "Untitled",
          description: input?.description || "",
        },
        startedAt: w.startedAt,
        completedAt: w.completedAt || null,
        agentTaskCount: w.agentTasks ? Object.keys(w.agentTasks as Record<string, unknown>).length : 0,
      };
    });

    return NextResponse.json({
      workflows,
      pagination: {
        limit,
        hasMore,
        nextCursor,
        total: filtered.length,
      },
      ...(stats ? { stats } : {}),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[workflow/list] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workflows", details: (err as Error).message },
      { status: 500 }
    );
  }
}
