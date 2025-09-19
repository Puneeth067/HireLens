'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Download, User, Briefcase, GraduationCap, 
  Target, CheckCircle, XCircle, AlertCircle, TrendingUp,
  FileText, Building,
  Award, Star, BarChart3
} from 'lucide-react';
import { ResumeJobComparison, Job, ParsedResume } from '@/lib/types';
import { apiService } from '@/lib/api';

export default function ComparisonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [comparison, setComparison] = useState<ResumeJobComparison | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (params.id) {
      loadComparison(params.id as string);
    }
  }, [params.id]);

  const loadComparison = async (id: string) => {
    try {
      setLoading(true);
      const comparisonData = await apiService.getComparison(id);
      setComparison(comparisonData);

      // Load associated job and resume data
      const [jobData, resumeData] = await Promise.all([
        apiService.getJob(comparisonData.job_id),
        apiService.getParsedResume(comparisonData.resume_id)
      ]);
      
      setJob(jobData);
      setResume(resumeData);
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportComparison = async () => {
    if (!comparison) return;
    try {
      const blob = await apiService.exportComparisons({ 
        search: comparison.id,
        status: 'completed'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparison-${comparison.id}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting comparison:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (score >= 60) return <Star className="h-5 w-5 text-blue-600" />;
    if (score >= 40) return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!comparison || !job || !resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Comparison not found</h2>
          <p className="text-gray-600 mb-4">The comparison you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => router.push('/comparisons')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Comparisons
          </button>
        </div>
      </div>
    );
  }

  const atsScore = comparison.ats_score;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/comparisons')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              title='Back to Comparisons'
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Comparison Details</h1>
              <p className="text-gray-600 mt-1">
                {comparison.candidate_name || comparison.resume_filename} vs {comparison.job_title}
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportComparison}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Status Banner */}
        {comparison.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Processing Failed</h3>
                <p className="text-sm text-red-700 mt-1">{comparison.error_message}</p>
              </div>
            </div>
          </div>
        )}

        {comparison.status === 'processing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-blue-400 animate-pulse" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Processing in Progress</h3>
                <p className="text-sm text-blue-700 mt-1">This comparison is being processed. Please check back shortly.</p>
              </div>
            </div>
          </div>
        )}

        {/* Overall Score Card */}
        {atsScore && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">ATS Compatibility Score</h2>
                <p className="text-gray-600">Overall matching score based on job requirements</p>
              </div>
              <div className={`text-right p-4 rounded-lg border-2 ${getScoreColor(atsScore.overall_score)}`}>
                <div className="flex items-center justify-center mb-2">
                  {getScoreIcon(atsScore.overall_score)}
                </div>
                <div className="text-3xl font-bold">{atsScore.overall_score.toFixed(1)}%</div>
                <div className="text-sm opacity-75">Overall Score</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'skills', label: 'Skills Analysis', icon: Target },
                { id: 'experience', label: 'Experience', icon: Briefcase },
                { id: 'education', label: 'Education', icon: GraduationCap },
                { id: 'recommendations', label: 'Recommendations', icon: TrendingUp }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && atsScore && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Skills Match', score: atsScore.skills_score, icon: Target },
                    { label: 'Experience', score: atsScore.experience_score, icon: Briefcase },
                    { label: 'Education', score: atsScore.education_score, icon: GraduationCap },
                    { label: 'Keywords', score: atsScore.keywords_score, icon: FileText }
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className={`p-4 rounded-lg border ${getScoreColor(item.score)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Icon className="h-5 w-5" />
                          <span className="text-lg font-bold">{item.score.toFixed(1)}%</span>
                        </div>
                        <p className="text-sm font-medium">{item.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Job Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Building className="h-4 w-4 mr-2" />
                      Job Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Title:</span> {job.title}</div>
                      <div><span className="font-medium">Company:</span> {job.company}</div>
                      <div><span className="font-medium">Location:</span> {job.location}</div>
                      <div><span className="font-medium">Type:</span> {job.job_type}</div>
                      <div><span className="font-medium">Experience:</span> {job.experience_level}</div>
                      {job.salary_max && (
                        <div><span className="font-medium">Salary:</span> {job.salary_max}</div>
                      )}
                    </div>
                  </div>

                  {/* Resume Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Candidate Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Name:</span> {resume.contact_info?.name || 'Not provided'}</div>
                      {resume.contact_info?.email && (
                        <div><span className="font-medium">Email:</span> {resume.contact_info.email}</div>
                      )}
                      {resume.contact_info?.phone && (
                        <div><span className="font-medium">Phone:</span> {resume.contact_info.phone}</div>
                      )}
                      {resume.contact_info?.location && (
                        <div><span className="font-medium">Location:</span> {resume.contact_info.location}</div>
                      )}
                      <div><span className="font-medium">Total Skills:</span> {resume.skills?.length || 0}</div>
                      <div><span className="font-medium">Work Experience:</span> {resume.work_experience?.length || 0} positions</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Skills Analysis Tab */}
            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Required Skills Match */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Required Skills Analysis</h3>
                    {job.required_skills && job.required_skills.length > 0 ? (
                      <div className="space-y-3">
                        {job.required_skills.map((skill, index) => {
                          const hasSkill = resume.skills?.some(rs => 
                            rs.toLowerCase().includes(skill.toLowerCase()) ||
                            skill.toLowerCase().includes(rs.toLowerCase())
                          );
                          return (
                            <div key={index} className="flex items-center justify-between p-2 bg-white rounded">
                              <span className="text-sm">{skill}</span>
                              {hasSkill ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No required skills specified</p>
                    )}
                  </div>

                  {/* Preferred Skills Match */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Preferred Skills Analysis</h3>
                    {job.preferred_skills && job.preferred_skills.length > 0 ? (
                      <div className="space-y-3">
                        {job.preferred_skills.map((skill, index) => {
                          const hasSkill = resume.skills?.some(rs => 
                            rs.toLowerCase().includes(skill.toLowerCase()) ||
                            skill.toLowerCase().includes(rs.toLowerCase())
                          );
                          return (
                            <div key={index} className="flex items-center justify-between p-2 bg-white rounded">
                              <span className="text-sm">{skill}</span>
                              {hasSkill ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No preferred skills specified</p>
                    )}
                  </div>
                </div>

                {/* All Resume Skills */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">All Candidate Skills</h3>
                  {resume.skills && resume.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {resume.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No skills extracted from resume</p>
                  )}
                </div>
              </div>
            )}

            {/* Experience Tab */}
            {activeTab === 'experience' && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Required Experience Level</h3>
                  <p className="text-sm text-gray-600">{job.experience_level}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Work Experience</h3>
                  {resume.work_experience && resume.work_experience.length > 0 ? (
                    <div className="space-y-4">
                      {resume.work_experience.map((exp, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium text-gray-900">{exp.job_title}</h4>
                              <p className="text-sm text-gray-600">{exp.company}</p>
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              {exp.start_date} - {exp.end_date || 'Present'}
                            </div>
                          </div>
                          {exp.description && (
                            <p className="text-sm text-gray-700 mt-2">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No work experience found in resume</p>
                  )}
                </div>
              </div>
            )}

            {/* Education Tab */}
            {activeTab === 'education' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Educational Background</h3>
                  {resume.education && resume.education.length > 0 ? (
                    <div className="space-y-4">
                      {resume.education.map((edu, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">{edu.degree}</h4>
                              <p className="text-sm text-gray-600">{edu.field_of_study}</p>
                              <p className="text-sm text-gray-500">{edu.institution}</p>
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              {edu.graduation_year ? `${edu.graduation_year}` : ''}
                            </div>
                          </div>
                          {edu.gpa && (
                            <p className="text-sm text-gray-600 mt-2">GPA: {edu.gpa}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No education information found in resume</p>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === 'recommendations' && atsScore && (
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    AI-Generated Recommendations
                  </h3>
                  <p className="text-blue-800 text-sm mb-4">
                    Based on the ATS analysis, here are suggestions to improve this candidate&apos;s match score:
                  </p>
                  {atsScore.recommendations && atsScore.recommendations.length > 0 ? (
                    <div className="space-y-3">
                      {atsScore.recommendations.map((rec, index) => (
                        <div key={index} className="bg-white rounded p-3 text-sm">
                          <div className="flex items-start">
                            <Award className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                            <span>{rec}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-blue-700">No specific recommendations available at this time.</p>
                  )}
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Areas of Strength</h4>
                    <div className="space-y-2">
                      {[
                        { name: 'Skills', score: atsScore.skills_score },
                        { name: 'Experience', score: atsScore.experience_score },
                        { name: 'Education', score: atsScore.education_score },
                        { name: 'Keywords', score: atsScore.keywords_score }
                      ]
                        .filter(item => item.score >= 60)
                        .map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm">{item.name}</span>
                            <span className="text-green-600 font-medium">{item.score.toFixed(1)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Areas for Improvement</h4>
                    <div className="space-y-2">
                      {[
                        { name: 'Skills', score: atsScore.skills_score },
                        { name: 'Experience', score: atsScore.experience_score },
                        { name: 'Education', score: atsScore.education_score },
                        { name: 'Keywords', score: atsScore.keywords_score }
                      ]
                        .filter(item => item.score < 60)
                        .map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm">{item.name}</span>
                            <span className="text-red-600 font-medium">{item.score.toFixed(1)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Comparison Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created:</span>
              <p className="font-medium">{new Date(comparison.created_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Updated:</span>
              <p className="font-medium">{new Date(comparison.updated_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <p className={`font-medium ${
                comparison.status === 'completed' ? 'text-green-600' :
                comparison.status === 'processing' ? 'text-blue-600' : 'text-red-600'
              }`}>
                {comparison.status.charAt(0).toUpperCase() + comparison.status.slice(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}