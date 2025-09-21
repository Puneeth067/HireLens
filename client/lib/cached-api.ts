// lib/cached-api.ts - Cached API service wrapper for improved performance

import { 
  apiCache, 
  jobsCache, 
  comparisonsCache, 
  systemCache, 
  CacheKeys, 
  CacheInvalidation 
} from './cache';
import {
  AnalyticsDashboard,
  OverviewMetrics,
  Job,
  JobDescriptionList,
  ResumeJobComparison,
  SystemHealth,
  SystemInfo,
  JobStats,
  CreateJobRequest,
  UpdateJobRequest,
  SkillsAnalytics,
  HiringTrends,
  ScoreDistribution,
  JobPerformanceMetric,
  RecruiterInsights,
  AnalyticsExport,
  RankedCandidate,
  RankingCriteria,
  RankingStatisticsResponse,
  RankingListResponse,
} from './types';

// Import the original API service
import apiService from './api';

class CachedApiService {
  private originalApi = apiService;
  
  // Override analytics methods with caching
  async getAnalyticsDashboard(days: number = 30): Promise<AnalyticsDashboard> {
    const cacheKey = CacheKeys.ANALYTICS_DASHBOARD(days);
    const cached = apiCache.get<AnalyticsDashboard>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getAnalyticsDashboard(days);
    apiCache.set(cacheKey, data);
    return data;
  }

  async getOverviewMetrics(days: number = 30): Promise<OverviewMetrics> {
    const cacheKey = CacheKeys.ANALYTICS_OVERVIEW(days);
    const cached = apiCache.get<OverviewMetrics>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getOverviewMetrics(days);
    apiCache.set(cacheKey, data);
    return data;
  }

  async getSkillsAnalytics(): Promise<SkillsAnalytics> {
    const cacheKey = CacheKeys.SKILLS_ANALYSIS();
    const cached = apiCache.get<SkillsAnalytics>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getSkillsAnalytics();
    apiCache.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes TTL
    return data;
  }

  async getHiringTrends(months: number = 12): Promise<HiringTrends> {
    const cacheKey = CacheKeys.HIRING_TRENDS(months);
    const cached = apiCache.get<HiringTrends>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getHiringTrends(months);
    apiCache.set(cacheKey, data, 15 * 60 * 1000); // 15 minutes TTL
    return data;
  }

  async getScoreDistribution(): Promise<ScoreDistribution> {
    const cacheKey = CacheKeys.SCORE_DISTRIBUTION();
    const cached = apiCache.get<ScoreDistribution>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getScoreDistribution();
    apiCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes TTL
    return data;
  }

  async getJobPerformanceMetrics(): Promise<JobPerformanceMetric[]> {
    const cacheKey = 'job_performance_metrics';
    const cached = apiCache.get<JobPerformanceMetric[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getJobPerformanceMetrics();
    apiCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes TTL
    return data;
  }

  async getRecruiterInsights(): Promise<RecruiterInsights> {
    const cacheKey = 'recruiter_insights';
    const cached = apiCache.get<RecruiterInsights>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getRecruiterInsights();
    apiCache.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes TTL
    return data;
  }

  async exportAnalyticsData(exportConfig: AnalyticsExport): Promise<{
    content: string;
    filename: string;
    content_type: string;
  }> {
    // Export operations are not cached as they generate fresh data
    return await this.originalApi.exportAnalyticsData(exportConfig);
  }

  // Override job methods with caching
  async getJobs(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    company?: string;
    job_type?: string;
    search?: string;
  }): Promise<JobDescriptionList> {
    const page = Math.floor((params?.skip || 0) / (params?.limit || 20)) + 1;
    const filters = JSON.stringify(params || {});
    const cacheKey = CacheKeys.JOBS_LIST(page, filters);
    const cached = jobsCache.get<JobDescriptionList>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getJobs(params);
    jobsCache.set(cacheKey, data, 30 * 1000); // 30 seconds TTL to reduce UI disruption
    return data;
  }

  async getJob(jobId: string): Promise<Job> {
    const cacheKey = CacheKeys.JOB_DETAIL(jobId);
    const cached = jobsCache.get<Job>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getJob(jobId);
    jobsCache.set(cacheKey, data, 30 * 1000); // 30 seconds TTL to reduce UI disruption
    return data;
  }

  async createJob(jobData: CreateJobRequest): Promise<Job> {
    const job = await this.originalApi.createJob(jobData);
    
    // Invalidate related caches
    CacheInvalidation.onJobCreate();
    
    // Cache the newly created job
    jobsCache.set(CacheKeys.JOB_DETAIL(job.id), job);
    
    return job;
  }

  async updateJob(jobId: string, jobData: UpdateJobRequest): Promise<Job> {
    const job = await this.originalApi.updateJob(jobId, jobData);
    
    // Invalidate related caches
    CacheInvalidation.onJobUpdate(jobId);
    
    // Cache the updated job
    jobsCache.set(CacheKeys.JOB_DETAIL(jobId), job);
    
    return job;
  }

  async deleteJob(jobId: string): Promise<{ message: string }> {
    const result = await this.originalApi.deleteJob(jobId);
    
    // Invalidate related caches
    CacheInvalidation.onJobDelete(jobId);
    
    return result;
  }

  async getJobStats(): Promise<JobStats> {
    const cacheKey = 'job_stats';
    const cached = jobsCache.get<JobStats>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getJobStats();
    jobsCache.set(cacheKey, data, 30 * 1000); // 30 seconds TTL to reduce UI disruption
    return data;
  }

  // Override comparison methods with caching
  async getComparisons(params: {
    page?: number;
    limit?: number;
    status?: string;
    job_id?: string;
    min_score?: number;
    max_score?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ comparisons: ResumeJobComparison[]; total: number; page: number; limit: number }> {
    const filters = JSON.stringify(params);
    const cacheKey = CacheKeys.COMPARISONS_LIST(params.page || 1, filters);
    const cached = comparisonsCache.get<{ comparisons: ResumeJobComparison[]; total: number; page: number; limit: number }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getComparisons(params);
    comparisonsCache.set(cacheKey, data);
    return data;
  }

  async getComparison(id: string): Promise<ResumeJobComparison> {
    const cacheKey = CacheKeys.COMPARISON_DETAIL(id);
    const cached = comparisonsCache.get<ResumeJobComparison>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getComparison(id);
    comparisonsCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes TTL
    return data;
  }

  async createComparison(data: {
    job_id: string;
    resume_id: string;
  }): Promise<ResumeJobComparison> {
    const comparison = await this.originalApi.createComparison(data);
    
    // Invalidate related caches
    CacheInvalidation.onComparisonCreate();
    
    // Cache the new comparison
    comparisonsCache.set(CacheKeys.COMPARISON_DETAIL(comparison.id), comparison);
    
    return comparison;
  }

  async updateComparison(id: string, data: Partial<ResumeJobComparison>): Promise<ResumeJobComparison> {
    const comparison = await this.originalApi.updateComparison(id, data);
    
    // Invalidate related caches
    CacheInvalidation.onComparisonUpdate(id);
    
    // Cache the updated comparison
    comparisonsCache.set(CacheKeys.COMPARISON_DETAIL(id), comparison);
    
    return comparison;
  }

  async deleteComparison(id: string): Promise<void> {
    await this.originalApi.deleteComparison(id);
    
    // Remove from cache
    comparisonsCache.delete(CacheKeys.COMPARISON_DETAIL(id));
    
    // Invalidate list caches
    comparisonsCache.keys()
      .filter(key => key.startsWith('comparisons_list'))
      .forEach(key => comparisonsCache.delete(key));
    
    // Invalidate analytics
    CacheInvalidation.onUserAction();
  }

  async getComparisonStats(): Promise<{
    total_comparisons: number;
    avg_score: number;
    top_score: number;
    recent_comparisons: number;
    status_breakdown: Record<string, number>;
  }> {
    // Always fetch fresh data for comparison stats to avoid cache inconsistencies
    // Clear any cached stats first
    const cacheKey = 'comparison_stats';
    comparisonsCache.delete(cacheKey);
    
    const data = await this.originalApi.getComparisonStats();
    
    // Cache the fresh data for a short period to avoid excessive API calls
    comparisonsCache.set(cacheKey, data, 30 * 1000); // 30 seconds TTL
    return data;
  }

  // Override system methods with caching
  async healthCheck(): Promise<SystemHealth> {
    const cacheKey = CacheKeys.SYSTEM_HEALTH();
    const cached = systemCache.get<SystemHealth>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.healthCheck();
    systemCache.set(cacheKey, data, 30 * 1000); // 30 seconds TTL for health checks
    return data;
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const cacheKey = CacheKeys.SYSTEM_INFO();
    const cached = systemCache.get<SystemInfo>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const data = await this.originalApi.getSystemInfo();
    systemCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes TTL
    return data;
  }

  // Utility methods for cache management
  async refreshCache(type?: 'analytics' | 'jobs' | 'comparisons' | 'system' | 'all'): Promise<void> {
    switch (type) {
      case 'analytics':
        CacheInvalidation.invalidateAnalytics();
        break;
      case 'jobs':
        CacheInvalidation.invalidateJobs();
        break;
      case 'comparisons':
        CacheInvalidation.invalidateComparisons();
        break;
      case 'system':
        systemCache.clear();
        break;
      case 'all':
      default:
        CacheInvalidation.invalidateAll();
        break;
    }
  }

  async getCacheStats() {
    return {
      analytics: apiCache.getStats(),
      jobs: jobsCache.getStats(),
      comparisons: comparisonsCache.getStats(),
      system: systemCache.getStats(),
    };
  }

  // Add the missing getParsedResumes method
  async getParsedResumes(): Promise<{ resumes: import('./types').ParsedResume[]; total: number }> {
    // For now, we'll bypass caching for this method to ensure fresh data
    const resumes = await this.originalApi.getParsedResumes();
    return {
      resumes: resumes,
      total: resumes.length
    };
  }

  // Preload frequently accessed data
  async preloadDashboardData(): Promise<void> {
    try {
      await Promise.all([
        this.getAnalyticsDashboard(),
        this.getOverviewMetrics(),
        this.getJobs({ limit: 20 }),
        this.getJobStats(),
        this.healthCheck(),
      ]);
    } catch (error) {
      console.warn('Failed to preload dashboard data:', error);
    }
  }

  // Add missing ranking methods
  async getRankingsByJob(
    jobId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<RankingListResponse> {
    // For now, we'll bypass caching for ranking methods to ensure they work
    // In a production environment, you might want to add proper caching
    return await this.originalApi.getRankingsByJob(jobId, page, limit);
  }

  async getCandidatesForJob(
    jobId: string
  ): Promise<{
    success: boolean;
    candidates: RankedCandidate[];
    total_candidates: number;
    message: string;
  }> {
    // Bypass caching for this method
    return await this.originalApi.getCandidatesForJob(jobId);
  }

  async getRankingStatistics(jobId: string): Promise<RankingStatisticsResponse> {
    // For now, we'll bypass caching for ranking methods to ensure they work
    // In a production environment, you might want to add proper caching
    return await this.originalApi.getRankingStatistics(jobId);
  }

  async createRanking(
    jobId: string,
    resumeIds: string[],
    criteria: RankingCriteria
  ): Promise<{ ranking_id: string }> {
    const result = await this.originalApi.createRanking(jobId, resumeIds, criteria);
    // Invalidate ranking lists for this job
    CacheInvalidation.onRankingCreate(jobId);
    return result;
  }

  async getShortlistSuggestions(
    jobId: string,
    count: number = 10
  ): Promise<import('./types').ShortlistResponse> {
    // For now, we'll bypass caching for ranking methods to ensure they work
    // In a production environment, you might want to add proper caching
    return await this.originalApi.getShortlistSuggestions(jobId, count);
  }

  async deleteRanking(rankingId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.originalApi.deleteRanking(rankingId);
    // Invalidate related caches
    CacheInvalidation.onRankingDelete();
    return result;
  }
}

// Create and export a singleton instance
export const cachedApiService = new CachedApiService();
export default cachedApiService;