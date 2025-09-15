'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Brain, CheckCircle2, XCircle, Clock, Eye, Trash2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiService } from '@/lib/api';
import { ParsedResume, FileMetadata, ProcessingStats, Skill, } from '@/lib/types';

export default function ProcessingPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [selectedResume, setSelectedResume] = useState<ParsedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadFiles();
    loadStats();
    
    // Set up polling for processing files
    const interval = setInterval(() => {
      if (processingFiles.size > 0) {
        loadFiles();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [processingFiles]);

  const loadFiles = async () => {
    try {
      const response = await apiService.getFiles();
      setFiles(response.files);
      
      // Update processing files set
      const processing = new Set(
        response.files
          .filter(f => f.status === 'processing')
          .map(f => f.file_id)
      );
      setProcessingFiles(processing);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await apiService.getParsingStats();
      setStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const parseFile = async (fileId: string) => {
    try {
      setProcessingFiles(prev => new Set([...prev, fileId]));
      await apiService.parseResume(fileId);
      await loadFiles();
      await loadStats();
    } catch (error) {
      console.error('Error parsing file:', error);
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const viewParsedResume = async (fileId: string) => {
    try {
      const resume = await apiService.getParsedResume(fileId);
      setSelectedResume(resume);
    } catch (error) {
      console.error('Error loading parsed resume:', error);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      await apiService.deleteFile(fileId);
      await loadFiles();
      await loadStats();
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'processing': return <Clock className="w-4 h-4 animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p>Loading files...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Resume Processing</h1>
        <p className="text-gray-600">Manage and view your parsed resume files</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.total_files}</p>
                      <p className="text-sm text-gray-600">Total Files</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.completed}</p>
                      <p className="text-sm text-gray-600">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.processing}</p>
                      <p className="text-sm text-gray-600">Processing</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.error}</p>
                      <p className="text-sm text-gray-600">Errors</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Files */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Files</CardTitle>
              <CardDescription>Latest uploaded and processed files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {files.slice(0, 5).map((file) => (
                  <div key={file.file_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{file.original_filename}</p>
                        <p className="text-sm text-gray-600">{formatFileSize(file.file_size)}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(file.status)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(file.status)}
                        <span className="capitalize">{file.status}</span>
                      </div>
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Files</CardTitle>
              <CardDescription>Manage all uploaded resume files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.file_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <FileText className="w-6 h-6 text-gray-500" />
                      <div>
                        <h3 className="font-medium">{file.original_filename}</h3>
                        <p className="text-sm text-gray-600">
                          {formatFileSize(file.file_size)} • Uploaded {formatDate(file.uploaded_at)}
                        </p>
                        {file.error_message && (
                          <p className="text-sm text-red-600 mt-1">{file.error_message}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge className={getStatusColor(file.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(file.status)}
                          <span className="capitalize">{file.status}</span>
                        </div>
                      </Badge>
                      
                      <div className="flex space-x-2">
                        {file.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => parseFile(file.file_id)}
                            disabled={processingFiles.has(file.file_id)}
                          >
                            <Brain className="w-4 h-4 mr-2" />
                            Parse
                          </Button>
                        )}
                        
                        {file.status === 'completed' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => viewParsedResume(file.file_id)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>Parsed Resume: {file.original_filename}</DialogTitle>
                                <DialogDescription>
                                  Extracted information from the resume
                                </DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="h-[60vh]">
                                {selectedResume && (
                                  <ResumeViewer resume={selectedResume} />
                                )}
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteFile(file.file_id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {files.length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No files uploaded yet</p>
                    <Button className="mt-4" onClick={() => window.location.href = '/upload'}>
                      Upload Resume
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest processing activity and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recent_activity.map((activity, index) => (
                  <div key={`${activity.file_id}-${index}`} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    {getStatusIcon(activity.status)}
                    <div className="flex-1">
                      <p className="font-medium">{activity.filename}</p>
                      <p className="text-sm text-gray-600">
                        {activity.status === 'completed' ? 'Successfully parsed' : 
                         activity.status === 'error' ? 'Failed to parse' : 
                         'Processing...'}
                      </p>
                    </div>
                    {activity.parsed_at && (
                      <p className="text-sm text-gray-500">
                        {new Date(activity.parsed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
                
                {(!stats || stats.recent_activity.length === 0) && (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Resume Viewer Component
function ResumeViewer({ resume }: { resume: ParsedResume }) {
  return (
    <div className="space-y-6">
      {/* Contact Info */}
      {resume.contact_info && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resume.contact_info.name && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p>{resume.contact_info.name}</p>
                </div>
              )}
              {resume.contact_info.email && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p>{resume.contact_info.email}</p>
                </div>
              )}
              {resume.contact_info.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p>{resume.contact_info.phone}</p>
                </div>
              )}
              {resume.contact_info.linkedin && (
                <div>
                  <label className="text-sm font-medium text-gray-600">LinkedIn</label>
                  <a href={resume.contact_info.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {resume.contact_info.linkedin}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Skills</h3>
          <div className="space-y-3">
            {Object.entries(
              resume.skills.reduce((acc: Record<string, Skill[]>, skill: Skill) => {
                const category = skill.category || 'other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(skill);
                return acc;
              }, {})
            ).map(([category, skills]) => (
              <div key={category} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 capitalize mb-2">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: Skill, index: number) => (
                    <Badge key={`${skill.name}-${index}`} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {resume.experience && resume.experience.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Experience</h3>
          <div className="space-y-4">
            {resume.experience.map((exp, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{exp.job_title}</h4>
                    <p className="text-gray-600">{exp.company}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {exp.start_date} - {exp.end_date || 'Present'}
                  </div>
                </div>
                {exp.description && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{exp.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Education</h3>
          <div className="space-y-4">
            {resume.education.map((edu, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium">{edu.degree}</h4>
                {edu.field_of_study && (
                  <p className="text-gray-600">{edu.field_of_study}</p>
                )}
                {edu.institution && (
                  <p className="text-gray-600">{edu.institution}</p>
                )}
                {edu.graduation_year && (
                  <p className="text-sm text-gray-500">{edu.graduation_year}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}