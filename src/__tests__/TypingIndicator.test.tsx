import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '@/components/TypingIndicator';

describe('TypingIndicator', () => {
  it('renders nothing when typingUsers is empty', () => {
    const { container } = render(<TypingIndicator typingUsers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows single user typing text', () => {
    render(<TypingIndicator typingUsers={[{ userId: '1', name: 'Alice' }]} />);
    expect(screen.getByText('Alice is typing')).toBeInTheDocument();
  });

  it('shows two users typing text', () => {
    render(
      <TypingIndicator
        typingUsers={[
          { userId: '1', name: 'Alice' },
          { userId: '2', name: 'Bob' },
        ]}
      />
    );
    expect(screen.getByText('Alice and Bob are typing')).toBeInTheDocument();
  });

  it('shows count for 3+ users', () => {
    render(
      <TypingIndicator
        typingUsers={[
          { userId: '1', name: 'Alice' },
          { userId: '2', name: 'Bob' },
          { userId: '3', name: 'Charlie' },
        ]}
      />
    );
    expect(screen.getByText('3 people are typing')).toBeInTheDocument();
  });

  it('renders animated dots', () => {
    render(<TypingIndicator typingUsers={[{ userId: '1', name: 'Alice' }]} />);
    const dotsContainer = screen.getByLabelText('typing animation');
    expect(dotsContainer.children).toHaveLength(3);
  });
});
