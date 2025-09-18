// __tests__/lib/cache.test.ts - Unit tests for caching system

import CacheManager, { 
  apiCache, 
  jobsCache, 
  CacheKeys, 
  CacheInvalidation 
} from '../../lib/cache';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({
      ttl: 1000, // 1 second for testing
      maxSize: 3,
      persistToStorage: false, // Disable for most tests
    });
    localStorageMock.clear();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve data', () => {
      const testData = { id: 1, name: 'test' };
      cache.set('test-key', testData);
      
      const retrieved = cache.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    test('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    test('should check if key exists', () => {
      cache.set('test-key', 'test-value');
      expect(cache.has('test-key')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    test('should delete items', () => {
      cache.set('test-key', 'test-value');
      expect(cache.has('test-key')).toBe(true);
      
      const deleted = cache.delete('test-key');
      expect(deleted).toBe(true);
      expect(cache.has('test-key')).toBe(false);
    });

    test('should clear all items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL (Time To Live)', () => {
    test('should expire items after TTL', (done) => {
      cache.set('test-key', 'test-value');
      expect(cache.get('test-key')).toBe('test-value');
      
      setTimeout(() => {
        expect(cache.get('test-key')).toBeNull();
        done();
      }, 1100); // Wait longer than TTL
    });

    test('should use custom TTL', (done) => {
      cache.set('test-key', 'test-value', 500); // 0.5 seconds
      
      setTimeout(() => {
        expect(cache.get('test-key')).toBeNull();
        done();
      }, 600);
    });

    test('should not expire items before TTL', (done) => {
      cache.set('test-key', 'test-value');
      
      setTimeout(() => {
        expect(cache.get('test-key')).toBe('test-value');
        done();
      }, 500); // Wait less than TTL
    });
  });

  describe('Size Limits', () => {
    test('should evict oldest items when max size reached', () => {
      // Add items up to max size
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // All items should be present
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      
      // Add one more item, should evict oldest
      cache.set('key4', 'value4');
      
      expect(cache.has('key1')).toBe(false); // Evicted
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should track cache hits and misses', () => {
      cache.set('test-key', 'test-value');
      
      // Hit
      cache.get('test-key');
      
      // Miss
      cache.get('non-existent');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.size).toBe(1);
    });
  });

  describe('Persistence', () => {
    test('should persist to localStorage when enabled', () => {
      const persistentCache = new CacheManager({
        ttl: 60000,
        persistToStorage: true,
      });
      
      persistentCache.set('persistent-key', 'persistent-value');
      
      // Check if item was saved to localStorage
      const storedItem = localStorageMock.getItem('cache_persistent-key');
      expect(storedItem).toBeTruthy();
      
      if (storedItem) {
        const parsed = JSON.parse(storedItem);
        expect(parsed.data).toBe('persistent-value');
      }
    });

    test('should load from localStorage on initialization', () => {
      // Pre-populate localStorage
      const cacheItem = {
        data: 'loaded-value',
        timestamp: Date.now(),
        ttl: 60000,
        key: 'loaded-key',
      };
      
      localStorageMock.setItem('cache_loaded-key', JSON.stringify(cacheItem));
      
      // Create new cache instance
      const loadingCache = new CacheManager({
        ttl: 60000,
        persistToStorage: true,
      });
      
      expect(loadingCache.get('loaded-key')).toBe('loaded-value');
    });
  });
});

describe('Cache Key Generation', () => {
  test('should generate consistent keys', () => {
    const key1 = CacheKeys.ANALYTICS_DASHBOARD(30);
    const key2 = CacheKeys.ANALYTICS_DASHBOARD(30);
    expect(key1).toBe(key2);
    
    const key3 = CacheKeys.ANALYTICS_DASHBOARD(60);
    expect(key1).not.toBe(key3);
  });

  test('should generate unique keys for different parameters', () => {
    const jobListKey1 = CacheKeys.JOBS_LIST(1, 'status=active');
    const jobListKey2 = CacheKeys.JOBS_LIST(1, 'status=draft');
    const jobListKey3 = CacheKeys.JOBS_LIST(2, 'status=active');
    
    expect(jobListKey1).not.toBe(jobListKey2);
    expect(jobListKey1).not.toBe(jobListKey3);
    expect(jobListKey2).not.toBe(jobListKey3);
  });
});

describe('Cache Invalidation', () => {
  beforeEach(() => {
    // Clear all caches
    apiCache.clear();
    jobsCache.clear();
  });

  test('should invalidate related caches on job creation', () => {
    // Pre-populate caches
    jobsCache.set(CacheKeys.JOBS_LIST(1), { jobs: [], total: 0 });
    apiCache.set(CacheKeys.ANALYTICS_DASHBOARD(), { overview: {} });
    
    expect(jobsCache.has(CacheKeys.JOBS_LIST(1))).toBe(true);
    expect(apiCache.has(CacheKeys.ANALYTICS_DASHBOARD())).toBe(true);
    
    // Trigger invalidation
    CacheInvalidation.onJobCreate();
    
    expect(jobsCache.has(CacheKeys.JOBS_LIST(1))).toBe(false);
    expect(apiCache.has(CacheKeys.ANALYTICS_DASHBOARD())).toBe(false);
  });

  test('should invalidate specific job on update', () => {
    const jobId = 'test-job-id';
    
    // Pre-populate caches
    jobsCache.set(CacheKeys.JOB_DETAIL(jobId), { id: jobId, title: 'Test Job' });
    jobsCache.set(CacheKeys.JOBS_LIST(1), { jobs: [], total: 0 });
    
    expect(jobsCache.has(CacheKeys.JOB_DETAIL(jobId))).toBe(true);
    expect(jobsCache.has(CacheKeys.JOBS_LIST(1))).toBe(true);
    
    // Trigger invalidation
    CacheInvalidation.onJobUpdate(jobId);
    
    expect(jobsCache.has(CacheKeys.JOB_DETAIL(jobId))).toBe(false);
    expect(jobsCache.has(CacheKeys.JOBS_LIST(1))).toBe(false);
  });

  test('should invalidate all caches', () => {
    // Pre-populate multiple caches
    apiCache.set('test-key-1', 'test-value-1');
    jobsCache.set('test-key-2', 'test-value-2');
    
    expect(apiCache.has('test-key-1')).toBe(true);
    expect(jobsCache.has('test-key-2')).toBe(true);
    
    // Trigger complete invalidation
    CacheInvalidation.invalidateAll();
    
    expect(apiCache.has('test-key-1')).toBe(false);
    expect(jobsCache.has('test-key-2')).toBe(false);
  });
});

describe('Cache Integration', () => {
  test('should work with different data types', () => {
    const testCases = [
      { key: 'string-key', value: 'string value' },
      { key: 'number-key', value: 42 },
      { key: 'boolean-key', value: true },
      { key: 'array-key', value: [1, 2, 3] },
      { key: 'object-key', value: { nested: { data: 'test' } } },
      { key: 'null-key', value: null },
    ];
    
    testCases.forEach(({ key, value }) => {
      cache.set(key, value);
      expect(cache.get(key)).toEqual(value);
    });
  });

  test('should handle concurrent operations', () => {
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            cache.set(`concurrent-key-${i}`, `value-${i}`);
            const value = cache.get(`concurrent-key-${i}`);
            expect(value).toBe(`value-${i}`);
            resolve();
          }, Math.random() * 100);
        })
      );
    }
    
    return Promise.all(promises);
  });
});

describe('Error Handling', () => {
  test('should handle localStorage errors gracefully', () => {
    // Mock localStorage to throw error
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new Error('Storage quota exceeded');
    });
    
    const errorCache = new CacheManager({
      persistToStorage: true,
    });
    
    // Should not throw error
    expect(() => {
      errorCache.set('test-key', 'test-value');
    }).not.toThrow();
    
    // Restore original method
    Storage.prototype.setItem = originalSetItem;
  });

  test('should handle corrupted localStorage data', () => {
    // Add corrupted data to localStorage
    localStorageMock.setItem('cache_corrupted-key', 'invalid-json');
    
    // Should not throw error when creating cache
    expect(() => {
      new CacheManager({ persistToStorage: true });
    }).not.toThrow();
  });
});