"use client";

import { Rocket, Play, Square, RotateCcw, Clock, Cpu, Server } from "lucide-react";

interface Deployment {
  agent_name: string;
  agent_id: string;
  status: "RUNNING" | "STOPPED" | "DEPLOYING" | "ERROR";
  version: string;
  blueprint: string;
  compute_type: string;
  uptime: string;
  last_deployed: string;
}

const deployments: Deployment[] = [
  { agent_name: "Backend Agent", agent_id: "agent-backend-001", status: "RUNNING", version: "v2.4.1", blueprint: "Backend Blueprint", compute_type: "STANDARD", uptime: "5d 12h", last_deployed: "2026-05-08" },
  { agent_name: "iOS Agent", agent_id: "agent-ios-001", status: "RUNNING", version: "v1.8.0", blueprint: "iOS Blueprint", compute_type: "LARGE", uptime: "3d 6h", last_deployed: "2026-05-10" },
  { agent_name: "Android Agent", agent_id: "agent-android-001", status: "RUNNING", version: "v1.5.2", blueprint: "Android Blueprint", compute_type: "STANDARD", uptime: "2d 18h", last_deployed: "2026-05-11" },
  { agent_name: "Security Agent", agent_id: "agent-security-001", status: "RUNNING", version: "v3.1.0", blueprint: "Security Blueprint", compute_type: "MICRO", uptime: "7d 0h", last_deployed: "2026-05-06" },
  { agent_name: "Analytics Agent", agent_id: "agent-analytics-001", status: "STOPPED", version: "v1.2.0", blueprint: "Analytics Blueprint", compute_type: "MICRO", uptime: "-", last_deployed: "2026-05-05" },
  { agent_name: "Localization Agent", agent_id: "agent-localization-001", status: "STOPPED", version: "v1.0.1", blueprint: "Localization Blueprint", compute_type: "MICRO", uptime: "-", last_deployed: "2026-05-03" },
];

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  RUNNING: { bg: "bg-green-400/10 border-green-400/30", text: "text-green-400", label: "Running" },
  STOPPED: { bg: "bg-gray-400/10 border-gray-400/30", text: "text-gray-400", label: "Stopped" },
  DEPLOYING: { bg: "bg-yellow-400/10 border-yellow-400/30", text: "text-yellow-400", label: "Deploying" },
  ERROR: { bg: "bg-red-400/10 border-red-400/30", text: "text-red-400", label: "Error" },
};

export default function DeployPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {deployments.filter(d => d.status === "RUNNING").length} of {deployments.length} agents running
        </p>
        <button className="btn-primary flex items-center gap-2 text-sm" data-testid="deploy-new-btn">
          <Rocket className="w-4 h-4" />
          Deploy New Agent
        </button>
      </div>

      <div className="space-y-3">
        {deployments.map((dep) => {
          const style = statusStyles[dep.status];
          return (
            <div key={dep.agent_id} className="card" data-testid={`deploy-card-${dep.agent_id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    dep.status === "RUNNING" ? "bg-green-400/10" : "bg-surface-3"
                  }`}>
                    <Server className={`w-5 h-5 ${dep.status === "RUNNING" ? "text-green-400" : "text-gray-500"}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{dep.agent_name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">{dep.blueprint}</span>
                      <span className="text-xs text-gray-600">|</span>
                      <span className="text-xs text-gray-500">{dep.version}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {dep.compute_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dep.uptime}
                      </span>
                    </div>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-full border ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>

                  <div className="flex items-center gap-1">
                    {dep.status === "RUNNING" ? (
                      <button className="p-1.5 rounded hover:bg-surface-3 text-gray-500 hover:text-red-400 transition-colors" title="Stop">
                        <Square className="w-4 h-4" />
                      </button>
                    ) : (
                      <button className="p-1.5 rounded hover:bg-surface-3 text-gray-500 hover:text-green-400 transition-colors" title="Start">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-1.5 rounded hover:bg-surface-3 text-gray-500 hover:text-brand-400 transition-colors" title="Redeploy">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
