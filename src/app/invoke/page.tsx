"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Bot, User, Info } from "lucide-react";
import { streamAgentInvocation, listAgentCoreAgents, AgentInfo } from "@/lib/agentcore-stream";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  agent_name?: string;
}

export default function InvokePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-gray-500 text-sm">Loading...</span></div>}>
      <InvokeContent />
    </Suspense>
  );
}

function InvokeContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available agents and pre-select from query param
  useEffect(() => {
    listAgentCoreAgents().then((data) => {
      const agentParam = searchParams.get("agent");
      // If a specific agent was passed (e.g. from Build page deploy), add it if not in list
      if (agentParam && !data.find((a) => a.id === agentParam)) {
        data = [...data, { id: agentParam, name: agentParam, status: "ACTIVE" }];
      }
      setAgents(data);
      setSelectedAgent(agentParam || (data.length > 0 ? data[0].id : ""));
    });
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !selectedAgent) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const agentMsgId = (Date.now() + 1).toString();
    const agentName = agents.find((a) => a.id === selectedAgent)?.name || "Agent";

    setMessages((prev) => [
      ...prev,
      { id: agentMsgId, role: "agent", content: "", timestamp: new Date().toISOString(), agent_name: agentName },
    ]);

    try {
      await streamAgentInvocation({
        agentId: selectedAgent,
        prompt: input,
        sessionId,
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId ? { ...msg, content: msg.content + chunk } : msg
            )
          );
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? { ...msg, content: `Error: ${err.message}` }
                : msg
            )
          );
          setIsStreaming(false);
        },
      });
    } catch {
      setIsStreaming(false);
    }
  }, [input, isStreaming, selectedAgent, agents, sessionId]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Info Banner */}
      <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg p-3 mb-4 flex items-center gap-2">
        <Info className="w-4 h-4 text-brand-400 flex-shrink-0" />
        <p className="text-xs text-brand-300">
          Interactive chat is in preview. Messages stream in real-time from AgentCore. Use <a href="/build" className="underline">Build</a> to create new agents.
        </p>
      </div>

      {/* Agent Selector */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-gray-500">Agent:</label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="bg-surface-2 border border-surface-4 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-500/50"
          data-testid="invoke-agent-selector"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        {isStreaming && (
          <span className="text-xs text-brand-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
            Streaming...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">Select an agent and send a message to start.</p>
            <p className="text-xs text-gray-600 mt-1">Responses stream in real-time from AgentCore.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "agent" && (
              <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-brand-400" />
              </div>
            )}
            <div
              className={`max-w-[70%] ${
                msg.role === "user"
                  ? "bg-brand-600/20 border border-brand-600/30 rounded-2xl rounded-tr-sm"
                  : "bg-surface-2 border border-surface-4 rounded-2xl rounded-tl-sm"
              } px-4 py-3`}
            >
              {msg.role === "agent" && msg.agent_name && (
                <p className="text-xs text-brand-400 mb-1 font-medium">{msg.agent_name}</p>
              )}
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "agent" && msg.content === "" && isStreaming && (
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 bg-surface-3 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-surface-4 pt-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message the agent..."
            className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
            data-testid="invoke-chat-input"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="btn-primary p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="invoke-send-btn"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
