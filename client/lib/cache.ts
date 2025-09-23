// lib/cache.ts - Comprehensive caching system for HireLens
import React from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds
  maxSize?: number; // Maximum number of items to cache
  persistToStorage?: boolean; // Whether to persist to localStorage
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class CacheManager {
  private cache = new Map<string, CacheItem<unknown>>();
  private stats = { hits: 0, misses: 0 };
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100,
      persistToStorage: true,
      ...options,
    };

    // Load from localStorage on initialization
    if (this.options.persistToStorage && typeof window !== 'undefined') {
      this.loadFromStorage();
    }

    // Cleanup expired items periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined;
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.data;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, customTtl?: number): void {
    const ttl = customTtl || this.options.ttl;
    
    // Check max size and remove oldest items if needed
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    this.cache.set(key, item);

    // Persist to localStorage if enabled
    if (this.options.persistToStorage) {
      this.saveToStorage(key, item);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    
    if (this.options.persistToStorage && typeof window !== 'undefined') {
      localStorage.removeItem(`cache_${key}`);
    }
    
    return result;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    
    if (this.options.persistToStorage && typeof window !== 'undefined') {
      // Clear all cache items from localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
      keys.forEach(key => localStorage.removeItem(key));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup expired items
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        if (this.options.persistToStorage && typeof window !== 'undefined') {
          localStorage.removeItem(`cache_${key}`);
        }
      }
    }
  }

  /**
   * Evict oldest items when cache is full
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Save item to localStorage
   */
  private saveToStorage<T>(key: string, item: CacheItem<T>): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
      
      keys.forEach(storageKey => {
        const cacheKey = storageKey.replace('cache_', '');
        const itemStr = localStorage.getItem(storageKey);
        
        if (itemStr) {
          try {
            const item: CacheItem<unknown> = JSON.parse(itemStr);
            
            // Check if item is still valid
            if (Date.now() - item.timestamp <= item.ttl) {
              this.cache.set(cacheKey, item);
            } else {
              localStorage.removeItem(storageKey);
            }
          } catch (error) {
            console.warn(`Failed to parse cached item ${cacheKey}:`, error);
            localStorage.removeItem(storageKey);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }
}

// Cache configurations for different data types
export const CACHE_CONFIGS = {
  // API responses with frequent updates
  ANALYTICS: { ttl: 2 * 60 * 1000, maxSize: 50 }, // 2 minutes
  JOBS: { ttl: 30 * 1000, maxSize: 100 }, // 30 seconds to reduce UI disruption
  COMPARISONS: { ttl: 3 * 60 * 1000, maxSize: 200 }, // 3 minutes
  
  // Relatively static data
  SYSTEM_INFO: { ttl: 10 * 60 * 1000, maxSize: 20 }, // 10 minutes
  USER_PREFERENCES: { ttl: 60 * 60 * 1000, maxSize: 50 }, // 1 hour
  
  // Computed/processed data
  SEARCH_RESULTS: { ttl: 60 * 1000, maxSize: 50 }, // 1 minute
  FILTERED_DATA: { ttl: 30 * 1000, maxSize: 100 }, // 30 seconds
} as const;

// Create cache instances
export const apiCache = new CacheManager(CACHE_CONFIGS.ANALYTICS);
export const jobsCache = new CacheManager(CACHE_CONFIGS.JOBS);
export const comparisonsCache = new CacheManager(CACHE_CONFIGS.COMPARISONS);
export const systemCache = new CacheManager(CACHE_CONFIGS.SYSTEM_INFO);
export const userCache = new CacheManager(CACHE_CONFIGS.USER_PREFERENCES);
export const searchCache = new CacheManager(CACHE_CONFIGS.SEARCH_RESULTS);

// Utility functions for cache key generation
export const CacheKeys = {
  // API endpoints
  ANALYTICS_DASHBOARD: (days: number = 30) => `analytics_dashboard_${days}`,
  ANALYTICS_OVERVIEW: (days: number = 30) => `analytics_overview_${days}`,
  JOBS_LIST: (page: number, filters?: string) => `jobs_list_${page}_${filters || 'all'}`,
  JOB_DETAIL: (id: string) => `job_detail_${id}`,
  COMPARISONS_LIST: (page: number, filters?: string) => `comparisons_list_${page}_${filters || 'all'}`,
  COMPARISON_DETAIL: (id: string) => `comparison_detail_${id}`,
  
  // System data
  SYSTEM_HEALTH: () => 'system_health',
  SYSTEM_INFO: () => 'system_info',
  
  // User data
  USER_PREFERENCES: (userId?: string) => `user_preferences_${userId || 'default'}`,
  
  // Search and filters
  SEARCH_RESULTS: (query: string, type: string) => `search_${type}_${query}`,
  FILTERED_DATA: (type: string, filters: string) => `filtered_${type}_${filters}`,
  
  // Computed data
  SKILLS_ANALYSIS: () => 'skills_analysis',
  SCORE_DISTRIBUTION: () => 'score_distribution',
  HIRING_TRENDS: (months: number = 12) => `hiring_trends_${months}`,
} as const;

// Cache invalidation helpers
export const CacheInvalidation = {
  // Invalidate related caches when data changes
  onJobCreate: () => {
    // Clear all job-related caches immediately
    jobsCache.clear();
    // Also clear analytics caches that might be affected
    apiCache.clear();
    systemCache.clear();
  },
  
  onJobUpdate: (_jobId: string) => {
    // Clear all job-related caches immediately
    jobsCache.clear();
    // Also clear analytics caches that might be affected
    apiCache.clear();
  },
  
  onJobDelete: (jobId: string) => {
    // Clear all job-related caches immediately
    jobsCache.clear();
    // Also clear analytics caches that might be affected
    apiCache.clear();
    systemCache.clear();
  },
  
  onComparisonCreate: () => {
    // Clear comparison caches
    comparisonsCache.clear();
    // Clear job stats cache as comparisons might affect job analytics
    jobsCache.clear();
    // Clear analytics caches
    apiCache.clear();
  },
  
  onComparisonUpdate: (_comparisonId: string) => {
    // Clear comparison caches
    comparisonsCache.clear();
    // Clear job stats cache as comparisons might affect job analytics
    jobsCache.clear();
    // Clear analytics caches
    apiCache.clear();
  },

  onRankingCreate: (jobId: string) => {
    // Invalidate caches related to rankings and job details
    jobsCache.delete(CacheKeys.JOB_DETAIL(jobId));
    // Invalidate any cached ranking lists for this job
    jobsCache.keys()
      .filter(key => key.startsWith(`rankings_list_${jobId}`))
      .forEach(key => jobsCache.delete(key));
    // Invalidate analytics caches that might be affected by new ranking data
    apiCache.clear();
  },
  
  onRankingDelete: () => {
    // Invalidate all ranking-related caches
    jobsCache.clear();
    // Invalidate analytics caches that might be affected by ranking deletion
    apiCache.clear();
  },
  
  onUserAction: () => {
    // Clear all caches for maximum freshness
    [apiCache, jobsCache, comparisonsCache, systemCache, userCache, searchCache].forEach(cache => cache.clear());
  },
  
  // Manual invalidation for specific data types
  invalidateAnalytics: () => {
    apiCache.clear();
  },
  
  invalidateJobs: () => {
    jobsCache.clear();
  },
  
  invalidateComparisons: () => {
    comparisonsCache.clear();
  },
  
  invalidateAll: () => {
    [apiCache, jobsCache, comparisonsCache, systemCache, userCache, searchCache].forEach(cache => cache.clear());
  }
} as const;

// React hook for cache statistics (for development/debugging)
export function useCacheStats() {
  const [stats, setStats] = React.useState<Record<string, CacheStats>>({});
  
  React.useEffect(() => {
    const updateStats = () => {
      setStats({
        api: apiCache.getStats(),
        jobs: jobsCache.getStats(),
        comparisons: comparisonsCache.getStats(),
        system: systemCache.getStats(),
        user: userCache.getStats(),
        search: searchCache.getStats(),
      });
    };
    
    // Only enable frequent updates in development mode
    if (process.env.NODE_ENV === 'development') {
      updateStats();
      const interval = setInterval(updateStats, 10000); // Update every 10 seconds in dev
      
      return () => clearInterval(interval);
    } else {
      // In production, update less frequently
      updateStats();
      // Remove automatic updates in production to prevent UI disruption
      // Stats will be updated only when the hook is re-mounted
    }
  }, []);
  
  return stats;
}

export default CacheManager;