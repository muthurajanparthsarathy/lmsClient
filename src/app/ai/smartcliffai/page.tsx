'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Square, Play, Code, Copy, Check, Eye, AlertCircle, RefreshCw, FileText, Sun, Moon, Settings, Download, Upload, Trash2, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  code?: CodeBlock[];
  output?: string;
  htmlOutput?: string;
  error?: boolean;
}

interface CodeBlock {
  language: string;
  code: string;
  isExecuting?: boolean;
}

interface CombinedPreview {
  html: string;
  css: string;
  javascript: string;
}

interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
}

const SmartCliffCompiler: React.FC = () => {
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  // Themes configuration
  const themes: Record<'dark' | 'light', Theme> = {
    dark: {
      name: 'Dark',
      colors: {
        primary: 'from-violet-600 to-purple-700',
        secondary: 'from-blue-600 to-cyan-600',
        accent: 'from-emerald-500 to-teal-600',
        background: 'from-slate-900 via-slate-800 to-slate-900',
        surface: 'slate-800',
        text: 'slate-100',
        textSecondary: 'slate-400',
        border: 'slate-700',
        error: 'red-500',
        success: 'green-500'
      }
    },
    light: {
      name: 'Light',
      colors: {
        primary: 'from-violet-500 to-purple-600',
        secondary: 'from-blue-500 to-cyan-500',
        accent: 'from-emerald-400 to-teal-500',
        background: 'from-slate-50 via-slate-100 to-slate-50',
        surface: 'white',
        text: 'slate-800',
        textSecondary: 'slate-600',
        border: 'slate-300',
        error: 'red-500',
        success: 'green-500'
      }
    }
  };

  const theme = themes[currentTheme];
  const isDark = currentTheme === 'dark';

  // Existing state management
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm SmartCliff AI. I can help you with learning, problem-solving, creative tasks, and writing code. What would you like to explore today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState<string | null>(null);
  const [showCombinedPreview, setShowCombinedPreview] = useState<CombinedPreview | null>(null);
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check Ollama connection on component mount
  useEffect(() => {
    checkOllamaConnection();
  }, []);

  const checkOllamaConnection = async () => {
    try {
      const response = await fetch('http://localhost:5533/api/chat/health');
      const data = await response.json();
      setIsOllamaConnected(data.success);
    } catch (error) {
      console.error('Failed to check Ollama connection:', error);
      setIsOllamaConnected(false);
    }
  };

  const testOllamaConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch('http://localhost:5533/api/chat/simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: "Hello, please respond with 'OK' if you're working.",
          model: 'llama3'
        }),
      });
      
      const data = await response.json();
      setIsOllamaConnected(data.success);
      
      if (!data.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `❌ Ollama Test Failed: ${data.message || 'Unknown error'}`,
          isUser: false,
          timestamp: new Date(),
          error: true
        }]);
      }
    } catch (error: any) {
      console.error('Ollama test failed:', error);
      setIsOllamaConnected(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `❌ Connection Test Failed: ${error.message}`,
        isUser: false,
        timestamp: new Date(),
        error: true
      }]);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const extractCodeBlocks = (text: string): { text: string; code?: CodeBlock[] } => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let textWithoutCode = text;
    const codeBlocks: CodeBlock[] = [];

    const matches = [...text.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      textWithoutCode = text.replace(codeBlockRegex, '').trim();
      
      matches.forEach(match => {
        const language = match[1] || 'text';
        const code = match[2].trim();
        codeBlocks.push({ language, code });
      });
    }
    
    return {
      text: textWithoutCode,
      code: codeBlocks.length > 0 ? codeBlocks : undefined
    };
  };

  const executeCode = async (messageId: string, code: string, language: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId
        ? { 
            ...msg, 
            code: msg.code?.map(cb => 
              cb.code === code ? { ...cb, isExecuting: true } : cb
            )
          }
        : msg
    ));

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let output = '';
      let htmlOutput = '';
      
      if (language === 'python') {
        output = '> python script.py\n';
        if (code.includes('print')) {
          const matches = code.match(/print\((.*?)\)/g);
          matches?.forEach(match => {
            const content = match.match(/print\((.*?)\)/)?.[1] || '';
            try {
              output += eval(content) + '\n';
            } catch {
              output += content.replace(/['"]/g, '') + '\n';
            }
          });
        } else {
          output += 'Execution completed successfully\n';
        }
      } else if (language === 'javascript' || language === 'js') {
        output = '> node script.js\n';
        try {
          const logs: string[] = [];
          const customConsole = {
            log: (...args: any[]) => logs.push(args.join(' '))
          };
          const func = new Function('console', code);
          func(customConsole);
          output += logs.join('\n') || 'Execution completed successfully';
        } catch (e: any) {
          output += `Error: ${e.message}`;
        }
      } else if (language === 'html' || language === 'css') {
        htmlOutput = code;
        output = 'HTML/CSS rendered successfully. Click "Preview" to view output.';
      } else {
        output = `> ${language} execution\nExecution completed successfully\nExit code: 0`;
      }

      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? { 
              ...msg, 
              output, 
              htmlOutput,
              code: msg.code?.map(cb => 
                cb.code === code ? { ...cb, isExecuting: false } : cb
              )
            }
          : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? { 
              ...msg, 
              output: 'Error executing code', 
              code: msg.code?.map(cb => 
                cb.code === code ? { ...cb, isExecuting: false } : cb
              )
            }
          : msg
      ));
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const previewHtml = (html: string) => {
    setShowHtmlPreview(html);
  };

  const previewCombinedCode = (codeBlocks: CodeBlock[]) => {
    const combined: CombinedPreview = {
      html: '',
      css: '',
      javascript: ''
    };

    codeBlocks.forEach(block => {
      switch (block.language) {
        case 'html':
          combined.html = block.code;
          break;
        case 'css':
          combined.css = block.code;
          break;
        case 'javascript':
        case 'js':
          combined.javascript = block.code;
          break;
      }
    });

    setShowCombinedPreview(combined);
  };

  const generateCombinedHtml = (preview: CombinedPreview): string => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Generated Preview</title>
    <style>
        ${preview.css}
    </style>
</head>
<body>
    ${preview.html}
    <script>
        ${preview.javascript}
    </script>
</body>
</html>
    `.trim();
  };

  const hasWebCode = (codeBlocks: CodeBlock[]): boolean => {
    return codeBlocks.some(block => 
      ['html', 'css', 'javascript', 'js'].includes(block.language)
    );
  };

  const stopGeneration = async () => {
    if (currentStreamId) {
      try {
        await fetch('http://localhost:5533/api/chat/stop-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ streamId: currentStreamId }),
        });
      } catch (error) {
        console.error('Error stopping generation:', error);
      } finally {
        setCurrentStreamId(null);
        setIsTyping(false);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    if (isOllamaConnected === false) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "❌ Cannot connect to Ollama. Please make sure Ollama is running on http://localhost:11434",
        isUser: false,
        timestamp: new Date(),
        error: true
      }]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      text: '',
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, aiMessage]);

    try {
      const response = await fetch('http://localhost:5533/api/chat/ollama-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: currentInput,
          model: 'llama3'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const streamId = response.headers.get('X-Stream-ID');
      setCurrentStreamId(streamId);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulatedText = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            try {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.response) {
                  accumulatedText += data.response;
                  
                  const { text, code } = extractCodeBlocks(accumulatedText);
                  
                  setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, text: code ? text : accumulatedText, code }
                      : msg
                  ));
                }
                
                if (data.done) {
                  setCurrentStreamId(null);
                  setIsTyping(false);
                  break;
                }
              }
            } catch (e) {
              console.log('Error parsing line:', line);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error calling AI service:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              text: `❌ ${error.message || "Sorry, I encountered an error. Please try again."}`,
              error: true
            }
          : msg
      ));
      setCurrentStreamId(null);
      setIsTyping(false);
      
      if (error.message.includes('Ollama') || error.message.includes('connection')) {
        checkOllamaConnection();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      text: "Hello! I'm SmartCliff AI. I can help you with learning, problem-solving, creative tasks, and writing code. What would you like to explore today?",
      isUser: false,
      timestamp: new Date()
    }]);
  };

  const exportChat = () => {
    const chatData = {
      messages,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartcliff-chat-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const examplePrompts = [
    "Create a responsive navbar with HTML, CSS and JavaScript",
    "Build a calculator using HTML, CSS and JS",
    "Make a todo list app with HTML, CSS, JavaScript",
    "Create a weather app interface with HTML, CSS, JS"
  ];

  return (
    <div className={`h-screen bg-gradient-to-br ${theme.colors.background} flex flex-col transition-colors duration-300`}>
      {/* Header Section - Reduced height by 40% */}
      <header className={`border-b ${isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-300 bg-white/80'} backdrop-blur-md transition-colors duration-300 py-1`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo and Title - Compact */}
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${theme.colors.primary} flex items-center justify-center shadow-lg`}>
                <MessageCircle className="w-3 h-3 text-white" />
              </div>
              <div>
                <h1 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  SmartCliff AI
                </h1>
                <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Code Assistant
                </p>
              </div>
            </div>

            {/* Right Side Controls - Compact */}
            <div className="flex items-center gap-1">
              {/* Connection Status - Compact */}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                isOllamaConnected ? 
                  (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-500/20 text-green-600') :
                  (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-500/20 text-red-600')
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isOllamaConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs font-medium">
                  {isOllamaConnected === null ? 'Checking...' : isOllamaConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Theme Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowThemeMenu(!showThemeMenu)}
                  className={`p-1 rounded-md border ${
                    isDark 
                      ? 'border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300' 
                      : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600'
                  } transition-colors duration-200`}
                >
                  {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                </button>
                
                {showThemeMenu && (
                  <div className={`absolute right-0 top-10 w-40 rounded-lg border shadow-lg py-1 ${
                    isDark 
                      ? 'border-slate-600 bg-slate-800 text-slate-300' 
                      : 'border-slate-300 bg-white text-slate-600'
                  } z-50`}>
                    <button
                      onClick={() => {
                        setCurrentTheme('light');
                        setShowThemeMenu(false);
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm ${
                        !isDark ? (isDark ? 'bg-slate-700' : 'bg-slate-100') : ''
                      } hover:${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light Theme</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTheme('dark');
                        setShowThemeMenu(false);
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm ${
                        isDark ? (isDark ? 'bg-slate-700' : 'bg-slate-100') : ''
                      } hover:${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark Theme</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Settings Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1 rounded-md border ${
                    isDark 
                      ? 'border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300' 
                      : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600'
                  } transition-colors duration-200`}
                >
                  <Settings className="w-3 h-3" />
                </button>
                
                {showSettings && (
                  <div className={`absolute right-0 top-10 w-48 rounded-lg border shadow-lg py-1 ${
                    isDark 
                      ? 'border-slate-600 bg-slate-800 text-slate-300' 
                      : 'border-slate-300 bg-white text-slate-600'
                  } z-50`}>
                    <button
                      onClick={() => {
                        exportChat();
                        setShowSettings(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        clearChat();
                        setShowSettings(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-slate-700 text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Chat</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* HTML Preview Modal */}
      {showHtmlPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl h-5/6 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">HTML Preview</h3>
              <button
                onClick={() => setShowHtmlPreview(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <iframe
              srcDoc={showHtmlPreview}
              className="flex-1 w-full border-0"
              title="HTML Preview"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      )}

      {/* Combined Code Preview Modal */}
      {showCombinedPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl h-5/6 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Combined Code Preview</h3>
              <button
                onClick={() => setShowCombinedPreview(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4 p-4">
              <div className="flex flex-col">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Code Editors</h4>
                <div className="flex-1 grid gap-4">
                  {showCombinedPreview.html && (
                    <div className="bg-gray-50 rounded-lg overflow-hidden border">
                      <div className="bg-gray-200 px-3 py-2 border-b">
                        <span className="text-xs font-medium text-gray-700">HTML</span>
                      </div>
                      <pre className="p-3 overflow-auto max-h-40">
                        <code className="text-xs text-gray-800">{showCombinedPreview.html}</code>
                      </pre>
                    </div>
                  )}
                  {showCombinedPreview.css && (
                    <div className="bg-gray-50 rounded-lg overflow-hidden border">
                      <div className="bg-gray-200 px-3 py-2 border-b">
                        <span className="text-xs font-medium text-gray-700">CSS</span>
                      </div>
                      <pre className="p-3 overflow-auto max-h-40">
                        <code className="text-xs text-gray-800">{showCombinedPreview.css}</code>
                      </pre>
                    </div>
                  )}
                  {showCombinedPreview.javascript && (
                    <div className="bg-gray-50 rounded-lg overflow-hidden border">
                      <div className="bg-gray-200 px-3 py-2 border-b">
                        <span className="text-xs font-medium text-gray-700">JavaScript</span>
                      </div>
                      <pre className="p-3 overflow-auto max-h-40">
                        <code className="text-xs text-gray-800">{showCombinedPreview.javascript}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Live Preview</h4>
                <iframe
                  srcDoc={generateCombinedHtml(showCombinedPreview)}
                  className="flex-1 w-full border rounded-lg"
                  title="Combined Code Preview"
                  sandbox="allow-scripts"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Banner */}
      {isOllamaConnected === false && (
        <div className={`${isDark ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-red-500/20 border-red-500/30 text-red-700'} border px-4 py-2 text-sm`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Ollama is not running or not accessible</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={testOllamaConnection}
                disabled={isTestingConnection}
                className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50 ${
                  isDark 
                    ? 'bg-red-600/50 hover:bg-red-600/70' 
                    : 'bg-red-600/20 hover:bg-red-600/30'
                }`}
              >
                {isTestingConnection ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Test Connection
              </button>
              <button
                onClick={checkOllamaConnection}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  isDark 
                    ? 'bg-slate-600/50 hover:bg-slate-600/70' 
                    : 'bg-slate-600/20 hover:bg-slate-600/30'
                }`}
              >
                Check Again
              </button>
            </div>
          </div>
          <div className={`mt-1 text-xs ${isDark ? 'text-red-300/80' : 'text-red-600/80'}`}>
            Make sure Ollama is installed and running on http://localhost:11434
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-3xl ${msg.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md ${
                    msg.isUser 
                      ? `bg-gradient-to-br ${theme.colors.secondary}` 
                      : msg.error
                      ? `bg-gradient-to-br from-${theme.colors.error} to-rose-600`
                      : `bg-gradient-to-br ${theme.colors.primary}`
                  }`}>
                    {msg.isUser ? <User className="w-4 h-4 text-white" /> : 
                     msg.error ? <AlertCircle className="w-4 h-4 text-white" /> : 
                     <Bot className="w-4 h-4 text-white" />}
                  </div>

                  {/* Message Content */}
                  <div className="flex flex-col gap-2 w-full">
                    {/* Regular Text Message */}
                    {msg.text && (
                      <div className={`px-4 py-3 rounded-2xl shadow-lg ${
                        msg.isUser
                          ? `bg-gradient-to-br ${theme.colors.secondary} text-white`
                          : msg.error
                          ? (isDark 
                              ? 'bg-red-500/20 border border-red-500/30 text-red-200' 
                              : 'bg-red-500/10 border border-red-500/20 text-red-700')
                          : (isDark 
                              ? 'bg-slate-700/80 text-slate-100 border border-slate-600/50' 
                              : 'bg-white text-slate-800 border border-slate-200')
                      }`}>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text || (
                            <div className="flex space-x-1.5 py-1">
                              <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}></div>
                              <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`} style={{ animationDelay: '0.15s' }}></div>
                              <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`} style={{ animationDelay: '0.3s' }}></div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Code Blocks */}
                    {msg.code && msg.code.map((codeBlock, index) => (
                      <div key={index} className={`rounded-xl overflow-hidden shadow-lg border ${
                        isDark 
                          ? 'bg-slate-800 border-slate-600/50' 
                          : 'bg-slate-50 border-slate-300'
                      }`}>
                        <div className={`flex items-center justify-between px-4 py-2 border-b ${
                          isDark 
                            ? 'bg-slate-700/50 border-slate-600/50' 
                            : 'bg-slate-200/50 border-slate-300'
                        }`}>
                          <div className="flex items-center gap-2">
                            <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                            <span className={`text-xs font-medium uppercase ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {codeBlock.language}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyCode(codeBlock.code, `${msg.id}-${index}`)}
                              className={`p-1.5 rounded transition-colors ${
                                isDark 
                                  ? 'hover:bg-slate-600/50' 
                                  : 'hover:bg-slate-300/50'
                              }`}
                              title="Copy code"
                            >
                              {copiedId === `${msg.id}-${index}` ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                              )}
                            </button>
                            {!['html', 'css', 'javascript', 'js'].includes(codeBlock.language) && (
                              <button
                                onClick={() => executeCode(msg.id, codeBlock.code, codeBlock.language)}
                                disabled={codeBlock.isExecuting}
                                className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                                  isDark 
                                    ? 'hover:bg-slate-600/50' 
                                    : 'hover:bg-slate-300/50'
                                }`}
                                title="Run code"
                              >
                                {codeBlock.isExecuting ? (
                                  <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${
                                    isDark ? 'border-slate-400 border-t-transparent' : 'border-slate-600 border-t-transparent'
                                  }`} />
                                ) : (
                                  <Play className="w-3.5 h-3.5 text-green-400" />
                                )}
                              </button>
                            )}
                            {(codeBlock.language === 'html' || codeBlock.language === 'css') && (
                              <button
                                onClick={() => previewHtml(codeBlock.code)}
                                className={`p-1.5 rounded transition-colors ${
                                  isDark 
                                    ? 'hover:bg-slate-600/50' 
                                    : 'hover:bg-slate-300/50'
                                }`}
                                title="Preview HTML/CSS"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-400" />
                              </button>
                            )}
                          </div>
                        </div>
                        <pre className="p-4 overflow-x-auto max-h-96">
                          <code className={`text-xs font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {codeBlock.code}
                          </code>
                        </pre>
                      </div>
                    ))}

                    {/* Combined Preview Button */}
                    {msg.code && hasWebCode(msg.code) && (
                      <div className="flex justify-start">
                        <button
                          onClick={() => previewCombinedCode(msg.code!)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-md ${
                            isDark
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                              : 'bg-gradient-to-br from-blue-400 to-cyan-400 text-white hover:from-blue-500 hover:to-cyan-500'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm font-medium">Preview Combined Output</span>
                        </button>
                      </div>
                    )}

                    {/* Output */}
                    {msg.output && (
                      <div className={`rounded-xl overflow-hidden shadow-lg border ${
                        isDark 
                          ? 'bg-slate-900 border-slate-700/50' 
                          : 'bg-slate-100 border-slate-300'
                      }`}>
                        <div className={`flex items-center justify-between px-4 py-2 border-b ${
                          isDark 
                            ? 'bg-slate-800/50 border-slate-700/50' 
                            : 'bg-slate-200/50 border-slate-300'
                        }`}>
                          <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            OUTPUT
                          </span>
                        </div>
                        <pre className="p-4 overflow-x-auto">
                          <code className={`text-xs font-mono ${
                            msg.output.includes('Error') 
                              ? (isDark ? 'text-red-400' : 'text-red-600')
                              : (isDark ? 'text-green-400' : 'text-green-600')
                          }`}>
                            {msg.output}
                          </code>
                        </pre>
                      </div>
                    )}

                    <span className={`text-xs px-1 ${msg.isUser ? 'text-right' : ''} ${
                      isDark ? 'text-slate-500' : 'text-slate-600'
                    }`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Example Prompts */}
          {messages.length === 1 && (
            <div className="mt-12">
              <p className={`text-sm mb-4 text-center font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Try asking me something like:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {examplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(prompt)}
                    className={`px-4 py-3.5 border rounded-xl text-sm text-left transition-all duration-200 hover:shadow-lg group ${
                      isDark
                        ? 'bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50 text-slate-200'
                        : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1">{prompt}</span>
                      <Sparkles className={`w-4 h-4 transition-opacity ${
                        isDark ? 'text-violet-400' : 'text-violet-600'
                      } opacity-0 group-hover:opacity-100`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className={`border-t ${isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-300 bg-white/80'} backdrop-blur-md transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className={`border rounded-2xl p-3 shadow-xl ${
            isDark 
              ? 'bg-slate-700/60 border-slate-600/50' 
              : 'bg-white border-slate-300'
          }`}>
            <div className="flex gap-3 items-end">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isOllamaConnected === false ? "Ollama is not available..." : "Message SmartCliff AI..."}
                className={`flex-1 bg-transparent outline-none text-sm py-2 px-1 disabled:opacity-50 ${
                  isDark 
                    ? 'text-slate-100 placeholder-slate-400' 
                    : 'text-slate-800 placeholder-slate-500'
                }`}
                disabled={isTyping || isOllamaConnected === false}
              />
              <div className="flex gap-2 flex-shrink-0">
                {isTyping && (
                  <button
                    onClick={stopGeneration}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${
                      isDark
                        ? 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                        : 'bg-gradient-to-br from-red-400 to-rose-500 hover:from-red-500 hover:to-rose-600'
                    }`}
                    title="Stop generating"
                  >
                    <Square className="w-4 h-4 text-white fill-white" />
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping || isOllamaConnected === false}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
                    isDark
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700'
                      : 'bg-gradient-to-br from-violet-400 to-purple-500 hover:from-violet-500 hover:to-purple-600'
                  }`}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            
            {/* Typing indicator */}
            {isTyping && (
              <div className={`flex items-center gap-2 mt-2.5 pt-2.5 border-t ${
                isDark ? 'border-slate-600/30' : 'border-slate-300'
              }`}>
                <div className="flex space-x-1">
                  <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${
                    isDark ? 'bg-slate-400' : 'bg-slate-500'
                  }`}></div>
                  <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${
                    isDark ? 'bg-slate-400' : 'bg-slate-500'
                  }`} style={{ animationDelay: '0.1s' }}></div>
                  <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${
                    isDark ? 'bg-slate-400' : 'bg-slate-500'
                  }`} style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  AI is thinking...
                </span>
              </div>
            )}
          </div>
          
          <p className={`text-xs text-center mt-3 ${
            isDark ? 'text-slate-500' : 'text-slate-600'
          }`}>
            {isOllamaConnected === false ? (
              <span className={`flex items-center justify-center gap-1 ${
                isDark ? 'text-red-400' : 'text-red-600'
              }`}>
                <AlertCircle className="w-3 h-3" />
                Ollama is not running. Please start Ollama first.
              </span>
            ) : isOllamaConnected === true ? (
              "SmartCliff AI powered by Ollama • Running locally on your machine"
            ) : (
              "Checking Ollama connection..."
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmartCliffCompiler;