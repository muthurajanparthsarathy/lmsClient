"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Undo,
    Redo,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Image as ImageIcon,
    Plus,
    Minus,
    X,
    Trash2,
    ZoomIn,
    ZoomOut
} from "lucide-react";

// Types
export interface EditorOutput {
    html: string;
    parsed: {
        text: string;
        imageUrl: string | null;
        imageAlignment: 'left' | 'center' | 'right';
        imageSizePercent: number;
    };
}

interface TipTapEditorProps {
    value?: string;
    onChange: (output: EditorOutput) => void;
    placeholder?: string;
    minHeight?: string;
    maxHeight?: string;
    showToolbar?: boolean;
    editable?: boolean;
    initialImageSize?: number;
}

interface ImageToolbarProps {
    alignment: 'left' | 'center' | 'right';
    sizePercent: number;
    onAlignmentChange: (alignment: 'left' | 'center' | 'right') => void;
    onSizeChange: (size: number) => void;
    onRemove: () => void;
    onClose: () => void;
}

interface SelectedImage {
    element: Element;
    src: string;
    alignment: 'left' | 'center' | 'right';
    sizePercent: number;
}

// Font families available
const fontFamilies: Array<{ name: string; value: string }> = [
    { name: 'Default', value: '' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { name: 'Impact', value: 'Impact, sans-serif' },
];

// Font sizes available
const fontSizes: Array<{ label: string; value: string }> = [
    { label: 'Small', value: '12px' },
    { label: 'Normal', value: '14px' },
    { label: 'Medium', value: '16px' },
    { label: 'Large', value: '18px' },
    { label: 'XL', value: '20px' },
    { label: '2XL', value: '24px' },
    { label: '3XL', value: '30px' },
];

// Custom extension for font size with commands
const FontSize = TextStyle.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            fontSize: {
                default: null,
                parseHTML: (element: HTMLElement) => element.style.fontSize,
                renderHTML: (attributes: any) => {
                    if (!attributes.fontSize) {
                        return {};
                    }
                    return {
                        style: `font-size: ${attributes.fontSize}`,
                    };
                },
            },
        };
    },

    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run();
            },
            unsetFontSize: () => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});

// Image Toolbar Component - Fixed to be centered
const ImageToolbar: React.FC<ImageToolbarProps> = ({
    alignment,
    sizePercent,
    onAlignmentChange,
    onSizeChange,
    onRemove,
    onClose
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-visible select-none min-w-[280px]">
            <div className="flex items-stretch divide-x divide-gray-100">
                <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Align</span>
                    <div className="flex items-center gap-0.5">
                        {(['left', 'center', 'right'] as const).map((a) => (
                            <button
                                key={a}
                                onClick={() => onAlignmentChange(a)}
                                className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all ${alignment === a
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'
                                    }`}
                            >
                                {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Size</span>
                    <div className="flex items-center gap-1.5">
                        <ZoomOut className="h-3 w-3 text-gray-400" />
                        <input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={sizePercent}
                            onChange={(e) => onSizeChange(parseInt(e.target.value))}
                            className="flex-1 h-1.5 accent-indigo-600 cursor-pointer"
                        />
                        <ZoomIn className="h-3 w-3 text-gray-400" />
                        <span className="text-[10px] font-bold text-indigo-600 w-8 text-right">{sizePercent}%</span>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 px-2 py-2">
                    <button
                        onClick={onRemove}
                        className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-all"
                        title="Remove image"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-semibold">Remove</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-all"
                        title="Close"
                    >
                        <X className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-semibold">Close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Toolbar Component
const TipTapToolbar: React.FC<{ editor: any; initialImageSize?: number }> = ({ editor, initialImageSize = 20 }) => {
    if (!editor) {
        return null;
    }

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editor) return;

        if (!file.type.startsWith('image/')) {
            console.error("Please select an image file");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result;
            if (base64) {
                // Insert image with default size and center alignment
                editor.chain().focus().setImage({
                    src: base64,
                    'data-alignment': 'center',
                    'data-size': initialImageSize.toString()
                }).run();
            }
        };
        reader.readAsDataURL(file);

        // Reset file input
        event.target.value = '';
    };

    // Get current font size
    const getCurrentFontSize = (): string => {
        return editor.getAttributes('textStyle').fontSize || '14px';
    };

    // Increase font size
    const increaseFontSize = () => {
        const currentSize = getCurrentFontSize();
        const currentSizeNum = parseInt(currentSize);
        const newSize = isNaN(currentSizeNum) ? 16 : Math.min(currentSizeNum + 2, 36);
        editor.chain().focus().setFontSize(`${newSize}px`).run();
    };

    // Decrease font size
    const decreaseFontSize = () => {
        const currentSize = getCurrentFontSize();
        const currentSizeNum = parseInt(currentSize);
        const newSize = isNaN(currentSizeNum) ? 12 : Math.max(currentSizeNum - 2, 8);
        editor.chain().focus().setFontSize(`${newSize}px`).run();
    };

    // Set specific font size
    const setFontSize = (size: string) => {
        editor.chain().focus().setFontSize(size).run();
    };

    return (
        <div className="flex flex-wrap items-center gap-1 p-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            {/* Font Family */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <select
                    value={editor.getAttributes('textStyle').fontFamily || ''}
                    onChange={(e) => {
                        const fontFamily = e.target.value;
                        if (fontFamily) {
                            editor.chain().focus().setFontFamily(fontFamily).run();
                        } else {
                            editor.chain().focus().unsetFontFamily().run();
                        }
                    }}
                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 cursor-pointer min-w-[100px]"
                    title="Font Family"
                    style={{
                        fontFamily: editor.getAttributes('textStyle').fontFamily || 'inherit'
                    }}
                >
                    {fontFamilies.map((font) => (
                        <option
                            key={font.value}
                            value={font.value}
                            style={{ fontFamily: font.value || 'inherit' }}
                        >
                            {font.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Font Size Controls */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <button
                    type="button"
                    onClick={decreaseFontSize}
                    className="p-2 rounded hover:bg-white transition-all duration-200 border border-transparent text-slate-600 hover:border-slate-300"
                    title="Decrease Font Size"
                >
                    <Minus className="h-4 w-4" />
                </button>

                <select
                    value={getCurrentFontSize()}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 cursor-pointer min-w-[80px]"
                    title="Font Size"
                >
                    {fontSizes.map((size) => (
                        <option key={size.value} value={size.value}>
                            {size.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={increaseFontSize}
                    className="p-2 rounded hover:bg-white transition-all duration-200 border border-transparent text-slate-600 hover:border-slate-300"
                    title="Increase Font Size"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            {/* Text Formatting */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive('bold')
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive('italic')
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive('underline')
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Underline (Ctrl+U)"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive('strike')
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Strikethrough"
                >
                    <s className="text-sm font-bold">S</s>
                </button>
            </div>

            {/* Lists */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive('bulletList')
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Bullet List"
                >
                    <List className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive('orderedList')
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Numbered List"
                >
                    <ListOrdered className="h-4 w-4" />
                </button>
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive({ textAlign: 'left' })
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Align Left"
                >
                    <AlignLeft className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive({ textAlign: 'center' })
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Align Center"
                >
                    <AlignCenter className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`p-2 rounded hover:bg-white transition-all duration-200 border ${editor.isActive({ textAlign: 'right' })
                        ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        : 'border-transparent text-slate-600 hover:border-slate-300'
                        }`}
                    title="Align Right"
                >
                    <AlignRight className="h-4 w-4" />
                </button>
            </div>

            {/* Text Color */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <input
                    type="color"
                    onInput={(event: React.FormEvent<HTMLInputElement>) =>
                        editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()
                    }
                    value={editor.getAttributes('textStyle').color || '#000000'}
                    title="Text Color"
                    className="w-8 h-8 p-1 rounded hover:bg-white transition-all duration-200 border border-transparent hover:border-slate-300 cursor-pointer"
                    style={{ padding: '2px' }}
                />
            </div>

            {/* Image Upload */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <label className="p-2 rounded hover:bg-white transition-all duration-200 border border-transparent text-slate-600 hover:border-slate-300 cursor-pointer" title="Insert Image">
                    <ImageIcon className="h-4 w-4" />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                </label>
            </div>

            {/* History */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="p-2 rounded hover:bg-white transition-all duration-200 border border-transparent text-slate-600 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="p-2 rounded hover:bg-white transition-all duration-200 border border-transparent text-slate-600 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

// Main Editor Component
const TipTapEditor: React.FC<TipTapEditorProps> = ({
    value = '',
    onChange,
    placeholder = "Start typing...",
    minHeight = "120px",
    maxHeight = "200px",
    showToolbar = true,
    editable = true,
    initialImageSize = 20
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
    const [imagePosition, setImagePosition] = useState({ top: 0, left: 0 });
    const editorRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Helper function to extract image and text from HTML
    const extractImageAndText = (html: string): EditorOutput['parsed'] => {
        if (!html || typeof window === 'undefined') {
            return {
                text: html || '',
                imageUrl: null,
                imageAlignment: 'left',
                imageSizePercent: initialImageSize
            };
        }

        // Create a temporary DOM element to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Find the first image element
        const imgElement = tempDiv.querySelector('img');

        // Default values
        let imageUrl: string | null = null;
        let imageAlignment: 'left' | 'center' | 'right' = 'left';
        let imageSizePercent = initialImageSize;
        let textContent = html;

        if (imgElement) {
            // Extract image attributes
            imageUrl = imgElement.src || null;
            imageAlignment = (imgElement.getAttribute('data-alignment') as 'left' | 'center' | 'right') || 'left';
            imageSizePercent = parseInt(imgElement.getAttribute('data-size') || initialImageSize.toString(), 10);

            // Remove the image from the HTML to get text-only content
            imgElement.remove();

            // Get the remaining HTML without the image
            textContent = tempDiv.innerHTML;

            // Clean up empty paragraphs
            if (textContent === '<p></p>' || textContent === '<p><br></p>' || !textContent.trim()) {
                textContent = '';
            }
        }

        return {
            text: textContent,
            imageUrl,
            imageAlignment,
            imageSizePercent
        };
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                bulletList: {
                    HTMLAttributes: {
                        class: 'bullet-list custom-bullet-list',
                    },
                },
                orderedList: {
                    HTMLAttributes: {
                        class: 'ordered-list custom-ordered-list',
                    },
                },
                listItem: {
                    HTMLAttributes: {
                        class: 'custom-list-item',
                    },
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph', 'listItem', 'image'],
            }),
            TextStyle,
            Color,
            Underline,
            FontFamily.configure({
                types: ['textStyle'],
            }),
            FontSize,
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        src: {
                            default: null,
                        },
                        alt: {
                            default: null,
                        },
                        title: {
                            default: null,
                        },
                        'data-alignment': {
                            default: 'center',
                            parseHTML: (element: HTMLElement) => element.getAttribute('data-alignment') || 'center',
                            renderHTML: (attributes: any) => ({
                                'data-alignment': attributes['data-alignment'],
                            }),
                        },
                        'data-size': {
                            default: initialImageSize.toString(),
                            parseHTML: (element: HTMLElement) => element.getAttribute('data-size') || initialImageSize.toString(),
                            renderHTML: (attributes: any) => ({
                                'data-size': attributes['data-size'],
                            }),
                        },
                        style: {
                            default: null,
                            parseHTML: (element: HTMLElement) => {
                                const size = element.getAttribute('data-size') || initialImageSize.toString();
                                const alignment = element.getAttribute('data-alignment') || 'center';
                                
                                let float = 'none';
                                let margin = '0 auto';
                                
                                if (alignment === 'left') {
                                    float = 'left';
                                    margin = '0 1rem 0.5rem 0';
                                } else if (alignment === 'right') {
                                    float = 'right';
                                    margin = '0 0 0.5rem 1rem';
                                } else {
                                    float = 'none';
                                    margin = '0 auto';
                                }
                                
                                return `width: ${size}%; ${float !== 'none' ? `float: ${float};` : ''} margin: ${margin}; display: block;`;
                            },
                            renderHTML: (attributes: any) => {
                                const size = attributes['data-size'] || initialImageSize;
                                const alignment = attributes['data-alignment'] || 'center';
                                
                                let float = 'none';
                                let margin = '0 auto';
                                
                                if (alignment === 'left') {
                                    float = 'left';
                                    margin = '0 1rem 0.5rem 0';
                                } else if (alignment === 'right') {
                                    float = 'right';
                                    margin = '0 0 0.5rem 1rem';
                                } else {
                                    float = 'none';
                                    margin = '0 auto';
                                }
                                
                                return {
                                    style: `width: ${size}%; ${float !== 'none' ? `float: ${float};` : ''} margin: ${margin}; display: block;`,
                                };
                            },
                        },
                    };
                },
            }).configure({
                inline: false,
                allowBase64: true,
            }),
            Placeholder.configure({
                placeholder: placeholder,
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            const parsed = extractImageAndText(html);

            // Call onChange with both html and parsed data
            onChange({
                html,
                parsed
            });
        },
        onSelectionUpdate: ({ editor }) => {
            // Check if image is selected
            const { selection } = editor.state;
            const node = selection.node;

            if (node && node.type.name === 'image') {
                // Get position of the image element
                const view = editor.view;
                const dom = view.nodeDOM(selection.from);

                if (dom && dom.nodeType === Node.ELEMENT_NODE) {
                    const rect = (dom as Element).getBoundingClientRect();
                    const editorRect = editorRef.current?.getBoundingClientRect();

                    if (editorRect) {
                        // Calculate position relative to editor
                        const relativeTop = rect.top - editorRect.top;

                        setImagePosition({
                            top: relativeTop,
                            left: rect.left + (rect.width / 2), // Center of the image
                        });

                        setSelectedImage({
                            element: dom as Element,
                            src: node.attrs.src,
                            alignment: node.attrs['data-alignment'],
                            sizePercent: parseInt(node.attrs['data-size']),
                        });
                    }
                }
            } else {
                setSelectedImage(null);
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none p-4 text-slate-700 leading-relaxed min-h-full',
            },
        },
        editable,
        immediatelyRender: false,
    });

    // Update editor content when value changes from outside
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '', false);
        }
    }, [value, editor]);

    // Handle image alignment update
    const handleAlignmentChange = (alignment: 'left' | 'center' | 'right') => {
        if (!selectedImage || !editor) return;

        const { from } = editor.state.selection;
        editor.chain().focus().updateAttributes('image', {
            'data-alignment': alignment,
        }).run();

        setSelectedImage(prev => prev ? { ...prev, alignment } : null);
    };

    // Handle image size update
    const handleSizeChange = (sizePercent: number) => {
        if (!selectedImage || !editor) return;

        const { from } = editor.state.selection;
        editor.chain().focus().updateAttributes('image', {
            'data-size': sizePercent.toString(),
        }).run();

        setSelectedImage(prev => prev ? { ...prev, sizePercent } : null);
    };

    // Handle image removal
    const handleImageRemove = () => {
        if (!selectedImage || !editor) return;

        const { from } = editor.state.selection;
        editor.chain().focus().deleteSelection().run();
        setSelectedImage(null);
    };

    // Handle image toolbar close
    const handleImageToolbarClose = () => {
        setSelectedImage(null);
        if (editor) {
            editor.commands.focus();
        }
    };

    // Click outside to close toolbar
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectedImage && 
                toolbarRef.current && 
                !toolbarRef.current.contains(e.target as Node) && 
                !(e.target as Element).closest('.ProseMirror img')) {
                setSelectedImage(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedImage]);

    // Custom CSS for image styling - MOVED HERE from the toolbar component
    useEffect(() => {
        if (editor && contentRef.current) {
            // Add CSS to handle image styling
            const style = document.createElement('style');
            style.textContent = `
                .ProseMirror img {
                    border-radius: 12px;
                    border: 2px solid transparent;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .ProseMirror img:hover {
                    border-color: #818cf8;
                    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.1);
                }
                .ProseMirror img.selected {
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
                }
                /* Clear float after images */
                .ProseMirror:after {
                    content: "";
                    display: table;
                    clear: both;
                }
            `;
            document.head.appendChild(style);

            return () => {
                document.head.removeChild(style);
            };
        }
    }, [editor]);

    if (!isMounted) {
        return (
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white font-sans shadow-sm">
                {showToolbar && (
                    <div className="flex flex-wrap items-center gap-1 p-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                        <div className="animate-pulse flex gap-1">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                )}
                <div style={{ minHeight, maxHeight }} className="p-4 bg-white">
                    <div className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded mb-2"></div>
                        <div className="h-4 bg-slate-200 rounded mb-2"></div>
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={editorRef}
            className="border border-slate-300 rounded-lg overflow-hidden bg-white font-sans shadow-sm hover:shadow-md transition-shadow duration-200 relative"
        >
            {showToolbar && editable && (
                <TipTapToolbar
                    editor={editor}
                    initialImageSize={initialImageSize}
                />
            )}

            {/* Centered Image Toolbar */}
            {selectedImage && (
                <div
                    ref={toolbarRef}
                    className="fixed z-50"
                    style={{
                        top: '200px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                    }}
                >
                    <ImageToolbar
                        alignment={selectedImage.alignment}
                        sizePercent={selectedImage.sizePercent}
                        onAlignmentChange={handleAlignmentChange}
                        onSizeChange={handleSizeChange}
                        onRemove={handleImageRemove}
                        onClose={handleImageToolbarClose}
                    />
                </div>
            )}

            <div
                ref={contentRef}
                style={{ minHeight, maxHeight }}
                className="overflow-y-auto bg-white custom-tiptap-styles"
            >
                <EditorContent editor={editor} />
            </div>

            {/* Status indicator for images */}
            {selectedImage && (
                <div className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-full shadow-lg">
                    Image selected
                </div>
            )}
        </div>
    );
};

export default TipTapEditor;