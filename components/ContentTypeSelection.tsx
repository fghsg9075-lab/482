import React from 'react';
import { Video, FileText, CheckSquare, Headphones, ArrowLeft } from 'lucide-react';
import { ContentType } from '../types';

interface Props {
  onSelect: (type: 'VIDEO' | 'PDF' | 'MCQ' | 'AUDIO') => void;
  onBack: () => void;
}

export const ContentTypeSelection: React.FC<Props> = ({ onSelect, onBack }) => {
  const options = [
    { id: 'VIDEO', label: 'Video Lectures', icon: Video, color: 'text-blue-600', bg: 'bg-blue-100', border: 'hover:border-blue-400' },
    { id: 'PDF', label: 'Notes & PDFs', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-100', border: 'hover:border-orange-400' },
    { id: 'MCQ', label: 'MCQ Practice', icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-100', border: 'hover:border-purple-400' },
    { id: 'AUDIO', label: 'Audio Learning', icon: Headphones, color: 'text-pink-600', bg: 'bg-pink-100', border: 'hover:border-pink-400' }
  ] as const;

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-24">
      <div className="flex items-center mb-8">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-4 bg-white p-2 rounded-full shadow-sm border border-slate-200">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-800">
                Select Content Type
            </h2>
            <p className="text-slate-500 text-sm font-medium">What do you want to learn today?</p>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`flex items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all text-left group ${opt.border} hover:shadow-md active:scale-95`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mr-5 ${opt.bg} ${opt.color} group-hover:scale-110 transition-transform shadow-inner`}>
              <opt.icon size={32} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 mb-1">{opt.label}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tap to View</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
