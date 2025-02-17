"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Hello! I'm your order management assistant. How can I help you today?",
    timestamp: new Date().toLocaleTimeString(),
  },
  {
    role: "user",
    content: "What was the most sold product in the last 6 months?",
    timestamp: new Date().toLocaleTimeString(),
  },
  {
    role: "assistant",
    content:
      "Based on our sales data for the last 6 months, the most sold product is the 'Premium Laptop'. Here's a quick summary:\n\n" +
      "- Product: Premium Laptop\n" +
      "- Total Units Sold: 1,250\n" +
      "- Revenue Generated: $1,624,875\n" +
      "- Peak Month: March 2024 with 275 units sold\n\n" +
      "This product has consistently outperformed others in our electronics category. Is there any specific information about this product or its sales trend you'd like to know?",
    timestamp: new Date().toLocaleTimeString(),
  },
];

export function ChatbotView() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newUserMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const newAssistantMessage: Message = {
        role: "assistant",
        content:
          "I'm analyzing your request. Here's what I found in our order management system...",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col bg-background border rounded-lg shadow-lg min-h-full w-full pb-6">
      <div className="p-4 border-b bg-muted/50">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Order Management Assistant
        </h2>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map((message, i) => (
          <Card
            key={i}
            className={`
                            max-w-[80%] p-4 transition-all duration-200 ease-in-out 
                            ${
                              message.role === "assistant"
                                ? "ml-0 bg-muted hover:bg-muted/80 m-4"
                                : "ml-auto bg-primary text-primary-foreground hover:bg-primary/90"
                            }
                        `}
          >
            <div className="flex items-start gap-2">
              {message.role === "assistant" ? (
                <Bot className="h-5 w-5 mt-1" />
              ) : (
                <User className="h-5 w-5 mt-1" />
              )}
              <div className="space-y-1">
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-50">{message.timestamp}</div>
              </div>
            </div>
          </Card>
        ))}
        {isTyping && (
          <div className="text-sm text-muted-foreground ml-2">
            Assistant is typing...
          </div>
        )}
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 border-t bg-background fixed bottom-0 left-0 right-0 w-full flex justify-center"
      >
        <div className="flex gap-2 w-full max-w-4xl">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button
            type="submit"
            className="px-4"
            disabled={!input.trim() || isTyping}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
