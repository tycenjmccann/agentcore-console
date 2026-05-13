"use client";

import { Activity, Clock, AlertTriangle, CheckCircle, ArrowUpRight, RefreshCw } from "lucide-react";

// In production, this comes from ABCA GET /v1/tasks
const recentInvocations = [
  { id: "t-010", agent: "Backend Agent", task: "Add user preferences API", status: "COMPLETED" as const, duration: "4m 32s", time: "2 min ago", repo: "tinder/backend-api" },
  { id: "t-009", agent: "iOS Agent", task: "Fix auth token refresh logic", status: "RUNNING" as const, duration: "2m 15s", time: "5 min ago", repo: "tinder/ios-app" },
  { id: "t-008", agent: "Security Agent", task: "Audit payment endpoint", status: "COMPLETED" as const, duration: "1m 48s", time: "12 min ago", repo: "tinder/gateway" },
  { id: "t-007", agent: "Backend Agent", task: "Implement rate limiting", status: "COMPLETED" as const, duration: "6m 02s", time: "18 min ago", repo: "tinder/gateway" },
  { id: "t-006", agent: "Android Agent", task: "Add analytics tracking", status: "FAILED" as const, duration: "3m 11s", time: "25 min ago", repo: "tinder/android-app" },
  { id: "t-005", agent: "Backend Agent", task: "Database migration v42", status: "COMPLETED" as const, duration: "2m 55s", time: "32 min ago", repo: "tinder/backend-api" },
  { id: "t-004", agent: "iOS Agent", task: "Update SwiftUI navigation", status: "COMPLETED" as const, duration: "5m 18s", time: "45 min ago", repo: "tinder/ios-app" },
  { id: "t-003", agent: "Backend Agent", task: "Add caching layer", status: "COMPLETED" as const, duration: "7m 44s", time: "1h ago", repo: "tinder/backend-api" },
];

const metrics = [
  { label: "Invocations (24h)", value: "48", change: "+12%", icon: Activity, color: "text-brand-400" },
  { label: "Avg Duration", value: "4m 12s", change: "-8%", icon: Clock, color: "text-green-400" },
  { label: "Error Rate", value: "4.2%", change: "+1.1%", icon: AlertTriangle, color: "text-yellow-400" },
  { label: "Success Rate", value: "95.8%", change: "+2.3%", icon: CheckCircle, color: "text-emerald-400" },
];

// Simulated chart data (in production from ABCA task aggregation)
const hourlyData = [
  { hour: "00", invocations: 2, errors: 0 },
  { hour: "02", invocations: 1, errors: 0 },
  { hour: "04", invocations: 0, errors: 0 },
  { hour: "06", invocations: 3, errors: 0 },
  { hour: "08", invocations: 7, errors: 1 },
  { hour: "10", invocations: 9, errors: 0 },
  { hour: "12", invocations: 6, errors: 0 },
  { hour: "14", invocations: 8, errors: 1 },
  { hour: "16", invocations: 5, errors: 0 },
  { hour: "18", invocations: 4, errors: 0 },
  { hour: "20", invocations: 2, errors: 0 },
  { hour: "22", invocations: 1, errors: 0 },
];

const statusColors: Record<string, string> = {
  COMPLETED: "bg-green-400/10 text-green-400 border-green-400/30",
  RUNNING: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  FAILED: "bg-red-400/10 text-red-400 border-red-400/30",
  SUBMITTED: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
};

export default function MonitorPage() {
  const maxInvocations = Math.max(...hourlyData.map(d => d.invocations));

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="card">
            <div className="flex items-center justify-between">
              <metric.icon className={`w-5 h-5 ${metric.color} opacity-60`} />
              <span className={`text-xs ${metric.change.startsWith("+") && metric.label.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                {metric.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white mt-2">{metric.value}</p>
            <p className="text-xs text-gray-500 mt-1">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Chart */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Invocations (24h)</h3>
            <button className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
          {/* Simple bar chart */}
          <div className="flex items-end gap-1.5 h-32">
            {hourlyData.map((d) => (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center justify-end h-24">
                  {d.errors > 0 && (
                    <div
                      className="w-full bg-red-400/40 rounded-t"
                      style={{ height: `${(d.errors / maxInvocations) * 100}%`, minHeight: d.errors > 0 ? "4px" : "0" }}
                    />
                  )}
                  <div
                    className="w-full bg-brand-500/60 rounded-t"
                    style={{ height: `${(d.invocations / maxInvocations) * 100}%`, minHeight: d.invocations > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-[9px] text-gray-600">{d.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Agent Status</h3>
          <div className="space-y-3">
            {[
              { name: "Backend Agent", status: "healthy", tasks: 5 },
              { name: "iOS Agent", status: "healthy", tasks: 3 },
              { name: "Android Agent", status: "warning", tasks: 1 },
              { name: "Security Agent", status: "healthy", tasks: 2 },
              { name: "Analytics Agent", status: "offline", tasks: 0 },
            ].map((agent) => (
              <div key={agent.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`status-dot ${
                    agent.status === "healthy" ? "bg-green-400" :
                    agent.status === "warning" ? "bg-yellow-400" : "bg-gray-500"
                  }`} />
                  <span className="text-sm text-gray-300">{agent.name}</span>
                </div>
                <span className="text-xs text-gray-500">{agent.tasks} active</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invocation Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Recent Invocations</h3>
          <span className="text-xs text-gray-600">Live feed from ABCA</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-surface-4">
                <th className="text-left py-2 font-medium">Agent</th>
                <th className="text-left py-2 font-medium">Task</th>
                <th className="text-left py-2 font-medium">Repository</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-left py-2 font-medium">Duration</th>
                <th className="text-left py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentInvocations.map((inv) => (
                <tr key={inv.id} className="border-b border-surface-4/50 hover:bg-surface-3/50">
                  <td className="py-2.5 text-gray-300">{inv.agent}</td>
                  <td className="py-2.5 text-gray-300">{inv.task}</td>
                  <td className="py-2.5 text-gray-500 text-xs">{inv.repo}</td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs">{inv.duration}</td>
                  <td className="py-2.5 text-gray-500 text-xs">{inv.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
