import React from 'react';
import { ChevronRight, Home, BookOpen, Code, FileText } from 'lucide-react';

export default function Breadcrumbs() {
  const handleClick = (href: string) => {
    // In a real Next.js app, you'd use router.push(href)
    console.log(`Navigating to: ${href}`);
  };

  const breadcrumbItems = [
    { 
      label: 'All Topics', 
      href: '/', 
      icon: Home, 
      iconSize: 14
    },
    { 
      label: 'Web Development', 
      href: '/web-development', 
      icon: BookOpen, 
      iconSize: 14
    },
    { 
      label: 'HTML Fundamentals', 
      href: '/web-development/html-fundamentals', 
      icon: Code, 
      iconSize: 14
    },
    { 
      label: 'Structure & Semantics', 
      href: '/web-development/html-fundamentals/structure-semantics', 
      icon: FileText, 
      iconSize: 14,
      isActive: true
    }
  ];

  return (
    <div className="px-3 sm:px-4 py-2">
      <nav className="flex items-center" aria-label="Breadcrumb">
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight 
                size={12} 
                className="text-gray-400 mx-1 flex-shrink-0" 
                aria-hidden="true"
              />
            )}
            
            {item.isActive ? (
              <div className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm">
                <item.icon size={item.iconSize} className="text-orange-600 flex-shrink-0" />
                <span className="text-xs font-medium text-orange-600 whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            ) : (
              <button
                onClick={() => handleClick(item.href)}
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors duration-150 px-2 py-1 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200"
              >
                <item.icon size={item.iconSize} className="text-gray-500 flex-shrink-0" />
                <span className="text-xs whitespace-nowrap">{item.label}</span>
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}