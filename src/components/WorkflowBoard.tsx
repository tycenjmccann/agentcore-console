/**
 * WorkflowBoard Component
 * 
 * Main workflow board displaying tickets in a kanban-style layout.
 * Shows workflow name, model configuration, and ticket status columns.
 */

import React from 'react';
import { WorkflowState, WorkflowTicket, WorkflowStatus } from '@/types/workflow';
import ModelDisplay from './ModelDisplay';
import { Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface WorkflowBoardProps {
  workflow: WorkflowState;
  onTicketClick?: (ticket: WorkflowTicket) => void;
}

const STATUS_COLUMNS: { status: WorkflowStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Pending', icon: <Clock className="w-4 h-4" /> },
  { status: 'in_progress', label: 'In Progress', icon: <AlertCircle className="w-4 h-4" /> },
  { status: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> },
  { status: 'failed', label: 'Failed', icon: <AlertCircle className="w-4 h-4" /> },
  { status: 'blocked', label: 'Blocked', icon: <AlertCircle className="w-4 h-4" /> },
];

/**
 * WorkflowBoard Component
 */
export function WorkflowBoard({ workflow, onTicketClick }: WorkflowBoardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTicketsByStatus = (status: WorkflowStatus) => {
    return workflow.tickets.filter(ticket => ticket.status === status);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left side - Workflow name and date */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {workflow.workflowId}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(workflow.createdAt)}</span>
              {workflow.completedAt && (
                <>
                  <span>•</span>
                  <span>Completed {formatDate(workflow.completedAt)}</span>
                </>
              )}
            </div>
          </div>

          {/* Right side - Model display */}
          <div className="flex items-center gap-4">
            <ModelDisplay 
              modelConfig={workflow.modelConfig}
              className="flex-shrink-0"
            />
            <div className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              workflow.status === 'completed' 
                ? 'bg-green-100 text-green-800'
                : workflow.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : workflow.status === 'in_progress'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {workflow.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-w-max">
          {STATUS_COLUMNS.map(column => {
            const tickets = getTicketsByStatus(column.status);
            return (
              <div key={column.status} className="flex flex-col w-80 bg-white rounded-lg border border-gray-200">
                {/* Column Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                  {column.icon}
                  <h3 className="font-semibold text-gray-900">{column.label}</h3>
                  <span className="ml-auto text-sm text-gray-500">({tickets.length})</span>
                </div>

                {/* Tickets */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {tickets.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No tickets</p>
                  ) : (
                    tickets.map(ticket => (
                      <button
                        key={ticket.id}
                        onClick={() => onTicketClick?.(ticket)}
                        className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all bg-white"
                      >
                        <h4 className="font-medium text-gray-900 mb-2">{ticket.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {ticket.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="font-medium">{ticket.assignee}</span>
                          {ticket.blockedBy && ticket.blockedBy.length > 0 && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              Blocked by {ticket.blockedBy.length}
                            </span>
                          )}
                        </div>
                        {ticket.artifacts && ticket.artifacts.length > 0 && (
                          <div className="mt-2 flex gap-1">
                            {ticket.artifacts.map((artifact, idx) => (
                              <span key={idx} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                                Artifact {idx + 1}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WorkflowBoard;
