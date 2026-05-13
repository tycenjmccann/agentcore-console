"use client";

import { Bot, Hammer, Rocket, Activity, Bug, MessageSquare, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Active Agents", value: "6", icon: Bot, color: "text-brand-400" },
  { label: "Tasks Today", value: "12", icon: Hammer, color: "text-green-400" },
  { label: "Success Rate", value: "94%", icon: Activity, color: "text-emerald-400" },
  { label: "PRs Created", value: "8", icon: Rocket, color: "text-purple-400" },
];

const recentTasks = [
  { id: "t-001", description: "Add user preferences API", repo: "tinder/backend-api", status: "COMPLETED" as const, time: "12m ago" },
  { id: "t-002", description: "Fix auth token refresh logic", repo: "tinder/ios-app", status: "RUNNING" as const, time: "3m ago" },
  { id: "t-003", description: "Implement rate limiting middleware", repo: "tinder/gateway", status: "HYDRATING" as const, time: "1m ago" },
  { id: "t-004", description: "Add analytics event tracking", repo: "tinder/android-app", status: "SUBMITTED" as const, time: "just now" },
];

const quickActions = [
  { label: "Submit New Task", href: "/build", icon: Hammer, description: "Start a new coding task" },
  { label: "View Agents", href: "/agents", icon: Bot, description: "Manage your agents" },
  { label: "Chat with Agent", href: "/invoke", icon: MessageSquare, description: "Interactive session" },
  { label: "View Traces", href: "/debug", icon: Bug, description: "Debug executions" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "bg-green-400/10 text-green-400 border-green-400/30",
    RUNNING: "bg-blue-400/10 text-blue-400 border-blue-400/30",
    HYDRATING: "bg-cyan-400/10 text-cyan-400 border-cyan-400/30",
    FINALIZING: "bg-purple-400/10 text-purple-400 border-purple-400/30",
    SUBMITTED: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
    FAILED: "bg-red-400/10 text-red-400 border-red-400/30",
    CANCELLED: "bg-gray-400/10 text-gray-400 border-gray-400/30",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles.CANCELLED}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color} opacity-50`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Tasks */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Recent Tasks</h3>
            <Link href="/monitor" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-surface-4 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{task.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{task.repo}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <StatusBadge status={task.status} />
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-3 transition-colors group"
              >
                <action.icon className="w-4 h-4 text-gray-500 group-hover:text-brand-400" />
                <div>
                  <p className="text-sm text-gray-300 group-hover:text-white">{action.label}</p>
                  <p className="text-xs text-gray-600">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
