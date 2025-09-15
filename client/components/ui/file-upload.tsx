import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadedFile } from '@/lib/types';
import { Button } from "@/components/ui/button"


interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  multiple?: boolean;
  className?: string;
}

export default function FileUpload({
  onFilesSelected,
  maxFiles = 10,
  acceptedTypes = ['.pdf', '.docx'],
  multiple = true,
  className = ''
}: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of acceptedFiles) {
      if (uploadedFiles.length + newFiles.length >= maxFiles) {
        break;
      }

      // Validate file type
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(extension)) {
        continue;
      }

      const uploadedFile: UploadedFile = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date(),
        status: 'uploading',
        file: file
      };

      newFiles.push(uploadedFile);
    }

    // Simulate upload process
    const updatedFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(updatedFiles);

    // Update status to success after brief delay
    setTimeout(() => {
      const successFiles = updatedFiles.map(f => 
        newFiles.find(nf => nf.id === f.id) 
          ? { ...f, status: 'success' as const }
          : f
      );
      setUploadedFiles(successFiles);
      onFilesSelected(successFiles);
      setIsUploading(false);
    }, 1500);

  }, [uploadedFiles, maxFiles, acceptedTypes, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple,
    maxFiles
  });

  const removeFile = (fileId: number) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: 'uploading' | 'success' | 'error') => {
    switch (status) {
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`upload-zone ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="text-lg font-medium text-gray-900 mb-2">
            {isDragActive ? 'Drop files here' : 'Upload Resume Files'}
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Drag and drop or click to select files
          </div>
          <div className="text-xs text-gray-400">
            Supports PDF and DOCX files • Max {maxFiles} files • Up to 10MB each
          </div>
        </div>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            Uploaded Files ({uploadedFiles.length}/{maxFiles})
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3">
                  <File className="w-5 h-5 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.uploadedAt.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(file.status)}
                  <Button
                    onClick={() => removeFile(file.id)}
                    variant="ghost"
                    size="icon"
                    disabled={file.status === "uploading"}
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}