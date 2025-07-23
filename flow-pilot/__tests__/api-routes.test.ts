// Test file for Feedback and Errors API routes
// Run with: npm test or jest

import { FeedbackAPI, ErrorsAPI, logApplicationError, submitFeedback } from '../lib/api-utils';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Feedback API', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getAllFeedback', () => {
    it('should fetch all feedback successfully', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            _id: '1',
            email: 'test@example.com',
            review: 'Great service!',
            type: 'good',
            createdAt: new Date().toISOString()
          }
        ],
        count: 1
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await FeedbackAPI.getAllFeedback();

      expect(mockFetch).toHaveBeenCalledWith('/api/feedback');
      expect(result).toEqual(mockResponse);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await FeedbackAPI.getAllFeedback();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('addFeedback', () => {
    it('should add feedback successfully', async () => {
      const feedbackData = {
        email: 'test@example.com',
        review: 'Excellent service!',
        type: 'good' as const
      };

      const mockResponse = {
        success: true,
        message: 'Feedback added successfully',
        data: { ...feedbackData, _id: '1', createdAt: new Date().toISOString() }
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await FeedbackAPI.addFeedback(feedbackData);

      expect(mockFetch).toHaveBeenCalledWith('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData)
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('validateFeedback', () => {
    it('should validate correct feedback data', () => {
      const validData = {
        email: 'test@example.com',
        review: 'This is a valid review',
        type: 'good' as const
      };

      const result = FeedbackAPI.validateFeedback(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const invalidData = {
        email: 'invalid-email',
        review: 'bad', // too short
        type: 'invalid' as any
      };

      const result = FeedbackAPI.validateFeedback(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
      expect(result.errors).toContain('Review must be at least 5 characters long');
      expect(result.errors).toContain('Invalid feedback type');
    });

    it('should return errors for missing required fields', () => {
      const result = FeedbackAPI.validateFeedback({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
      expect(result.errors).toContain('Review is required');
      expect(result.errors).toContain('Feedback type is required');
    });
  });
});

describe('Errors API', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getErrors', () => {
    it('should fetch errors with default parameters', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            _id: '1',
            errorMessage: 'Test error',
            type: 'System',
            severity: 'medium',
            timestamp: new Date().toISOString()
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await ErrorsAPI.getErrors();

      expect(mockFetch).toHaveBeenCalledWith('/api/errors');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch errors with filters', async () => {
      const filters = {
        type: 'System' as const,
        severity: 'critical' as const,
        limit: 10,
        page: 2
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true, data: [] }),
      } as Response);

      await ErrorsAPI.getErrors(filters);

      expect(mockFetch).toHaveBeenCalledWith('/api/errors?type=System&severity=critical&limit=10&page=2');
    });
  });

  describe('logError', () => {
    it('should log error successfully', async () => {
      const errorData = {
        errorMessage: 'Database connection failed',
        type: 'System' as const,
        severity: 'critical' as const
      };

      const mockResponse = {
        success: true,
        message: 'Error logged successfully',
        data: { ...errorData, _id: '1', timestamp: new Date().toISOString() }
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await ErrorsAPI.logError(errorData);

      expect(mockFetch).toHaveBeenCalledWith('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('validateError', () => {
    it('should validate correct error data', () => {
      const validData = {
        errorMessage: 'This is a valid error message',
        type: 'System' as const,
        severity: 'high' as const
      };

      const result = ErrorsAPI.validateError(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const invalidData = {
        errorMessage: 'bad', // too short
        type: 'Invalid' as any,
        severity: 'invalid' as any
      };

      const result = ErrorsAPI.validateError(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Error message must be at least 5 characters long');
      expect(result.errors).toContain('Invalid error type');
      expect(result.errors).toContain('Invalid severity level');
    });
  });

  describe('deleteErrors', () => {
    it('should delete errors with confirmation', async () => {
      const params = {
        confirm: true,
        type: 'System' as const,
        severity: 'low' as const
      };

      const mockResponse = {
        success: true,
        message: 'Successfully deleted 5 error(s)',
        deletedCount: 5
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await ErrorsAPI.deleteErrors(params);

      expect(mockFetch).toHaveBeenCalledWith('/api/errors?confirm=true&type=System&severity=low', {
        method: 'DELETE'
      });
      expect(result).toEqual(mockResponse);
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('logApplicationError', () => {
    it('should log error with default parameters', async () => {
      const mockResponse = {
        success: true,
        message: 'Error logged successfully',
        data: {}
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await logApplicationError('Test error message');

      expect(mockFetch).toHaveBeenCalledWith('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorMessage: 'Test error message',
          type: 'System',
          severity: 'medium'
        })
      });
    });

    it('should log error with custom parameters', async () => {
      const error = new Error('Custom error');
      
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      } as Response);

      await logApplicationError(error, 'Customer', 'critical');

      expect(mockFetch).toHaveBeenCalledWith('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorMessage: 'Custom error',
          type: 'Customer',
          severity: 'critical'
        })
      });
    });
  });

  describe('submitFeedback', () => {
    it('should submit valid feedback', async () => {
      const validFeedback = {
        email: 'test@example.com',
        review: 'Great service!',
        type: 'good' as const
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      } as Response);

      const result = await submitFeedback(validFeedback);

      expect(mockFetch).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should return validation errors for invalid feedback', async () => {
      const invalidFeedback = {
        email: 'invalid-email',
        review: 'bad',
        type: 'invalid' as any
      };

      const result = await submitFeedback(invalidFeedback);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// Integration tests (these would require a test database)
describe('Integration Tests', () => {
  // These tests would require setting up a test database
  // and running the actual API endpoints

  it.skip('should create and retrieve feedback end-to-end', async () => {
    // This would test the actual API endpoints
    // Requires test database setup
  });

  it.skip('should create and retrieve errors end-to-end', async () => {
    // This would test the actual API endpoints
    // Requires test database setup
  });
});

// Performance tests
describe('Performance Tests', () => {
  it.skip('should handle large number of feedback entries', async () => {
    // Test with large datasets
  });

  it.skip('should handle concurrent error logging', async () => {
    // Test concurrent requests
  });
});

// Example usage tests
describe('Example Usage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should demonstrate typical feedback workflow', async () => {
    // Mock successful responses
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { _id: '1' } }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: [{ _id: '1' }] }),
      } as Response);

    // Add feedback
    const addResult = await FeedbackAPI.addFeedback({
      email: 'customer@example.com',
      review: 'Excellent service!',
      type: 'good'
    });

    expect(addResult.success).toBe(true);

    // Get all feedback
    const getResult = await FeedbackAPI.getAllFeedback();
    expect(getResult.success).toBe(true);
  });

  it('should demonstrate typical error logging workflow', async () => {
    // Mock successful responses
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { _id: '1' } }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: [{ _id: '1' }] }),
      } as Response);

    // Log error
    const logResult = await ErrorsAPI.logError({
      errorMessage: 'Payment gateway timeout',
      type: 'System',
      severity: 'high'
    });

    expect(logResult.success).toBe(true);

    // Get errors with filters
    const getResult = await ErrorsAPI.getErrors({
      type: 'System',
      severity: 'high'
    });

    expect(getResult.success).toBe(true);
  });
});