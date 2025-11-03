
import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  accept: string;
  label: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, accept, label }) => {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setFileName(files[0].name);
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        setFileName(files[0].name);
        onFileUpload(files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
        dragging ? 'border-purple-400 bg-gray-700' : 'border-gray-600 bg-gray-800'
      }`}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept={accept}
        onChange={handleChange}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <p className="text-gray-400">{label}</p>
        {fileName && <p className="text-purple-400 mt-2">{fileName}</p>}
      </label>
    </div>
  );
};

export default FileUpload;
