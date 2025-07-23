/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
// Utility functions for interacting with Feedback and Errors API

export interface FeedbackData {
  email: string;
  review: string;
  type: 'good' | 'bad' | 'neutral';
}

export interface ErrorData {
  timestamp: string | number | Date;
  errorMessage: string;
  type: 'System' | 'Customer';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ErrorFilters {
  type?: 'System' | 'Customer';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  limit?: number;
  page?: number;
}

export interface DeleteErrorsParams {
  confirm: boolean;
  type?: 'System' | 'Customer';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  olderThan?: number; // days
}

// Feedback API Functions
export class FeedbackAPI {
  private static baseUrl = '/api/feedback';

  /**
   * Fetch all feedback entries
   */
  static async getAllFeedback(): Promise<ApiResponse<FeedbackData[]>> {
    try {
      const response = await fetch(this.baseUrl);
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add new feedback
   */
  static async addFeedback(feedbackData: FeedbackData): Promise<ApiResponse<FeedbackData>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData)
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate feedback data before submission
   */
  static validateFeedback(data: Partial<FeedbackData>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }

    if (!data.review) {
      errors.push('Review is required');
    } else if (data.review.trim().length < 5) {
      errors.push('Review must be at least 5 characters long');
    } else if (data.review.trim().length > 1000) {
      errors.push('Review must be less than 1000 characters');
    }

    if (!data.type) {
      errors.push('Feedback type is required');
    } else if (!['good', 'bad', 'neutral'].includes(data.type)) {
      errors.push('Invalid feedback type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Errors API Functions
export class ErrorsAPI {
  private static baseUrl = '/api/errors';

  /**
   * Fetch errors with optional filtering and pagination
   */
  static async getErrors(filters: ErrorFilters = {}): Promise<PaginatedResponse<ErrorData>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.type) params.append('type', filters.type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.page) params.append('page', filters.page.toString());

      const url = params.toString() ? `${this.baseUrl}?${params}` : this.baseUrl;
      const response = await fetch(url);
      
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Log a new error
   */
  static async logError(errorData: ErrorData): Promise<ApiResponse<ErrorData>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete errors with optional filtering
   */
  static async deleteErrors(params: DeleteErrorsParams): Promise<ApiResponse<{ deletedCount: number }>> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.append('confirm', params.confirm.toString());
      
      if (params.type) searchParams.append('type', params.type);
      if (params.severity) searchParams.append('severity', params.severity);
      if (params.olderThan) searchParams.append('olderThan', params.olderThan.toString());

      const response = await fetch(`${this.baseUrl}?${searchParams}`, {
        method: 'DELETE'
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate error data before submission
   */
  static validateError(data: Partial<ErrorData>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.errorMessage) {
      errors.push('Error message is required');
    } else if (data.errorMessage.trim().length < 5) {
      errors.push('Error message must be at least 5 characters long');
    } else if (data.errorMessage.trim().length > 2000) {
      errors.push('Error message must be less than 2000 characters');
    }

    if (!data.type) {
      errors.push('Error type is required');
    } else if (!['System', 'Customer'].includes(data.type)) {
      errors.push('Invalid error type');
    }

    if (!data.severity) {
      errors.push('Severity is required');
    } else if (!['low', 'medium', 'high', 'critical'].includes(data.severity)) {
      errors.push('Invalid severity level');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get error statistics
   */
  static async getErrorStats(): Promise<ApiResponse<any>> {
    try {
      // Get all errors to calculate statistics
      const response = await this.getErrors({ limit: 1000 });
      
      if (!response.success || !response.data) {
        return response;
      }

      const errors = response.data;
      
      const stats = {
        total: errors.length,
        byType: {
          System: errors.filter(e => e.type === 'System').length,
          Customer: errors.filter(e => e.type === 'Customer').length
        },
        bySeverity: {
          low: errors.filter(e => e.severity === 'low').length,
          medium: errors.filter(e => e.severity === 'medium').length,
          high: errors.filter(e => e.severity === 'high').length,
          critical: errors.filter(e => e.severity === 'critical').length
        },
        recent: {
          last24h: errors.filter(e => {
            const errorDate = new Date(e.timestamp);
            const now = new Date();
            const diff = now.getTime() - errorDate.getTime();
            return diff <= 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          }).length,
          last7days: errors.filter(e => {
            const errorDate = new Date(e.timestamp);
            const now = new Date();
            const diff = now.getTime() - errorDate.getTime();
            return diff <= 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          }).length
        }
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to calculate statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Utility function for automatic error logging
export const logApplicationError = async (
  error: Error | string,
  type: 'System' | 'Customer' = 'System',
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) => {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return await ErrorsAPI.logError({
    errorMessage,
    type,
    severity,
    timestamp: ''
  });
};

// Utility function for feedback submission with validation
export const submitFeedback = async (feedbackData: FeedbackData) => {
  const validation = FeedbackAPI.validateFeedback(feedbackData);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: 'Validation failed',
      message: validation.errors.join(', ')
    };
  }

  return await FeedbackAPI.addFeedback(feedbackData);
};

// React Hook for feedback management (optional)
export const useFeedback = () => {
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeedback = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await FeedbackAPI.getAllFeedback();
      if (response.success && response.data) {
        setFeedback(response.data);
      } else {
        setError(response.message || 'Failed to load feedback');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addFeedback = async (data: FeedbackData) => {
    const response = await submitFeedback(data);
    if (response.success) {
      await loadFeedback(); // Reload feedback list
    }
    return response;
  };

  return {
    feedback,
    loading,
    error,
    loadFeedback,
    addFeedback
  };
};

// React Hook for error management (optional)
export const useErrors = (initialFilters: ErrorFilters = {}) => {
  const [errors, setErrors] = useState<ErrorData[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadErrors = async (filters: ErrorFilters = initialFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await ErrorsAPI.getErrors(filters);
      if (response.success && response.data) {
        setErrors(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.message || 'Failed to load errors');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const logError = async (data: ErrorData) => {
    const response = await ErrorsAPI.logError(data);
    if (response.success) {
      await loadErrors(); // Reload errors list
    }
    return response;
  };

  return {
    errors,
    pagination,
    loading,
    error,
    loadErrors,
    logError
  };
};