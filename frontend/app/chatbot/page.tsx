'use client';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";

interface Message {
  text: string;
  type: 'user' | 'assistant';
  timestamp: string;
}

export default function AISidebar() {
  const [messages, setMessages] = useState<Message[]>([
    { text: 'Hello! How can I assist you today? 😊', type: 'assistant', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const newUserMessage: Message = {
      text: inputMessage.trim(),
      type: 'user',
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await fetch(`http://localhost:5000/chatbot?query=${encodeURIComponent(inputMessage.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const newBotMessage: Message = {
        text: data.response.response || "I'm sorry, I couldn't process that.",
        type: 'assistant',
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, newBotMessage]);
    } catch (error) {
      console.error('Error fetching chatbot response:', error);
      setMessages((prev) => [
        ...prev,
        { text: "Sorry, I couldn't fetch a response. Please try again later.", type: 'assistant', timestamp: new Date().toLocaleTimeString() },
      ]);
    } finally{
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full bg-[#141414] h-screen flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#1A1A1A]">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[#00E676] rounded-full flex items-center justify-center">
            🤖
          </div>
          <div className="ml-3">
            <h2 className="text-white font-medium">AI Assistant</h2>
            <p className="text-gray-400 text-sm">Online</p>
          </div>
        </div>
      </div>

      <div ref={scrollAreaRef} className="flex-1 p-4 overflow-y-auto text-white">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-lg inline-block ${
                message.type === 'user' 
                  ? 'bg-[#00E676] text-black' 
                  : 'bg-[#1A1A1A] text-white'
              }`}>
                <p className="whitespace-pre-wrap break-words max-w-[400px] w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                </p>
                <p className="text-xs opacity-50 mt-1 text-right">{message.timestamp}</p>
              </div>
            </div>
          ))}
          {isTyping && <div className="text-sm text-gray-400 ml-2">Assistant is typing...</div>}
        </div>
      </div>

      <div className="p-4 border-t border-[#2A2A2A] w-full">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="w-full bg-[#1A1A1A] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#00E676]"
          />
          <button 
            onClick={handleSendMessage}
            className="bg-[#00E676] text-black px-4 py-2 rounded-lg hover:bg-[#00ff84] transition-colors"
            disabled={!inputMessage.trim() || isTyping}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
