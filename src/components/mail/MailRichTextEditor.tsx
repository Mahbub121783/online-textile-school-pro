import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Quote, Heading1, Heading2, Link as LinkIcon,
  Table as TableIcon, Image, Undo, Redo, Highlighter, Minus, Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface MailRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const COLORS = ['#000000','#e03131','#2f9e44','#1971c2','#f08c00','#7048e8','#0c8599','#e64980'];

export default function MailRichTextEditor({ content, onChange, placeholder = 'Write your message...', minHeight = '200px' }: MailRichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      ImageExt,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      transformPastedHTML: (html) => {
        const stripped = html
          .replace(/<img[^>]+src=["']data:[^"']+["'][^>]*>/gi, '')
          .replace(/background(-image)?\s*:\s*url\(\s*["']?data:[^)]+\)\s*;?/gi, '');
        if (stripped !== html) {
          console.warn('[MailRichTextEditor] Inline base64 image paste blocked.');
        }
        return stripped;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              alert('Pasting images directly is blocked. Use the Image button to insert a URL.');
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, children, title }: any) => (
    <Button type="button" variant="ghost" size="icon" className={`h-7 w-7 ${active ? 'bg-muted text-primary' : ''}`} onClick={onClick} title={title}>
      {children}
    </Button>
  );

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
    } else {
      editor.chain().focus().unsetLink().run();
    }
  };

  const addImage = () => {
    const url = prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b bg-muted/30">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px bg-border mx-0.5" />
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px bg-border mx-0.5" />
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px bg-border mx-0.5" />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List"><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule"><Minus className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px bg-border mx-0.5" />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Text Color"><Type className="h-3.5 w-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c} className="w-5 h-5 rounded-full border" style={{ backgroundColor: c }}
                  onClick={() => editor.chain().focus().setColor(c).run()} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Highlight"><Highlighter className="h-3.5 w-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex gap-1">
              {['#ffc078','#a5d8ff','#b2f2bb','#ffec99','#eebefa'].map(c => (
                <button key={c} className="w-5 h-5 rounded-full border" style={{ backgroundColor: c }}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-px bg-border mx-0.5" />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('link') ? 'bg-muted text-primary' : ''}`} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 space-y-2">
            <Input placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="h-7 text-xs" />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs" onClick={addLink}>Set Link</Button>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => editor.chain().focus().unsetLink().run()}>Remove</Button>
            </div>
          </PopoverContent>
        </Popover>
        <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table"><TableIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={addImage} title="Insert Image"><Image className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px bg-border mx-0.5" />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="h-3.5 w-3.5" /></ToolBtn>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]" style={{ minHeight }} />
    </div>
  );
}
