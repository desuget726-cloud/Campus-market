import React, { useState, useRef } from 'react';

const MessagesSection = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages] = useState([]); // Empty state for demo
  const [messageText, setMessageText] = useState('');
  const textareaRef = useRef(null);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'spam', label: 'Spam' }
  ];

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
          
          {/* Left Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-[28px] shadow-lg border border-slate-100 p-6 flex flex-col">
            
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">My messages</h2>
            </div>

            {/* Search Input */}
            <div className="mb-6 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:bg-white transition"
              />
            </div>

            {/* Tabs */}
            <div className="space-y-2 flex-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg font-semibold transition-all relative ${
                    activeTab === tab.id
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Chat Bubble Illustration */}
            <div className="mt-auto pt-6 flex justify-center">
              <div className="relative w-24 h-24">
                {/* Left bubble */}
                <div className="absolute left-0 top-0 w-12 h-12 bg-emerald-100 rounded-full rounded-tl-none flex items-center justify-center shadow-sm">
                  <span className="text-lg">💬</span>
                </div>
                {/* Right bubble - offset and smaller */}
                <div className="absolute right-0 bottom-0 w-10 h-10 bg-sky-100 rounded-full rounded-br-none flex items-center justify-center shadow-sm">
                  <span className="text-sm">💭</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Chat Window */}
          <div className="lg:col-span-3 bg-white rounded-[28px] shadow-lg border border-slate-100 overflow-hidden flex flex-col">
            <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold">T</div>
                  <span className="absolute -right-0.5 -bottom-0.5 block h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div>
                  <p className="text-slate-950 font-semibold">Tracy</p>
                  <p className="text-xs text-slate-500 mt-0.5">Active</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-500">
                <button type="button" className="rounded-full p-2 hover:bg-slate-100 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6 10a2 2 0 114 0 2 2 0 01-4 0zm4-6a2 2 0 100 4 2 2 0 000-4zm0 12a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                </button>
                <button type="button" className="rounded-full p-2 hover:bg-slate-100 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-slate-50">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500">How can we help you?</p>
              </div>

              <div className="flex justify-end">
                <div className="rounded-[20px] rounded-tr-none bg-emerald-500 px-4 py-2.5 text-sm leading-6 text-white max-w-[75%] ml-auto">
                  Sure, I’d love some advice on which laptop is best for campus use.
                </div>
              </div>

              <div className="text-center text-xs text-slate-400">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 mr-2">T</span>
                Tracy joined the conversation
              </div>

              <div className="flex justify-start">
                <div className="rounded-[20px] rounded-tl-none bg-slate-100 px-4 py-2.5 text-sm leading-6 text-slate-900 max-w-[75%] mr-auto">
                  Hello! I can help you compare laptops for study, budget, and battery life.
                  <div className="mt-2 text-[11px] text-slate-500">Tracy • Just now</div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
              <div className="border-2 border-emerald-500 rounded-[24px] p-3 flex flex-col gap-3 bg-white">
                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  rows={1}
                  placeholder="Message..."
                  className="min-h-[56px] w-full resize-none border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-slate-400">
                    <button type="button" className="rounded-full p-2 hover:bg-slate-100 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828M15.172 7L18 9.828M15.172 7L12.293 4.121" />
                      </svg>
                    </button>
                    <button type="button" className="rounded-full p-2 hover:bg-slate-100 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14.828 14.828a4 4 0 01-5.656 0 4 4 0 010-5.656 4 4 0 015.656 5.656z" />
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" opacity=".25" />
                      </svg>
                    </button>
                    <button type="button" className="rounded-full p-2 hover:bg-slate-100 transition">
                      <span className="text-xs font-semibold">GIF</span>
                    </button>
                    <button type="button" className="rounded-full p-2 hover:bg-slate-100 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22M5 12h14" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!messageText.trim()) return;
                      setMessageText('');
                      if (textareaRef.current) textareaRef.current.style.height = 'auto';
                    }}
                    className={`h-11 w-11 rounded-full transition flex items-center justify-center ${messageText.trim() ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-9.193-5.288A1 1 0 004 6.618v10.764a1 1 0 001.559.829l9.193-5.288a1 1 0 000-1.658z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MessagesSection;
