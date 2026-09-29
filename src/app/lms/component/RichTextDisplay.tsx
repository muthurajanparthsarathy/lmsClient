"use client";

import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

const RichTextDisplay = ({ content, className = '' }: RichTextDisplayProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sanitizeContent = (html: string) => {
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'img', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['src', 'alt', 'class', 'style', 'width', 'height']
      });
    }
    return html;
  };

  if (!content) {
    return <div className={`text-gray-500 italic ${className}`}>No description available</div>;
  }

  const createMarkup = () => {
    return { __html: sanitizeContent(content) };
  };

  return (
    <div 
      className={`rich-text-content prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={createMarkup()}
      style={{
        lineHeight: '1.6',
        fontSize: '14px'
      }}
    />
  );
};

export default RichTextDisplay;