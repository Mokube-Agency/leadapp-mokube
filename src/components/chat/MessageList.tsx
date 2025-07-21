import { useRef, useCallback } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Message } from '@/types/database';
import { Bot, User, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);

interface MessageListProps {
  messages: Message[];
  onLoadMore: () => void;
  hasMore: boolean;
}

export default function MessageList({ messages, onLoadMore, hasMore }: MessageListProps) {
  const topRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore]);

  const getMessageIcon = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'human':
        return <UserCheck className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getMessageBubbleClass = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return "bg-primary text-primary-foreground ml-auto";
      case 'agent':
        return "bg-muted";
      case 'human':
        return "bg-green-500 text-white ml-auto";
      default:
        return "bg-muted";
    }
  };

  return (
    <div
      ref={topRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
    >
      {hasMore && (
        <div className="text-center py-2 text-sm text-muted-foreground">
          Scroll omhoog voor meer berichten...
        </div>
      )}
      
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-2",
            (message.role === 'user' || message.role === 'human') ? "justify-end" : "justify-start"
          )}
        >
          {(message.role === 'agent' || message.role === 'system') && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {getMessageIcon(message.role)}
            </div>
          )}
          
          <div className={cn(
            "max-w-[70%] rounded-lg p-3",
            getMessageBubbleClass(message.role)
          )}>
            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            <div className={cn(
              "mt-1 text-[10px] opacity-60",
              message.role === 'user' || message.role === 'human' 
                ? "text-right" 
                : "text-left"
            )}>
              {dayjs(message.created_at).fromNow()}
            </div>
          </div>

          {(message.role === 'user' || message.role === 'human') && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {getMessageIcon(message.role)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}