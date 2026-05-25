'use client';

interface TypingUser {
  userId: string;
  name: string;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  let text: string;
  if (typingUsers.length === 1) {
    text = `${typingUsers[0].name} is typing`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0].name} and ${typingUsers[1].name} are typing`;
  } else {
    text = `${typingUsers.length} people are typing`;
  }

  return (
    <div className="overflow-hidden transition-all duration-200 ease-in-out opacity-100 max-h-10">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-surface-4 rounded-lg w-fit">
        <span className="text-gray-400 text-xs">{text}</span>
        <span className="flex items-center gap-0.5" aria-label="typing animation">
          <span
            className="w-1 h-1 bg-brand-400/60 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1 h-1 bg-brand-400/60 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1 h-1 bg-brand-400/60 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </span>
      </div>
    </div>
  );
}
