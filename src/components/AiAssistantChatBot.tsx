import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  X, 
  FileText, 
  FlaskConical, 
  Activity, 
  Search, 
  FileSpreadsheet, 
  Trash2, 
  Loader2, 
  ChevronDown, 
  Copy, 
  Check,
  RotateCcw,
  Brain,
  MessageSquare
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  feature?: string;
  timestamp: Date;
}

const TEMPLATES = {
  generate_clinical_notes: {
    label: "Generate Clinical Notes (SOAP)",
    icon: FileText,
    color: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40",
    placeholder: "Provide brief patient details and presenting symptoms...",
    defaultText: "Patient: John Doe, 45-year-old Male\nSymptoms: Persistent productive cough for 3 weeks, low-grade evening fever, night sweats, 4kg unexplained weight loss.\nObservations: Reduced breath sounds in chest auscultation, mild tachypnea."
  },
  suggest_lab_tests: {
    label: "Suggest Lab Tests",
    icon: FlaskConical,
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
    placeholder: "Provide patient signs, patient history, or clinical suspicions...",
    defaultText: "Patient presents with recurrent fatigue, polydipsia (excessive thirst), and polyuria (frequent urination) for the past 2 months. Family history of Type 2 Diabetes."
  },
  interpret_lab_values: {
    label: "Interpret Lab Values",
    icon: Activity,
    color: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40",
    placeholder: "Input test names along with their numerical result values...",
    defaultText: "Serum Creatinine: 1.8 mg/dL (Reference: 0.7 - 1.3 mg/dL)\nBUN: 32 mg/dL (Reference: 7 - 20 mg/dL)\nHaemoglobin: 10.5 g/dL (Reference: 13.8 - 17.2 g/dL)"
  },
  smart_record_search: {
    label: "Smart Medical Search",
    icon: Search,
    color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/40",
    placeholder: "Enter drug class, ICD-10 search term, or clinical diagnosis...",
    defaultText: "ICD-10 clinical diagnosis code and treatment guidelines for Type 2 Diabetes with Chronic Kidney Disease (stage 3-4)."
  },
  monthly_report_summary: {
    label: "Monthly Performance Summary",
    icon: FileSpreadsheet,
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40",
    placeholder: "Paste raw monthly numbers, patient flow counts, or laboratory invoices...",
    defaultText: "Total Registrations: 385 patients\nLaboratory Runs: 124 Malaria smears (32% positive), 85 HbA1c tests, 42 Lipid panels.\nPrescriptions Dispensed: 210 Amoxicillin, 150 Metformin, 95 Atorvastatin.\nRevenue: TZS 14,200,000 (Billing collection rate: 91%).\nPending Collections: TZS 1,280,000."
  }
};

const renderMessageContent = (content: string) => {
  const lines = content.split('\n');
  let inList = false;
  let listItems: string[] = [];
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const elements: React.ReactNode[] = [];

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-extrabold text-slate-950 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-xs leading-relaxed text-slate-850 dark:text-slate-100">
              {parseBoldText(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: number) => {
    if (tableHeaders.length > 0) {
      elements.push(
        <div key={`table-wrapper-${key}`} className="my-3 overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-[11px] bg-white dark:bg-slate-955">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {tableHeaders.map((header, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                    {parseBoldText(header.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-55 dark:hover:bg-slate-850">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 text-slate-850 dark:text-slate-100 font-medium">
                      {parseBoldText(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for table structure lines: starts and ends with '|'
    if (line.trim().startsWith('|')) {
      flushList(i);
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // If it is divider line (contains only dashes, colons, or spans e.g. |---|), skip it
      if (cells.every(c => /^[:-|-]*$/.test(c))) {
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable(i);
    }

    // Check for headings
    if (line.startsWith('### ')) {
      flushList(i);
      elements.push(
        <h4 key={i} className="text-xs font-bold text-slate-950 dark:text-white mt-3 mb-1.5 tracking-tight border-b border-slate-100 dark:border-slate-800 pb-0.5">
          {parseBoldText(line.slice(4))}
        </h4>
      );
      continue;
    }
    
    if (line.startsWith('## ')) {
      flushList(i);
      elements.push(
        <h3 key={i} className="text-sm font-extrabold text-slate-950 dark:text-white mt-4 mb-2 tracking-tight border-b border-slate-200 dark:border-slate-800 pb-1">
          {parseBoldText(line.slice(3))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      flushList(i);
      elements.push(
        <h2 key={i} className="text-base font-black text-slate-950 dark:text-white mt-4 mb-2 tracking-tight">
          {parseBoldText(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Check for list items
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      inList = true;
      listItems.push(line.trim().slice(2));
      continue;
    } else {
      flushList(i);
    }

    // Standard paragraph or spacing lines
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-[12px] leading-relaxed text-slate-850 dark:text-slate-100 my-1 font-semibold dark:font-medium">
          {parseBoldText(line)}
        </p>
      );
    }
  }

  // End checks
  flushList(lines.length);
  flushTable(lines.length);

  return <div className="space-y-0.5 select-text">{elements}</div>;
};

export const AiAssistantChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showFeatureDropdown, setShowFeatureDropdown] = useState(false);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('apld_clinical_ai_chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } catch (_) {}
    } else {
      // Add a friendly greeting
      setMessages([
        {
          role: 'assistant',
          content: "Hello! I am **APLD Smart AI Copilot**. Let's optimize clinical outcomes. Click one of the specialized diagnostic shortcodes below to start, or type a custom question.",
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  // Save chats to localStorage
  const saveChats = (newMessages: Message[]) => {
    localStorage.setItem('apld_clinical_ai_chats', JSON.stringify(newMessages));
  };

  // Scroll to bottom when messages list grows
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const selectFeatureShortcut = (featureKey: string) => {
    setSelectedFeature(featureKey);
    setCurrentPrompt(TEMPLATES[featureKey as keyof typeof TEMPLATES].defaultText);
    setShowFeatureDropdown(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentPrompt.trim() && !selectedFeature) return;

    const userMessageText = currentPrompt.trim() || `Execute ${TEMPLATES[selectedFeature as keyof typeof TEMPLATES].label}`;
    const newMsg: Message = {
      role: 'user',
      content: userMessageText,
      feature: selectedFeature || undefined,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    saveChats(updatedMessages);
    setCurrentPrompt('');
    setLoading(true);

    try {
      // Construct historical context for safe conversation flow
      const historyPayload = updatedMessages.slice(-6, -1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageText,
          history: historyPayload,
          feature: selectedFeature || undefined,
          context: userMessageText
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Server-side assistant returned an error status.');
      }

      const data = await res.json();

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      saveChats(finalMessages);
      
      // Reset selected feature unless user is continuously refining
      setSelectedFeature(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to communicate with AI Copilot.');
      
      const assistantMsg: Message = {
        role: 'assistant',
        content: `Error details: **${err.message || 'Connection offline.'}**\n\nPlease ensure your \`GEMINI_API_KEY\` is configured in your platform Secrets dashboard, and try again.`,
        timestamp: new Date()
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      saveChats(finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setShowClearConfirm(true);
  };

  const executeClear = () => {
    const reset = [
      {
        role: 'assistant',
        content: "Chat record cleared. How can I assist you with clinical, pharmacological, or laboratory insights today?",
        timestamp: new Date()
      } as Message
    ];
    setMessages(reset);
    saveChats(reset);
    setSelectedFeature(null);
    setCurrentPrompt('');
    toast.success("AI Chat history wiped");
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    toast.success("AI Advice copied to dashboard clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans select-none">
      {/* Expanded Interactive Chat Board */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 35, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="w-[92vw] sm:w-[420px] h-[580px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
          >
            {/* Custom confirm modal inside the sandboxed iFrame */}
            {showClearConfirm && (
              <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-6 z-50">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-[280px] text-center shadow-2xl">
                  <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mb-3">
                    <Trash2 className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Clear conversations?</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-normal">This will permanently delete all clinical advisory consultation history from your browser.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        executeClear();
                        setShowClearConfirm(false);
                      }}
                      className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-sm"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Header section styled with sleek premium gradients */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 p-4 shrink-0 flex items-center justify-between text-white border-b border-blue-800 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-white/10 flex items-center justify-center animate-pulse">
                  <Brain className="h-5 w-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                    APLD AI Copilot
                    <span className="text-[9px] uppercase tracking-wider bg-emerald-500 text-white font-mono font-black px-1.5 py-0.5 rounded-full">v3.5 Live</span>
                  </h3>
                  <p className="text-[10px] text-blue-100 dark:text-slate-400">Clinical Decision Support Auxiliary</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Clear Chat Record"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Close Advisor Panel"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Quick Action Shortcuts Panel */}
            <div className="bg-slate-50 dark:bg-slate-950/40 p-3 border-b border-slate-100 dark:border-slate-850 shrink-0">
              <div className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-2">Diagnostic Assistance Shortcuts</div>
              <div className="grid grid-cols-5 gap-1.5">
                {Object.entries(TEMPLATES).map(([key, item]) => {
                  const Icon = item.icon;
                  const isSelected = selectedFeature === key;
                  return (
                    <button
                      key={key}
                      onClick={() => selectFeatureShortcut(key)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border border-dashed transition-all cursor-pointer ${
                        isSelected 
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 scale-[0.98]' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-805 hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                      title={item.label}
                    >
                      <div className={`p-1.5 rounded-lg ${item.color} shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chats messages timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-slate-900/10">
              {messages.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-450 dark:text-slate-500 px-1 mb-1 font-mono">
                    {m.role === 'user' ? 'Attending Attrib' : 'Clinical Support Module'}
                    <span>•</span>
                    <span>{m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <div className={`group relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                    m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-250/70 dark:border-slate-700 text-slate-900 dark:text-slate-50 rounded-tl-none font-sans'
                  }`}>
                    {/* Copy advice snippet */}
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => handleCopy(m.content, idx)}
                        className="absolute top-2 right-2 p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105 cursor-pointer"
                        title="Copy to Clinical Clipboard"
                      >
                        {copiedId === idx ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}

                    <div className="max-w-full select-text">
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap font-medium text-[12px]">{m.content}</p>
                      ) : (
                        renderMessageContent(m.content)
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-450 dark:text-slate-500 px-1 mb-1 font-mono">
                    Clinical Support Module • Computing
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-100 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <span>Processing Clinical Informatics...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input clinical controls panel */}
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              {selectedFeature && (
                <div className="mb-2 bg-blue-50/60 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                    <span>Using active shortcut: <strong>{TEMPLATES[selectedFeature as keyof typeof TEMPLATES].label}</strong></span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedFeature(null);
                      setCurrentPrompt('');
                    }}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded text-blue-600 dark:text-blue-400 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                <div className="relative flex-1">
                  <textarea
                    rows={selectedFeature ? 3 : 1}
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    placeholder={
                      selectedFeature 
                      ? TEMPLATES[selectedFeature as keyof typeof TEMPLATES].placeholder 
                      : "Ask doctor copilot about diagnoses, tests, values or drug profiles..."
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 text-xs rounded-xl p-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500/50 dark:focus:ring-blue-500/30 resize-none font-sans block"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  
                  {/* General selector dropdown click for easier accessibility */}
                  <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowFeatureDropdown(!showFeatureDropdown)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title="Explore Shortcuts"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Feature Popup Quick Picker */}
                  {showFeatureDropdown && (
                    <div 
                      ref={dropdownRef}
                      className="absolute bottom-11 right-0 w-64 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-2 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 text-[10px] font-bold text-slate-450 uppercase tracking-wider">AI Feature Module Quick Switch</div>
                      <div className="divide-y divide-slate-50 dark:divide-slate-850">
                        {Object.entries(TEMPLATES).map(([key, item]) => {
                          const IconComp = item.icon;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => selectFeatureShortcut(key)}
                              className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition-colors flex items-center gap-2 text-xs text-slate-700 dark:text-slate-350 cursor-pointer"
                            >
                              <div className={`p-1.5 rounded-lg ${item.color}`}>
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || (!currentPrompt.trim() && !selectedFeature)}
                  className="h-9 w-9 rounded-xl shrink-0 p-0 bg-blue-600 hover:bg-blue-700 dark:bg-blue-750 dark:hover:bg-blue-700 text-white flex items-center justify-center cursor-pointer shadow-md"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
            
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-850 text-center text-[9px] text-slate-400">
              Disclaimer: Clinical advisory only. ATTENDING STAFF MUST CONFIRM LAB VALUES & ORDERS.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating launcher trigger circle */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="h-14 w-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-700 dark:from-indigo-950 dark:via-blue-650 dark:to-indigo-500 rounded-full flex items-center justify-center text-white shadow-2xl relative cursor-pointer group hover:rotate-[8deg] transition-transform duration-200"
        aria-label="APLD Smart AI Copilot"
        id="apld-copilot-launcher"
      >
        <span className="absolute inset-0 rounded-full bg-indigo-500/20 dark:bg-indigo-400/10 scale-105 animate-ping opacity-75" />
        {isOpen ? (
          <X className="h-6 w-6 relative text-white" />
        ) : (
          <div className="relative">
            <Brain className="h-6.5 w-6.5 relative text-white" />
            <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-emerald-400 animate-pulse" />
          </div>
        )}
      </motion.button>
    </div>
  );
};
