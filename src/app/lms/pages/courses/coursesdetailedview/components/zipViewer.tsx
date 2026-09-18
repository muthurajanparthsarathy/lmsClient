// components/zipViewer.tsx
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Folder,
  FolderOpen,
  Download,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  Archive,
  AlertCircle,
  Presentation,
  Video,
  RefreshCw,
  Image,
  Code,
  File
} from 'lucide-react';
 
interface ZipFile {
  name: string;
  size: number;
  type: 'file' | 'folder';
  path: string;
  children?: ZipFile[];
  content?: string;
  blobUrl?: string;
}
 
// interface ZipViewerProps {
//   fileUrl: string | { base: string };
//   fileName: string;
//   onClose: () => void;
// }
 // In zipViewer.tsx, update the interface:
interface ZipViewerProps {
  fileUrl: string | { base: string };
  fileName: string;
  onClose: () => void;
  isOpen?: boolean; // Add this optional prop
}
export default function ZipViewer({ fileUrl, fileName, onClose, isOpen }: ZipViewerProps) {
    if (!isOpen) return null;

  const [files, setFiles] = useState<ZipFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFile, setCurrentFile] = useState<ZipFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileBlobUrl, setFileBlobUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
 
  // Helper function to get the actual URL string
  const getActualUrl = (url: string | { base: string }): string => {
    if (typeof url === 'string') {
      return url;
    } else if (url && typeof url === 'object' && url.base) {
      return url.base;
    }
    return '';
  };
 
  const actualFileUrl = getActualUrl(fileUrl);
 
  const addFolderToStructure = (structure: ZipFile[], path: string) => {
    const parts = path.split('/').filter(p => p && p !== '__MACOSX' && p !== '.DS_Store');
    if (parts.length === 0) return;
 
    let currentLevel = structure;
   
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
     
      let existingFolder = currentLevel.find(item =>
        item.type === 'folder' && item.name === part
      );
     
      if (!existingFolder) {
        existingFolder = {
          name: part,
          type: 'folder',
          path: parts.slice(0, i + 1).join('/'),
          size: 0,
          children: []
        };
        currentLevel.push(existingFolder);
      }
     
      if (existingFolder.children && !isLast) {
        currentLevel = existingFolder.children;
      }
    }
  };
 
  const addFileToStructure = (structure: ZipFile[], path: string, zipEntry: any) => {
    const parts = path.split('/').filter(p => p && p !== '__MACOSX' && p !== '.DS_Store');
    if (parts.length === 0) return;
 
    const fileName = parts.pop()!;
    let currentLevel = structure;
   
    // Navigate to the correct folder level
    for (const part of parts) {
      let folder = currentLevel.find(item =>
        item.type === 'folder' && item.name === part
      );
     
      if (!folder) {
        folder = {
          name: part,
          type: 'folder',
          path: parts.slice(0, parts.indexOf(part) + 1).join('/'),
          size: 0,
          children: []
        };
        currentLevel.push(folder);
      }
     
      if (folder.children) {
        currentLevel = folder.children;
      }
    }
   
    // Add the file
    const file: ZipFile = {
      name: fileName,
      type: 'file',
      path: path,
      size: zipEntry._data.uncompressedSize || 0
    };
   
    currentLevel.push(file);
  };
 
  // Enhanced extraction with retry logic
  const extractZipContents = async (url: string, retry = 0) => {
    try {
      setLoading(true);
      setError('');
 
      console.log('Fetching ZIP file from:', url);
      console.log('Retry attempt:', retry);
     
      // Add cache busting for retries
      const fetchUrl = retry > 0 ? `${url}?retry=${retry}&t=${Date.now()}` : url;
     
      const response = await fetch(fetchUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
     
      if (!response.ok) {
        if (response.status === 404 && retry < 3) {
          console.log(`File not found, retrying... (${retry + 1}/3)`);
          setRetryCount(retry + 1);
          setTimeout(() => extractZipContents(url, retry + 1), 1000 * (retry + 1));
          return;
        }
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
 
      const blob = await response.blob();
     
      if (blob.size === 0) {
        throw new Error('File is empty');
      }
 
      console.log('File size:', blob.size, 'bytes');
 
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
     
      console.log('Loading ZIP contents...');
      const zipContents = await zip.loadAsync(blob);
      console.log('ZIP contents loaded successfully');
 
      const fileStructure: ZipFile[] = [];
     
      let fileCount = 0;
      let folderCount = 0;
 
      // Process all files and folders
      zipContents.forEach((relativePath, zipEntry) => {
        // Skip macOS metadata files and hidden files
        if (relativePath.includes('__MACOSX/') ||
            relativePath.includes('.DS_Store') ||
            relativePath.startsWith('.')) {
          return;
        }
 
        if (zipEntry.dir) {
          // It's a directory
          addFolderToStructure(fileStructure, relativePath);
          folderCount++;
        } else {
          // It's a file
          addFileToStructure(fileStructure, relativePath, zipEntry);
          fileCount++;
        }
      });
 
      console.log(`Processed ${fileCount} files and ${folderCount} folders`);
     
      if (fileStructure.length === 0) {
        throw new Error('ZIP file appears to be empty or contains only system files');
      }
 
      setFiles(fileStructure);
      setRetryCount(0);
     
    } catch (err) {
      console.error('Error extracting ZIP:', err);
     
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          if (retry < 3) {
            console.log(`Retrying extraction... (${retry + 1}/3)`);
            setRetryCount(retry + 1);
            setTimeout(() => extractZipContents(url, retry + 1), 1000 * (retry + 1));
            return;
          }
          setError('Failed to download the file. The file may have been moved or deleted.');
        } else if (err.message.includes('empty')) {
          setError('The file appears to be empty.');
        } else {
          setError(`Failed to extract ZIP file: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred while processing the ZIP file.');
      }
     
      setRetryCount(retry);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    // Debug info
    console.log('ZIP Viewer Props:', {
      fileUrl,
      actualFileUrl,
      fileName,
      urlType: typeof fileUrl,
      urlLength: actualFileUrl?.length,
      urlValid: actualFileUrl?.startsWith('http') || actualFileUrl?.startsWith('/')
    });
 
    if (actualFileUrl) {
      extractZipContents(actualFileUrl);
    } else {
      setError('No valid file URL provided');
      setLoading(false);
    }
  }, [actualFileUrl]);
 
  // Add this function to verify URL accessibility
  const verifyUrlAccessibility = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };
 
  // Enhanced retry function
  const retryExtraction = async () => {
    setError('');
    setFiles([]);
    setCurrentFile(null);
   
    if (!actualFileUrl) {
      setError('No valid file URL provided');
      return;
    }
   
    // Verify URL is accessible first
    const isAccessible = await verifyUrlAccessibility(actualFileUrl);
    if (!isAccessible) {
      setError('File URL is not accessible. The file may have been moved or deleted from storage.');
      return;
    }
   
    await extractZipContents(actualFileUrl);
  };
 
  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };
 
  const handleFileClick = async (file: ZipFile) => {
    if (file.type === 'folder') {
      toggleFolder(file.path);
      return;
    }
 
    setCurrentFile(file);
    setPreviewLoading(true);
    setFileContent('');
    setFileBlobUrl('');
   
    try {
      // Clean up previous blob URL
      if (fileBlobUrl) {
        URL.revokeObjectURL(fileBlobUrl);
      }
 
      if (!actualFileUrl) {
        setFileContent('No valid file URL available');
        return;
      }
 
      // Fetch the ZIP file again to get the specific file content
      const response = await fetch(actualFileUrl);
      const blob = await response.blob();
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(blob);
      const fileEntry = zipContents.file(file.path);
     
      if (fileEntry) {
        const fileExtension = file.name.toLowerCase().split('.').pop();
       
        console.log('Processing file:', file.name, 'Extension:', fileExtension);
       
        // Handle different file types
        if (['pdf', 'ppt', 'pptx'].includes(fileExtension || '')) {
          // For PDF and PowerPoint files, create blob URL
          const fileBlob = await fileEntry.async('blob');
         
          // Set proper MIME type
          let mimeType = 'application/octet-stream';
          if (fileExtension === 'pdf') {
            mimeType = 'application/pdf';
          } else if (fileExtension === 'pptx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (fileExtension === 'ppt') {
            mimeType = 'application/vnd.ms-powerpoint';
          }
         
          console.log('Creating blob with MIME type:', mimeType);
          const properBlob = new Blob([fileBlob], { type: mimeType });
          const blobUrl = URL.createObjectURL(properBlob);
          console.log('Blob URL created:', blobUrl);
          setFileBlobUrl(blobUrl);
        }
        else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExtension || '')) {
          // For image files
          const fileBlob = await fileEntry.async('blob');
          const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
          const properBlob = new Blob([fileBlob], { type: mimeType });
          const blobUrl = URL.createObjectURL(properBlob);
          setFileBlobUrl(blobUrl);
        }
        else if (['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'].includes(fileExtension || '')) {
          // For video files
          const fileBlob = await fileEntry.async('blob');
          const mimeType = `video/${fileExtension}`;
          const properBlob = new Blob([fileBlob], { type: mimeType });
          const blobUrl = URL.createObjectURL(properBlob);
          setFileBlobUrl(blobUrl);
        }
        else if (['txt', 'json', 'xml', 'html', 'css', 'js', 'ts', 'md', 'csv', 'log'].includes(fileExtension || '')) {
          // For text files
          const text = await fileEntry.async('text');
          setFileContent(text);
        } else {
          // For files that can't be previewed
          setFileContent(`File: ${file.name}\nSize: ${formatFileSize(file.size)}\nType: ${fileExtension || 'Unknown'}\n\nThis file type cannot be previewed directly. Please download to view.`);
        }
      } else {
        setFileContent('File not found in archive');
      }
    } catch (err) {
      console.error('Error reading file:', err);
      setFileContent('Error loading file content');
    } finally {
      setPreviewLoading(false);
    }
  };
 
  const downloadFile = async (file: ZipFile) => {
    try {
      if (!actualFileUrl) {
        alert('No valid file URL available');
        return;
      }
 
      const response = await fetch(actualFileUrl);
      const blob = await response.blob();
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(blob);
      const fileEntry = zipContents.file(file.path);
     
      if (fileEntry) {
        const content = await fileEntry.async('blob');
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('File not found in archive');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Failed to download file');
    }
  };
 
  const downloadAll = async () => {
    try {
      if (!actualFileUrl) {
        alert('No valid file URL available');
        return;
      }
 
      const a = document.createElement('a');
      a.href = actualFileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading ZIP:', err);
      alert('Failed to download ZIP file');
    }
  };
 
  const getFileIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop();
   
    if (!extension) return <FileText size={16} className="text-gray-600" />;
   
    const pdfExtensions = ['pdf'];
    const pptExtensions = ['ppt', 'pptx'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'];
    const documentExtensions = ['doc', 'docx', 'xls', 'xlsx'];
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz'];
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'php', 'py', 'java', 'c', 'cpp'];
    const textExtensions = ['txt', 'md', 'log', 'csv'];
   
    if (pdfExtensions.includes(extension)) {
      return <FileText size={16} className="text-red-500" />;
    } else if (pptExtensions.includes(extension)) {
      return <Presentation size={16} className="text-orange-500" />;
    } else if (imageExtensions.includes(extension)) {
      return <Image size={16} className="text-green-500" />;
    } else if (videoExtensions.includes(extension)) {
      return <Video size={16} className="text-purple-500" />;
    } else if (documentExtensions.includes(extension)) {
      return <FileText size={16} className="text-blue-500" />;
    } else if (archiveExtensions.includes(extension)) {
      return <Archive size={16} className="text-yellow-500" />;
    } else if (codeExtensions.includes(extension)) {
      return <Code size={16} className="text-indigo-500" />;
    } else if (textExtensions.includes(extension)) {
      return <FileText size={16} className="text-gray-500" />;
    } else {
      return <File size={16} className="text-gray-400" />;
    }
  };
 
  const renderFileTree = (items: ZipFile[], level = 0) => {
    if (items.length === 0) {
      return (
        <div className="text-center text-gray-500 py-4">
          No files found
        </div>
      );
    }
 
    return items.map((item) => (
      <div key={item.path} style={{ marginLeft: `${level * 16}px` }}>
        <div
          className={`flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 ${
            currentFile?.path === item.path ? 'bg-blue-50 border border-blue-200' : ''
          }`}
          onClick={() => handleFileClick(item)}
        >
          <div className="flex items-center flex-1 gap-2 min-w-0">
            {item.type === 'folder' ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(item.path);
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  {expandedFolders.has(item.path) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {expandedFolders.has(item.path) ? (
                  <FolderOpen size={16} className="text-blue-500" />
                ) : (
                  <Folder size={16} className="text-blue-500" />
                )}
                <span className="text-sm truncate">{item.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  ({item.children?.length || 0})
                </span>
              </>
            ) : (
              <>
                <div className="w-5" />
                {getFileIcon(item.name)}
                <span className="text-sm truncate">{item.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatFileSize(item.size)}
                </span>
              </>
            )}
          </div>
         
          {item.type === 'file' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadFile(item);
              }}
              className="p-1 hover:bg-gray-200 rounded ml-2"
              title="Download file"
            >
              <Download size={14} />
            </button>
          )}
        </div>
       
        {item.type === 'folder' &&
         expandedFolders.has(item.path) &&
         item.children &&
         renderFileTree(item.children, level + 1)}
      </div>
    ));
  };
 
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
 
  const renderPreview = () => {
    if (!currentFile) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <FileText size={48} className="text-gray-400 mx-auto mb-4" />
            <p>Select a file from the sidebar to preview its contents</p>
          </div>
        </div>
      );
    }
 
    if (previewLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-600">Loading preview...</span>
        </div>
      );
    }
 
    const fileExtension = currentFile.name.toLowerCase().split('.').pop();
   
    // PDF Preview
    if (fileBlobUrl && fileExtension === 'pdf') {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">{currentFile.name}</h4>
            <button
              onClick={() => downloadFile(currentFile!)}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Download size={14} />
              Download
            </button>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden">
            <iframe
              src={`${fileBlobUrl}#toolbar=0`}
              className="w-full h-full"
              title={currentFile.name}
              style={{ border: 'none' }}
            />
          </div>
        </div>
      );
    }
 
    // PowerPoint Preview
    if (fileBlobUrl && ['ppt', 'pptx'].includes(fileExtension || '')) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">{currentFile.name}</h4>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Open in Google Docs viewer
                  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileBlobUrl)}&embedded=true`;
                  window.open(googleViewerUrl, '_blank');
                }}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Presentation size={14} />
                Open in Viewer
              </button>
              <button
                onClick={() => downloadFile(currentFile!)}
                className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden flex flex-col items-center justify-center bg-gray-100 p-8">
            <Presentation size={64} className="text-orange-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">PowerPoint File</h3>
            <p className="text-gray-600 text-center mb-4">
              {currentFile.name}
              <br />
              <span className="text-sm">Size: {formatFileSize(currentFile.size)}</span>
            </p>
            <p className="text-gray-500 text-sm text-center mb-6">
              PowerPoint files cannot be previewed directly in the browser.
              <br />
              Please download the file or use the "Open in Viewer" button to view it online.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileBlobUrl)}&embedded=true`;
                  window.open(googleViewerUrl, '_blank');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Presentation size={16} />
                Open in Google Viewer
              </button>
              <button
                onClick={() => downloadFile(currentFile!)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download size={16} />
                Download PPT
              </button>
            </div>
          </div>
        </div>
      );
    }
 
    // Image Preview
    if (fileBlobUrl && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExtension || '')) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">{currentFile.name}</h4>
            <button
              onClick={() => downloadFile(currentFile!)}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Download size={14} />
              Download
            </button>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden flex items-center justify-center bg-gray-100">
            <img
              src={fileBlobUrl}
              alt={currentFile.name}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                console.error('Error loading image:', e);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      );
    }
 
    // Video Preview
    if (fileBlobUrl && ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'].includes(fileExtension || '')) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">{currentFile.name}</h4>
            <button
              onClick={() => downloadFile(currentFile!)}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Download size={14} />
              Download
            </button>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden flex items-center justify-center bg-black">
            <video
              controls
              className="max-w-full max-h-full"
              onError={(e) => {
                console.error('Error loading video:', e);
              }}
            >
              <source src={fileBlobUrl} type={`video/${fileExtension}`} />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      );
    }
 
    // Text Content Preview
    if (fileContent) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">{currentFile.name}</h4>
            <button
              onClick={() => downloadFile(currentFile!)}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Download size={14} />
              Download
            </button>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden">
            <pre className="text-sm whitespace-pre-wrap break-words p-4 h-full overflow-auto bg-gray-50">
              {fileContent}
            </pre>
          </div>
        </div>
      );
    }
 
    // Default preview for unsupported files
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8">
        <FileText size={64} className="text-gray-400 mb-4" />
        <p className="text-lg font-medium mb-2">Preview not available</p>
        <p className="text-sm mb-6 text-center max-w-md">
          This file type cannot be previewed directly in the browser.
          <br />
          Please download the file to view its contents.
        </p>
        <button
          onClick={() => downloadFile(currentFile!)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download size={16} />
          Download File
        </button>
      </div>
    );
  };
 
  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (fileBlobUrl) {
        URL.revokeObjectURL(fileBlobUrl);
      }
    };
  }, [fileBlobUrl]);
 
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Archive className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{fileName}</h2>
              <p className="text-sm text-gray-500">ZIP Archive Contents</p>
            </div>
          </div>
         
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={16} />
              Download All
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
 
        {/* Content */}
        {error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading ZIP File</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={retryExtraction}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <RefreshCw size={16} />
                  Try Again {retryCount > 0 && `(${retryCount})`}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
              {actualFileUrl && (
                <div className="mt-4 p-3 bg-gray-100 rounded text-left">
                  <p className="text-xs text-gray-600 break-all">
                    <strong>File URL:</strong><br />
                    {actualFileUrl}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* File Tree Sidebar */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Files</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {loading ? 'Loading...' : `${files.length} items`}
                </p>
              </div>
             
              <div className="flex-1 overflow-auto p-2">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="ml-2 text-gray-600">Extracting ZIP contents...</span>
                  </div>
                ) : (
                  renderFileTree(files)
                )}
              </div>
            </div>
 
            {/* File Preview */}
            <div className="flex-1 flex flex-col p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">
                  {currentFile ? `Preview: ${currentFile.name}` : 'File Preview'}
                </h3>
                {currentFile && (
                  <p className="text-sm text-gray-500 mt-1">
                    Size: {formatFileSize(currentFile.size)} •
                    Type: {currentFile.name.split('.').pop()?.toUpperCase() || 'Unknown'}
                  </p>
                )}
              </div>
             
              <div className="flex-1 overflow-auto">
                {renderPreview()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}