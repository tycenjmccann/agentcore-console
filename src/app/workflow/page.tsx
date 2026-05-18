import PipelineBoard from "@/components/workflow/PipelineBoard";

export const metadata = {
  title: "Architecture Pipeline | Agentis Hub",
  description: "Autonomous Multi-Agent Development Pipeline visualization",
};

export default function WorkflowPage() {
  return (
    <div className="min-h-screen py-4">
      <PipelineBoard />
    </div>
  );
}
