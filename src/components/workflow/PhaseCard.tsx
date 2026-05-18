"use client";

import { cn } from "@/lib/utils";
import type { PipelinePhaseConfig, PhaseStatus, PipelineItemStatus } from "@/lib/workflow/pipeline-types";

interface PhaseCardProps {
  phase: PipelinePhaseConfig;
  status: PhaseStatus;
  itemStatuses: Record<string, PipelineItemStatus>;
}

export default function PhaseCard({ phase, status, itemStatuses }: PhaseCardProps) {
  const boxClass = cn(
    "agent-box",
    status === "active" && "awake",
    status === "done" && "done"
  );

  return (
    <div
      className={cn("phase-card w-[290px] flex flex-col items-center", status)}
      id={phase.id}
    >
      {/* Agent Box */}
      <div className={boxClass}>
        <div className="text-[8px] text-[#64748b] tracking-[2px] uppercase">
          Phase {phase.phaseNumber}
        </div>
        <div className="text-[15px] font-bold text-[#e2e8f0] mt-0.5">
          {phase.name}
        </div>
        <div
          className={cn(
            "phase-type-badge inline-flex items-center gap-1 mt-[5px] px-2 py-[3px] rounded-[5px] text-[9px] font-semibold tracking-[0.5px]",
            phase.phaseType
          )}
        >
          {phase.phaseType === "app" ? "Web Application" : `${getAgentCount(phase)} AgentCore Harness Agent${getAgentCount(phase) > 1 ? "s" : ""}`}
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-0 mt-2 items-center">
          {phase.identity.icons.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                {phase.identity.icons.map((icon, i) => (
                  <ServiceIcon key={i} type={icon} size={20} />
                ))}
              </div>
              <div className="flex flex-col gap-1 text-left">
                {phase.identity.lines.map((line, i) => (
                  <div key={i} className="text-[8.5px] text-[#94a3b8] leading-5 h-5 flex items-center">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[8.5px] text-[#94a3b8] text-center leading-[1.4]">
              {phase.identity.lines[0]}
            </div>
          )}
        </div>

        {/* Config Details */}
        <div className="mt-[6px] p-[5px_8px] bg-[#0f141980] rounded-[5px] border border-[#1e293b] text-left">
          {phase.configDetails.map((cfg, i) => (
            <div key={i} className="flex items-center gap-1 text-[8px] text-[#64748b] leading-[1.6]">
              <span className="text-[#475569] font-semibold min-w-[52px]">{cfg.key}</span>
              <span className="text-[#94a3b8]">{cfg.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Work Area - Sections */}
      <div className="w-full mt-2 flex flex-col gap-[3px]">
        {phase.sections.map((section, si) => (
          <div key={si}>
            <div className="text-[7px] text-[#475569] tracking-[1.5px] uppercase mt-[6px] mb-[2px] pl-[3px]">
              {section.label}
            </div>
            {section.items.map((item) => {
              const itemStatus = itemStatuses[item.id] || "idle";
              return (
                <div
                  key={item.id}
                  className={cn("pipeline-item", itemStatus)}
                  id={item.id}
                >
                  {item.icon ? (
                    <ServiceIcon type={item.icon} size={16} />
                  ) : item.dot ? (
                    <span
                      className={cn(
                        "w-[6px] h-[6px] rounded-full flex-shrink-0",
                        item.dot === "skill" ? "bg-[#a855f7]" : "bg-[#64748b]"
                      )}
                    />
                  ) : null}
                  <span className="item-label text-[10px] font-medium text-[#94a3b8] leading-[1.15] transition-colors duration-300">
                    {item.label}
                  </span>
                  <span className="item-status-dot w-[6px] h-[6px] rounded-full bg-[#1e293b] ml-auto flex-shrink-0 transition-colors duration-300" />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getAgentCount(phase: PipelinePhaseConfig): number {
  const agentSection = phase.sections.find(
    (s) => s.label.toLowerCase().includes("agent")
  );
  if (!agentSection) return 1;
  return agentSection.items.length;
}

function ServiceIcon({ type, size = 16 }: { type: string; size?: number }) {
  // Use colored placeholder squares matching the mockup icon style
  const colors: Record<string, string> = {
    agentcore: "bg-purple-600/80",
    bedrock: "bg-blue-600/80",
    s3: "bg-green-600/80",
    eventbridge: "bg-pink-600/80",
    "code-interpreter": "bg-orange-600/80",
  };

  const labels: Record<string, string> = {
    agentcore: "AC",
    bedrock: "BR",
    s3: "S3",
    eventbridge: "EB",
    "code-interpreter": "CI",
  };

  return (
    <span
      className={cn(
        "rounded-[3px] flex items-center justify-center flex-shrink-0 text-white font-bold",
        colors[type] || "bg-gray-600/80"
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={type}
    >
      {labels[type] || "?"}
    </span>
  );
}
