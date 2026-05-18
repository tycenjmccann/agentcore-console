"use client";

/**
 * Legend bar for the pipeline visualization.
 * Shows AWS service icons and dot indicators matching the mockup.
 */

export default function PipelineLegend() {
  return (
    <div className="flex gap-[18px] mb-[14px] text-[10px] text-[#64748b] flex-wrap justify-center">
      <LegendIcon label="Amazon Bedrock" type="bedrock" />
      <LegendIcon label="Bedrock AgentCore" type="agentcore" />
      <LegendIcon label="Amazon S3" type="s3" />
      <LegendIcon label="Amazon EventBridge" type="eventbridge" />
      <LegendIcon label="Code Interpreter" type="code-interpreter" />
      <LegendDot label="Loaded Skill" color="bg-[#a855f7]" />
      <LegendDot label="External" color="bg-[#64748b]" />
    </div>
  );
}

function LegendIcon({ label, type }: { label: string; type: string }) {
  const colors: Record<string, string> = {
    agentcore: "bg-purple-600/80",
    bedrock: "bg-blue-600/80",
    s3: "bg-green-600/80",
    eventbridge: "bg-pink-600/80",
    "code-interpreter": "bg-orange-600/80",
  };

  const abbr: Record<string, string> = {
    agentcore: "AC",
    bedrock: "BR",
    s3: "S3",
    eventbridge: "EB",
    "code-interpreter": "CI",
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={`w-[18px] h-[18px] rounded-[3px] flex items-center justify-center text-white text-[7px] font-bold ${colors[type]}`}
      >
        {abbr[type]}
      </span>
      <span>{label}</span>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`w-[7px] h-[7px] rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
