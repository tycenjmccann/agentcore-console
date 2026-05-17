import React from 'react';
import { WorkflowState, TicketNode } from '@/lib/types';
import { ModelDisplay } from './ModelDisplay';
import { CheckCircle, Circle, Loader2, XCircle, AlertCircle } from 'lucide-react';

interface WorkflowBoardProps {
  workflow: WorkflowState;
  onTicketClick?: (ticket: TicketNode) => void;
}

/**
 * WorkflowBoard Component
 * 
 * Displays the workflow execution board with tickets, dependencies, and status.
 * Now includes model configuration display in the header.
 */
export const WorkflowBoard: React.FC<WorkflowBoardProps> = ({ workflow, onTicketClick }) => {
  // Status icon mapping
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-slate-400" />;
    }
  };

  // Status color mapping
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
      case 'failed':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      case 'blocked':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      default:
        return 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        {/* Left: Workflow name and description */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 truncate">
            {workflow.name || 'Untitled Workflow'}
          </h2>
          {workflow.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
              {workflow.description}
            </p>
          )}
        </div>

        {/* Right: Model display */}
        <div className="flex-shrink-0">
          <ModelDisplay modelConfig={workflow.modelConfig} />
        </div>
      </div>

      {/* Workflow content area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* Tickets grid */}
        {workflow.tickets && workflow.tickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflow.tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onTicketClick?.(ticket)}
                className={`
                  text-left p-4 rounded-lg border transition-all
                  hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${getStatusColor(ticket.status)}
                `}
              >
                {/* Ticket header */}
                <div className="flex items-start gap-3 mb-2">
                  {getStatusIcon(ticket.status)}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                      {ticket.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {ticket.id}
                    </p>
                  </div>
                </div>

                {/* Ticket description */}
                {ticket.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 mb-3">
                    {ticket.description}
                  </p>
                )}

                {/* Ticket metadata */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {ticket.assignee && (
                    <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                      {ticket.assignee}
                    </span>
                  )}
                  {ticket.blockedBy && ticket.blockedBy.length > 0 && (
                    <span className="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                      Blocked by {ticket.blockedBy.length}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
            <p>No tickets in this workflow</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span>
            <strong>Status:</strong> {workflow.status || 'pending'}
          </span>
          {workflow.tickets && (
            <span>
              <strong>Tickets:</strong> {workflow.tickets.length}
            </span>
          )}
          {workflow.createdAt && (
            <span>
              <strong>Created:</strong> {new Date(workflow.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
