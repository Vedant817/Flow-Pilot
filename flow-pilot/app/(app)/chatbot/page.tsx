'use client';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";
import { Send, Bot, Loader2, Mic, MicOff, Volume2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface Message {
  id: string;
  text: string;
  type: 'user' | 'assistant';
  timestamp: string;
  createdAt: number;
}

const ChatMessage = memo(({ message, onSpeakMessage }: { message: Message, onSpeakMessage: (text: string) => void }) => (
  <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div className={`p-3 rounded-lg inline-block ${message.type === 'user'
      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
      : 'bg-slate-700 text-white'
      }`}>
      <div className="whitespace-pre-wrap break-words max-w-[400px] w-full prose prose-invert prose-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
      </div>
      <div className="flex justify-between items-center mt-1">
        <p className="text-xs opacity-50">{message.timestamp}</p>
        {message.type === 'assistant' && (
          <button
            onClick={() => onSpeakMessage(message.text)}
            className="text-xs opacity-50 hover:opacity-100"
            aria-label="Speak message"
          >
            <Volume2 size={14} />
          </button>
        )}
      </div>
    </div>
  </div>
));
ChatMessage.displayName = 'ChatMessage';

const TypingIndicator = memo(() => (
  <div className="flex items-center text-sm text-gray-400 ml-2">
    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    Assistant is typing...
  </div>
));
TypingIndicator.displayName = 'TypingIndicator';

export default function AISidebar() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const getDefaultWelcomeMessage = useCallback((): Message[] => {
    return [{
      id: 'welcome-msg',
      text: 'Hello! How can I assist you today? 😊 You can type or use the microphone to speak to me.',
      type: 'assistant',
      timestamp: new Date().toLocaleTimeString(),
      createdAt: Date.now()
    }];
  }, []);

  // This effect runs once on the client to load data from localStorage
  useEffect(() => {
    setIsClient(true);

    const savedConversationId = localStorage.getItem('conversationId');
    if (savedConversationId) {
      setConversationId(savedConversationId);
    }

    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages) as Message[];
        const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
        const recentMessages = parsedMessages.filter(msg => msg.createdAt && msg.createdAt > twelveHoursAgo);
        setMessages(recentMessages.length > 0 ? recentMessages : getDefaultWelcomeMessage());
      } catch (e) {
        console.error('Error parsing saved messages:', e);
        setMessages(getDefaultWelcomeMessage());
      }
    } else {
      setMessages(getDefaultWelcomeMessage());
    }
  }, [getDefaultWelcomeMessage]);

  // This effect saves messages to localStorage whenever they change
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages, isClient]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      });
    }
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
      if (synth) {
        synth.cancel();
      }
    };
  }, [abortController, synth]);

  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);

  const speakMessage = useCallback((text: string) => {
    if (synth) {
      synth.cancel();
      const cleanText = text.replace(/\*\*|__|\*|_|`|#|>|\[.*\]\(.*\)/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1;
      utterance.pitch = 1;
      synth.speak(utterance);
    }
  }, [synth]);

  const handleSendMessage = useCallback(async (message = inputMessage) => {
    if (!message.trim() || isTyping) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = Date.now();
    const newUserMessage: Message = {
      id: messageId,
      text: message.trim(),
      type: 'user',
      timestamp: new Date(currentTime).toLocaleTimeString(),
      createdAt: currentTime
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputMessage('');
    resetTranscript();
    setIsTyping(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: message.trim(), conversationId })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now();
      const newBotMessage: Message = {
        id: `response-${messageId}`,
        text: data.response || "I'm sorry, I couldn't process that.",
        type: 'assistant',
        timestamp: new Date(responseTime).toLocaleTimeString(),
        createdAt: responseTime
      };

      setMessages((prev) => [...prev, newBotMessage]);
      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem('conversationId', data.conversationId);
      }

      speakMessage(newBotMessage.text);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Error fetching chatbot response:', error);
        const errorTime = Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${messageId}`,
            text: "Sorry, I couldn't fetch a response. Please try again later.",
            type: 'assistant',
            timestamp: new Date(errorTime).toLocaleTimeString(),
            createdAt: errorTime
          },
        ]);
      }
    } finally {
      setIsTyping(false);
      setAbortController(null);

      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [inputMessage, isTyping, conversationId, resetTranscript, speakMessage]);

  const toggleListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
      if (transcript) {
        setTimeout(() => {
          handleSendMessage(transcript);
        }, 500);
      }
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });
      setIsListening(true);
      toast.info('Listening... Speak now', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "dark",
      });
    }
  }, [listening, transcript, handleSendMessage, resetTranscript]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleConfirmClear = useCallback(() => {
    setIsConfirmOpen(false);
    setMessages(getDefaultWelcomeMessage());
    setConversationId(null);
    localStorage.removeItem('conversationId');
    localStorage.removeItem('chatMessages');

    toast.success('Chat history cleared successfully!', {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: "dark",
    });
  }, [getDefaultWelcomeMessage]);

  const clearChat = useCallback(() => {
    setIsConfirmOpen(true);
  }, []);

  if (!isClient) {
    return null; // Or a loading spinner
  }

  return (
    <div className="w-full bg-slate-900 h-screen flex flex-col">
      <ToastContainer />
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmClear}
        title="Clear Chat History"
        message="Are you sure you want to clear all chat history? This action cannot be undone."
      />
      <div className="flex items-center justify-between p-4 bg-slate-800">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div className="ml-3">
            <h2 className="text-white font-medium">AI Assistant</h2>
            <p className="text-slate-400 text-sm">
              {isTyping ? 'Typing...' : listening ? 'Listening...' : 'Online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearChat}
            className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        className="flex-1 p-4 overflow-y-auto text-white scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-slate-800"
      >
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onSpeakMessage={speakMessage} />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      <div className="p-4 border-t border-slate-700 w-full">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={listening ? "Listening..." : "Type your message..."}
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            disabled={isTyping || listening}
          />
          {browserSupportsSpeechRecognition && (
            <button
              onClick={toggleListening}
              className={`p-2 rounded-lg transition-colors flex items-center justify-center ${listening
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-slate-800 text-blue-400 hover:bg-slate-700'
                }`}
              aria-label={listening ? "Stop listening" : "Start listening"}
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => handleSendMessage()}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={(!inputMessage.trim() && !transcript) || isTyping || isListening}
            aria-label="Send message"
          >
            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}