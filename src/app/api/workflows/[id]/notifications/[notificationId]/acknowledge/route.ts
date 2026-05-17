import { NextRequest, NextResponse } from "next/server";
import { workflowStore } from "../../../../route";

// POST /api/workflows/[id]/notifications/[notificationId]/acknowledge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  try {
    const { id, notificationId } = await params;
    const workflow = workflowStore.get(id);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const notification = workflow.humanNotifications.find(
      (n) => n.id === notificationId
    );

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    notification.acknowledged = true;
    workflowStore.set(id, workflow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging notification:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge notification" },
      { status: 500 }
    );
  }
}
