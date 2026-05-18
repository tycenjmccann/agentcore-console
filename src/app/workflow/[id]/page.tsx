import PipelineVisualization from "@/components/workflow/PipelineVisualization";

interface WorkflowPageProps {
  params: { id: string };
}

export default function WorkflowPage({ params }: WorkflowPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Workflow Pipeline</h1>
        <a
          href="/tickets"
          className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          View Tickets →
        </a>
      </div>
      <PipelineVisualization workflowId={params.id} />
    </div>
  );
}
