
import React, { useRef, useEffect } from 'react';

const BoldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
);

const ItalicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
);

const HighlightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m18 13-2.5 2.5a1.414 1.414 0 0 1-2 0L8 10l-1.5 1.5a1.414 1.414 0 0 0 0 2L14 21l7-7-4-4Z"></path><path d="M12.5 2.5 14 4"></path><path d="m21 11-2-2"></path><path d="m11 11 2 2"></path><path d="m6 6 2 2"></path></svg>
);


interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const RichTextInput: React.FC<RichTextInputProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This effect ensures that if the `value` prop changes from an external source
    // (e.g., form reset), the editor's content is updated. The check prevents
    // a feedback loop when the change comes from the editor itself.
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleCommand = (command: string, valueArg?: string) => {
    document.execCommand(command, false, valueArg);
    if (editorRef.current) {
        // After a command, the state needs to be synced manually as `onInput` may not fire.
        onChange(editorRef.current.innerHTML);
        editorRef.current.focus();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };
  
  const preventFocusSteal = (e: React.MouseEvent) => {
    // We prevent default on mousedown to stop the editor from losing focus,
    // which would cause the text selection to be lost before the command runs.
    e.preventDefault();
  };

  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-600 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
      <div className="flex items-center space-x-1 p-2 border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-t-md">
        <button type="button" onMouseDown={preventFocusSteal} onClick={() => handleCommand('bold')} className="p-1 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10" aria-label="Bold">
            <BoldIcon />
        </button>
        <button type="button" onMouseDown={preventFocusSteal} onClick={() => handleCommand('italic')} className="p-1 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10" aria-label="Italic">
            <ItalicIcon />
        </button>
        <button type="button" onMouseDown={preventFocusSteal} onClick={() => handleCommand('hiliteColor', '#fef08a')} className="p-1 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10" aria-label="Highlight">
            <HighlightIcon />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        // The `dangerouslySetInnerHTML` prop was removed. It was causing React to
        // re-render the content on every keystroke, which reset the cursor to the beginning.
        // The `useEffect` now properly handles setting the initial value without this side effect.
        className="w-full min-h-[100px] p-2 dark:bg-gray-700 focus:outline-none prose dark:prose-invert max-w-none"
        aria-label="Rich text editor for summary"
      />
      <style>{`
        .prose mark {
          background-color: #fef08a;
          padding: 0.1em;
        }
      `}</style>
    </div>
  );
};