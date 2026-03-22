import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `You are a helpful customer support assistant for PIS UAE, an online marketplace that sells a wide variety of products including clothing, makeup, combo deals, toys, kitchen items, furniture, smartwatches, smart home devices, phones, laptops, computer parts (motherboards, storage, displays, batteries, memory, keyboards), and more.

Your role is to:
- Help customers with product inquiries, order questions, and general support
- Provide information about shipping (free shipping on orders over $50), returns, and refund policies
- Guide customers on how to browse products, use filters, and make purchases
- Be friendly, professional, and concise in your responses
- If you don't know something specific about an order, suggest the customer check their order history or contact support

Key store policies:
- Free shipping on orders over $50
- 30-day return policy for unused items in original packaging
- Refunds processed within 5-7 business days
- All products are quality tested and verified
- Customers can track orders from their profile page
- Payment is processed securely via Stripe

Keep responses brief and helpful. Use a warm, professional tone.`;

const QUICK_REPLIES = [
  { label: '📦 Track my order', message: 'How can I track my order?' },
  { label: '🔄 Return policy', message: 'What is your return policy?' },
  { label: '🚚 Shipping info', message: 'What are your shipping options and costs?' },
  { label: '💳 Payment methods', message: 'What payment methods do you accept?' },
  { label: '🛒 How to order', message: 'How do I place an order?' },
];

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Build conversation history for context
    const conversationHistory = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: text.trim() },
    ];

    try {
      let fullContent = '';

      await client.ai.gentxt({
        messages: conversationHistory,
        model: 'deepseek-v3.2',
        stream: true,
        onChunk: (chunk: any) => {
          if (chunk?.content) {
            fullContent += chunk.content;
            setStreamingContent(fullContent);
          }
        },
        onComplete: () => {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fullContent || "I'm sorry, I couldn't process your request. Please try again.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent('');
          setIsLoading(false);
        },
        onError: () => {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "I'm experiencing some technical difficulties. Please try again in a moment, or contact our support team directly.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setStreamingContent('');
          setIsLoading(false);
        },
        timeout: 60000,
      });
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, something went wrong. Please try again or contact our support team.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent('');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (message: string) => {
    sendMessage(message);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 active:scale-95"
          aria-label="Open chat support"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">PIS UAE Support</h3>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-blue-100">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
            {/* Welcome Message */}
            {messages.length === 0 && !isLoading && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                    <Bot className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                    <p className="text-sm text-slate-200">
                      👋 Hi there! Welcome to PIS UAE support. How can I help you today?
                    </p>
                  </div>
                </div>

                {/* Quick Replies */}
                <div className="pl-11 flex flex-wrap gap-2">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr.label}
                      onClick={() => handleQuickReply(qr.message)}
                      className="text-xs px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message History */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === 'user' ? 'bg-emerald-500/20' : 'bg-blue-500/20'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Bot className="h-4 w-4 text-blue-400" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-md'
                      : 'bg-slate-800 text-slate-200 rounded-tl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Streaming Response */}
            {isLoading && streamingContent && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && !streamingContent && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                    <span className="text-sm text-slate-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="shrink-0 border-t border-slate-700/50 px-4 py-3 bg-slate-900">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-slate-600 text-center mt-2">
              Powered by AI • Responses may not always be accurate
            </p>
          </div>
        </div>
      )}
    </>
  );
}