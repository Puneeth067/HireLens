import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadedFile } from '@/lib/types';
import { Button } from "@/components/ui/button"
import { apiService } from '@/lib/api';


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
        id: (Date.now() + Math.random()).toString(),
        name: file.name,
        size: file.size,
        file: file,
        uploadedAt: new Date(),
        status: 'uploading',
        progress: 0
      };

      newFiles.push(uploadedFile);
    }

    // Add files to state immediately
    const updatedFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(updatedFiles);

    // Actually upload files to the API
    try {
      if (multiple && newFiles.length > 1) {
        // Bulk upload
        const result = await apiService.uploadBulkFiles(newFiles.map(f => f.file));
        
        // Update files with real IDs and success status
        const successFiles = updatedFiles.map(f => {
          const newFileIndex = newFiles.findIndex(nf => nf.id === f.id);
          if (newFileIndex !== -1 && result.uploaded_files[newFileIndex]) {
            return {
              ...f,
              id: result.uploaded_files[newFileIndex].file_id,
              status: 'completed' as const,
              progress: 100
            };
          }
          return f;
        });
        
        setUploadedFiles(successFiles);
        onFilesSelected(successFiles);
      } else {
        // Single file uploads
        const successFiles = [...updatedFiles];
        
        for (let i = 0; i < newFiles.length; i++) {
          try {
            const result = await apiService.uploadSingleFile(newFiles[i].file);
            const fileIndex = successFiles.findIndex(f => f.id === newFiles[i].id);
            if (fileIndex !== -1) {
              successFiles[fileIndex] = {
                ...successFiles[fileIndex],
                id: result.file_id,
                status: 'completed',
                progress: 100
              };
            }
          } catch (error) {
            const fileIndex = successFiles.findIndex(f => f.id === newFiles[i].id);
            if (fileIndex !== -1) {
              successFiles[fileIndex] = {
                ...successFiles[fileIndex],
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed'
              };
            }
          }
        }
        
        setUploadedFiles(successFiles);
        onFilesSelected(successFiles);
      }
    } catch (error) {
      // Handle bulk upload error
      const errorFiles = updatedFiles.map(f => 
        newFiles.find(nf => nf.id === f.id) 
          ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      );
      setUploadedFiles(errorFiles);
      onFilesSelected(errorFiles);
    }

    setIsUploading(false);
  }, [uploadedFiles, maxFiles, acceptedTypes, onFilesSelected, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple,
    maxFiles
  });

  const removeFile = (fileId: string) => {
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

  const getStatusIcon = (status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error') => {
    switch (status) {
      case 'pending':
      case 'uploading':
      case 'processing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed':
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
                      {formatFileSize(file.size || 0)} • {file.uploadedAt?.toLocaleTimeString() || 'Just now'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(file.status)}
                  <Button
                    onClick={() => removeFile(file.id)}
                    variant="ghost"
                    size="icon"
                    disabled={file.status === "uploading" || file.status === "processing"}
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