import { useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link, Image, Minus, Undo, Redo } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const RichTextEditor = ({ value, onChange, placeholder = 'Start writing...', minHeight = '200px' }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const tools = [
    { icon: Bold, cmd: 'bold', label: 'Bold' },
    { icon: Italic, cmd: 'italic', label: 'Italic' },
    { icon: Underline, cmd: 'underline', label: 'Underline' },
    { icon: List, cmd: 'insertUnorderedList', label: 'Bullet List' },
    { icon: ListOrdered, cmd: 'insertOrderedList', label: 'Numbered List' },
    { icon: Minus, cmd: 'insertHorizontalRule', label: 'Horizontal Rule' },
    { icon: Undo, cmd: 'undo', label: 'Undo' },
    { icon: Redo, cmd: 'redo', label: 'Redo' },
  ];

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) exec('insertImage', url);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
        {tools.map((t) => (
          <Button
            key={t.cmd}
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t.label}
            onMouseDown={(e) => { e.preventDefault(); exec(t.cmd); }}
          >
            <t.icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Link" onMouseDown={(e) => { e.preventDefault(); insertLink(); }}>
          <Link className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Image" onMouseDown={(e) => { e.preventDefault(); insertImage(); }}>
          <Image className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto flex items-center gap-1 px-2">
          <select
            className="h-7 text-xs border rounded px-1 bg-background"
            onChange={(e) => exec('formatBlock', e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Heading</option>
            <option value="p">Paragraph</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="p-4 outline-none prose prose-sm max-w-none text-foreground"
        style={{ minHeight }}
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
