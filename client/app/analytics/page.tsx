'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, TrendingUp, Users, Briefcase, Award, 
  Download, RefreshCw, Target, Brain,
  AlertTriangle, CheckCircle, Activity
} from 'lucide-react';
import { apiService } from '@/lib/api';
import {
  OverviewMetrics,
  ScoreDistribution,
  SkillsAnalytics,
  HiringTrends,
  JobPerformanceMetric,
  RecruiterInsights,
  AnalyticsExport
} from '@/lib/types';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistribution | null>(null);
  const [skillsAnalytics, setSkillsAnalytics] = useState<SkillsAnalytics | null>(null);
  const [hiringTrends, setHiringTrends] = useState<HiringTrends | null>(null);
  const [jobPerformance, setJobPerformance] = useState<JobPerformanceMetric[]>([]);
  const [insights, setInsights] = useState<RecruiterInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const [
        overviewData,
        scoresData,
        skillsData,
        trendsData,
        jobsData,
        insightsData
      ] = await Promise.allSettled([
        apiService.getOverviewMetrics(),
        apiService.getScoreDistribution(),
        apiService.getSkillsAnalytics(),
        apiService.getHiringTrends(),
        apiService.getJobPerformanceMetrics(),
        apiService.getRecruiterInsights()
      ]);

      if (overviewData.status === 'fulfilled') {
        setOverview(overviewData.value);
      } else {
        console.error('Failed to fetch overview:', overviewData.reason);
      }

      if (scoresData.status === 'fulfilled') {
        setScoreDistribution(scoresData.value);
      } else {
        console.error('Failed to fetch scores:', scoresData.reason);
      }

      if (skillsData.status === 'fulfilled') {
        setSkillsAnalytics(skillsData.value);
      } else {
        console.error('Failed to fetch skills:', skillsData.reason);
      }

      if (trendsData.status === 'fulfilled') {
        setHiringTrends(trendsData.value);
      } else {
        console.error('Failed to fetch trends:', trendsData.reason);
      }

      if (jobsData.status === 'fulfilled') {
        setJobPerformance(jobsData.value);
      } else {
        console.error('Failed to fetch jobs:', jobsData.reason);
      }

      if (insightsData.status === 'fulfilled') {
        setInsights(insightsData.value);
      } else {
        console.error('Failed to fetch insights:', insightsData.reason);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const exportConfig: AnalyticsExport = {
        format,
        sections: ['overview', 'score_distribution', 'skills', 'trends', 'job_performance', 'insights']
      };

      const data = await apiService.exportAnalyticsData(exportConfig);
      
      const blob = new Blob([data.content], { type: data.content_type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export data. Please try again.');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-600">Loading analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchAnalyticsData} disabled={refreshing}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
              <p className="text-gray-600">Comprehensive insights into your recruitment pipeline</p>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <Button
                onClick={() => fetchAnalyticsData()}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => exportData('csv')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportData('json')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'scores', label: 'Scores', icon: Award },
            { id: 'skills', label: 'Skills', icon: Target },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'jobs', label: 'Jobs', icon: Briefcase },
            { id: 'insights', label: 'Insights', icon: Brain }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Total Candidates
                    </CardTitle>
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {overview.total_candidates.toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Unique candidates processed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Active Jobs
                    </CardTitle>
                    <Briefcase className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {overview.total_active_jobs}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Currently hiring positions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Average ATS Score
                    </CardTitle>
                    <Award className="h-5 w-5 text-yellow-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {overview.average_ats_score}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Across all comparisons</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Success Rate
                    </CardTitle>
                    <Activity className="h-5 w-5 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {overview.success_rate}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">High-scoring candidates</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Last {overview.data_period_days} days summary</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Comparisons</span>
                    <span className="font-semibold">{overview.total_comparisons}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">High Scoring Candidates</span>
                    <Badge className={getScoreColor(80)}>
                      {overview.high_scoring_candidates}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Recent Activity Count</span>
                    <span className="font-semibold">{overview.recent_activity_count}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Current system status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Processing Engine</div>
                      <div className="text-sm text-gray-500">Operational</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Analytics Service</div>
                      <div className="text-sm text-gray-500">Healthy</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Data Storage</div>
                      <div className="text-sm text-gray-500">Available</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Score Distribution Tab */}
        {activeTab === 'scores' && scoreDistribution && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>
                    Distribution of candidates across ATS score ranges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {scoreDistribution.distribution.map((range) => (
                      <div key={range.range} className="flex items-center gap-4">
                        <div className="w-16 text-sm font-medium text-gray-600">
                          {range.range}%
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                                style={{ width: `${range.percentage}%` }}
                              />
                            </div>
                            <div className="w-24 text-sm text-gray-600">
                              {range.count} ({range.percentage}%)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score Statistics</CardTitle>
                  <CardDescription>Statistical summary</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average</span>
                    <span className="font-semibold">{scoreDistribution.average_score}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Median</span>
                    <span className="font-semibold">{scoreDistribution.median_score}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Candidates</span>
                    <span className="font-bold text-blue-600">
                      {scoreDistribution.total_candidates}
                    </span>
                  </div>
                  <hr className="my-3" />
                  <div className="text-sm font-medium text-gray-700 mb-2">Score Trends</div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Improving</span>
                    <Badge className="bg-green-100 text-green-700">
                      {scoreDistribution.score_trends.improving}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Declining</span>
                    <Badge className="bg-red-100 text-red-700">
                      {scoreDistribution.score_trends.declining}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Stable</span>
                    <Badge className="bg-gray-100 text-gray-700">
                      {scoreDistribution.score_trends.stable}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && skillsAnalytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {skillsAnalytics.total_unique_skills}
                  </div>
                  <div className="text-sm text-gray-600">Total Skills Tracked</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {skillsAnalytics.avg_skills_per_job}
                  </div>
                  <div className="text-sm text-gray-600">Avg Skills Per Job</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">
                    {skillsAnalytics.skill_gaps.length}
                  </div>
                  <div className="text-sm text-gray-600">Skill Gaps</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-purple-600">
                    {skillsAnalytics.avg_skills_per_candidate}
                  </div>
                  <div className="text-sm text-gray-600">Avg Skills Per Candidate</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Most Demanded Skills</CardTitle>
                  <CardDescription>Skills with highest demand across job postings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {skillsAnalytics.top_demanded_skills.slice(0, 8).map((skill, index) => (
                      <div key={skill.skill} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{skill.skill}</div>
                            <div className="text-sm text-gray-500">{skill.jobs_count} jobs</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            {skill.demand.toFixed(1)}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            {skill.candidates_count} candidates
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Emerging Skills</CardTitle>
                  <CardDescription>Skills showing rapid growth in demand</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {skillsAnalytics.emerging_skills.slice(0, 8).map((skill, index) => (
                      <div key={skill.skill} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{skill.skill}</div>
                            <div className="text-sm text-gray-500">{skill.recent_mentions} mentions</div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          +{skill.growth_rate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {skillsAnalytics.skill_gaps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Critical Skill Gaps
                  </CardTitle>
                  <CardDescription>Skills in high demand but low candidate availability</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {skillsAnalytics.skill_gaps.slice(0, 6).map((gap) => (
                      <div key={gap.skill} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="font-medium text-yellow-900">{gap.skill}</div>
                        <div className="text-sm text-yellow-700 mt-1">
                          Gap: {gap.gap_percentage}%
                        </div>
                        <Badge 
                          className={`mt-2 ${getPriorityColor(gap.priority)}`}
                        >
                          {gap.priority} priority
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && hiringTrends && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {hiringTrends.overall_growth.comparisons_growth > 0 ? '+' : ''}{hiringTrends.overall_growth.comparisons_growth}%
                  </div>
                  <div className="text-sm text-gray-600">Comparisons Growth</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {hiringTrends.overall_growth.jobs_growth > 0 ? '+' : ''}{hiringTrends.overall_growth.jobs_growth}%
                  </div>
                  <div className="text-sm text-gray-600">Jobs Growth</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">
                    {hiringTrends.overall_growth.score_improvement > 0 ? '+' : ''}{hiringTrends.overall_growth.score_improvement}%
                  </div>
                  <div className="text-sm text-gray-600">Score Improvement</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-purple-600">
                    {hiringTrends.seasonal_patterns.average_monthly_activity}
                  </div>
                  <div className="text-sm text-gray-600">Monthly Avg Activity</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Hiring Trends</CardTitle>
                <CardDescription>Activity trends over the past months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {hiringTrends.monthly_trends.slice(-6).map((trend) => (
                    <div key={trend.month} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-lg text-gray-900">
                          {trend.month_name} {trend.year}
                        </div>
                        <div className="text-sm text-gray-500">
                          Growth: {trend.growth_rate > 0 ? '+' : ''}{trend.growth_rate}%
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{trend.comparisons}</div>
                          <div className="text-sm text-gray-600">Comparisons</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{trend.jobs_created}</div>
                          <div className="text-sm text-gray-600">Jobs Created</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">{trend.avg_score}%</div>
                          <div className="text-sm text-gray-600">Avg Score</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{trend.high_scoring_count}</div>
                          <div className="text-sm text-gray-600">High Performers</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {hiringTrends.predictions && (
              <Card>
                <CardHeader>
                  <CardTitle>Predictions</CardTitle>
                  <CardDescription>
                    Forecast for next month (Confidence: {hiringTrends.predictions.confidence_level}%)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">
                        {hiringTrends.predictions.next_month_comparisons}
                      </div>
                      <div className="text-sm text-gray-600">Predicted Jobs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Jobs Performance Tab */}
        {activeTab === 'jobs' && jobPerformance.length > 0 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Performance Metrics</CardTitle>
                <CardDescription>Performance analysis for all job postings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-gray-600">Job Title</th>
                        <th className="text-left p-3 font-medium text-gray-600">Company</th>
                        <th className="text-center p-3 font-medium text-gray-600">Applications</th>
                        <th className="text-center p-3 font-medium text-gray-600">Avg Score</th>
                        <th className="text-center p-3 font-medium text-gray-600">High Scorers</th>
                        <th className="text-center p-3 font-medium text-gray-600">Top Score</th>
                        <th className="text-center p-3 font-medium text-gray-600">Rate</th>
                        <th className="text-center p-3 font-medium text-gray-600">Difficulty</th>
                        <th className="text-center p-3 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobPerformance.slice(0, 10).map((job) => (
                        <tr key={job.job_id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium text-gray-900">{job.job_title}</div>
                          </td>
                          <td className="p-3 text-gray-600">{job.company}</td>
                          <td className="p-3 text-center">{job.total_applications}</td>
                          <td className="p-3 text-center">
                            <Badge className={getScoreColor(job.avg_score)}>
                              {job.avg_score}%
                            </Badge>
                          </td>
                          <td className="p-3 text-center">{job.high_scoring_candidates}</td>
                          <td className="p-3 text-center">
                            <Badge className={getScoreColor(job.top_score)}>
                              {job.top_score}%
                            </Badge>
                          </td>
                          <td className="p-3 text-center">{job.application_rate}%</td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant="outline"
                              className={
                                job.difficulty_level === 'very_challenging' ? 'border-red-300 text-red-700' :
                                job.difficulty_level === 'challenging' ? 'border-yellow-300 text-yellow-700' :
                                job.difficulty_level === 'moderate' ? 'border-blue-300 text-blue-700' :
                                'border-green-300 text-green-700'
                              }
                            >
                              {job.difficulty_level.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant={job.status === 'active' ? 'default' : 'secondary'}
                              className={job.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                            >
                              {job.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && insights && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                  <CardDescription>Critical observations and opportunities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.key_insights.map((insight, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${
                        insight.category === 'opportunity' ? 'bg-green-50 border-green-200' :
                        insight.category === 'concern' ? 'bg-red-50 border-red-200' :
                        insight.category === 'trend' ? 'bg-blue-50 border-blue-200' :
                        'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">{insight.title}</div>
                        <Badge className={getPriorityColor(insight.priority)}>
                          {insight.priority}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-700 mb-3">{insight.description}</div>
                      {insight.action_items.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-600 mb-1">Action Items:</div>
                          {insight.action_items.map((action, actionIndex) => (
                            <div key={actionIndex} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-300">
                              {action}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>Strategic recommendations for improvement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.recommendations.map((rec, index) => (
                    <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-blue-900">{rec.title}</div>
                        <div className="flex gap-2">
                          <Badge className={rec.impact === 'high' ? 'bg-green-100 text-green-700' : 
                                          rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                                          'bg-gray-100 text-gray-700'}>
                            {rec.impact} impact
                          </Badge>
                          <Badge className={rec.effort === 'low' ? 'bg-green-100 text-green-700' : 
                                          rec.effort === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                                          'bg-red-100 text-red-700'}>
                            {rec.effort} effort
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-blue-700">{rec.description}</div>
                      <div className="text-xs text-blue-600 mt-2 font-medium">
                        Category: {rec.category}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Market Insights</CardTitle>
                <CardDescription>Current market analysis and trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2">Competitive Analysis</div>
                    <div className="text-sm text-gray-700">
                      {insights.market_insights.competitive_analysis}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2">Salary Benchmarks</div>
                    <div className="text-sm text-gray-700">
                      {insights.market_insights.salary_benchmarks}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2">Skill Market Trends</div>
                    <div className="text-sm text-gray-700">
                      {insights.market_insights.skill_market_trends}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {insights.challenging_positions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Positions Requiring Attention
                  </CardTitle>
                  <CardDescription>Jobs with performance challenges</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.challenging_positions.map((pos, index) => (
                      <div key={index} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium text-yellow-900">{pos.job_title}</div>
                            <div className="text-sm text-yellow-700">{pos.challenge_reasons.join(', ')}</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="text-xs font-medium text-yellow-800 mb-2">Suggested Improvements:</div>
                          <div className="space-y-1">
                            {pos.suggested_improvements.map((improvement, impIndex) => (
                              <div key={impIndex} className="text-xs text-yellow-700 pl-2 border-l-2 border-yellow-300">
                                {improvement}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* No Data State */}
        {activeTab !== 'overview' && (
          (activeTab === 'scores' && !scoreDistribution) ||
          (activeTab === 'skills' && !skillsAnalytics) ||
          (activeTab === 'trends' && !hiringTrends) ||
          (activeTab === 'jobs' && jobPerformance.length === 0) ||
          (activeTab === 'insights' && !insights)
        ) && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <BarChart3 className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-600 mb-4">
                There&apos;s no data available for this section yet. Start by uploading resumes and creating job postings.
              </p>
              <Button onClick={fetchAnalyticsData} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}