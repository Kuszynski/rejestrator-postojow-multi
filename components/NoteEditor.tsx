'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';

interface NoteEditorProps {
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
  initialNote?: string;
}

export default function NoteEditor({ onClose, onSave, initialNote = '' }: NoteEditorProps) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [note]);

  const handleSave = async () => {
    if (!note.trim()) {
      alert('Vennligst skriv inn et notat');
      return;
    }
    setSaving(true);
    try {
      await onSave(note);
      onClose();
    } catch (error) {
      alert('Feil ved lagring');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 md:p-6 shadow-lg flex-shrink-0">
        <div className="max-w-[90vw] mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-1">📝 Daglig notat</h2>
            <p className="text-green-100 text-sm md:text-base">Skriv et notat til sjefen</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Lukk"
          >
            <X className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-4 md:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-[90vw] mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8">
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Skriv ditt notat her... Du kan skrive så mye du vil, feltet utvider seg automatisk."
              className="w-full px-4 md:px-6 py-4 md:py-6 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500 transition-all text-lg md:text-2xl leading-relaxed resize-none outline-none min-h-[60vh]"
              maxLength={1000}
            />
            
            {/* Character count */}
            <div className="mt-4 text-right">
              <span className={`text-sm md:text-base font-medium ${
                note.length > 900 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {note.length} / 1000 tegn
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with buttons */}
      <div className="bg-white border-t-2 border-gray-200 p-4 md:p-6 shadow-lg flex-shrink-0">
        <div className="max-w-[90vw] mx-auto flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-6 py-4 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-bold transition-all text-lg"
          >
            ← Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!note.trim() || saving}
            className="flex-1 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-lg flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Lagrer...' : 'Lagre notat'}
          </button>
        </div>
      </div>
    </div>
  );
}
