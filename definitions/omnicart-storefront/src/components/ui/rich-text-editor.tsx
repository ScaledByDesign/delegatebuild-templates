import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { Button } from './button';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  // Update editor content when value changes externally
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      onChange(editorRef.current.innerHTML);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className={cn('border rounded-md', className)}>
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b bg-gray-50">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('bold')}
          className="h-7 w-7 p-0"
          title="Bold"
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('italic')}
          className="h-7 w-7 p-0"
          title="Italic"
        >
          <Italic className="h-3 w-3" />
        </Button>
        <div className="w-px bg-gray-300 mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('insertUnorderedList')}
          className="h-7 w-7 p-0"
          title="Bullet List"
        >
          <List className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('insertOrderedList')}
          className="h-7 w-7 p-0"
          title="Numbered List"
        >
          <ListOrdered className="h-3 w-3" />
        </Button>
        <div className="w-px bg-gray-300 mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<p>')}
          className="h-7 px-2 text-xs"
          title="Paragraph"
        >
          P
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<h3>')}
          className="h-7 px-2 text-xs"
          title="Heading"
        >
          H3
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className={cn(
          'min-h-[100px] p-3 text-sm focus:outline-none',
          'prose prose-sm max-w-none',
          '[&>p]:mb-2 [&>p:last-child]:mb-0',
          '[&>ul]:mb-2 [&>ul]:ml-4 [&>ul]:list-disc',
          '[&>ol]:mb-2 [&>ol]:ml-4 [&>ol]:list-decimal',
          '[&>h3]:text-base [&>h3]:font-semibold [&>h3]:mb-2',
          !value && 'empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400'
        )}
        data-placeholder={placeholder}
      />
    </div>
  );
}

