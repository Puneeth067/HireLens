'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, FileText, Zap } from 'lucide-react';
import FileUpload from '@/components/ui/file-upload';
import { UploadedFile } from '@/lib/types';

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingMode, setProcessingMode] = useState<'single' | 'bulk'>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleFilesSelected = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    // Auto-switch to bulk mode if multiple files
    if (files.length > 1) {
      setProcessingMode('bulk');
    }
  };

  const handleProcessResumes = async () => {
    if (uploadedFiles.length === 0) return;

    setIsProcessing(true);
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      // Navigate to results or comparison page
      if (processingMode === 'bulk') {
        router.push('/dashboard?tab=resumes');
      } else {
        router.push('/compare');
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upload Resume Files
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload candidate resumes to extract insights, analyze skills, and compare against job requirements
          </p>
        </div>

        {/* Processing Mode Selection */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Mode</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setProcessingMode('single')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  processingMode === 'single'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Single Resume</div>
                    <div className="text-sm text-gray-500">Process one resume at a time</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setProcessingMode('bulk')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  processingMode === 'bulk'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Bulk Processing</div>
                    <div className="text-sm text-gray-500">Process multiple resumes</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h2>
          <FileUpload
            onFilesSelected={handleFilesSelected}
            maxFiles={processingMode === 'single' ? 1 : 20}
            multiple={processingMode === 'bulk'}
          />
        </div>

        {/* Processing Options */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Options</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="font-medium text-gray-900">Extract Skills & Experience</div>
                    <div className="text-sm text-gray-500">Parse technical skills, work experience, and education</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 rounded"
                  aria-label="Extract Skills & Experience"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="font-medium text-gray-900">Generate Summary</div>
                    <div className="text-sm text-gray-500">Create AI-powered candidate summaries</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 rounded"
                  aria-label="Generate Summary"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="font-medium text-gray-900">Calculate ATS Scores</div>
                    <div className="text-sm text-gray-500">Score resumes against job descriptions</div>
                  </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 rounded"
                  aria-label="Calculate ATS Scores"
                />
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          
          <button
            onClick={handleProcessResumes}
            disabled={uploadedFiles.length === 0 || isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Process Resumes</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="text-blue-800 font-medium mb-2">Processing {uploadedFiles.length} resume(s)...</div>
            <div className="text-blue-600 text-sm">Extracting text, analyzing content, and generating insights</div>
            <div className="mt-4 bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full w-2/3 animate-pulse"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}