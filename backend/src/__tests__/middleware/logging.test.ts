/**
 * Logging Middleware Tests
 * 
 * Tests for logging.ts middleware including:
 * - requestLogger middleware (HTTP request logging)
 * - auditLogger middleware (audit trail creation)
 * - errorLogger middleware (error logging)
 */

import { Request, Response, NextFunction } from 'express';
import { requestLogger, auditLogger, errorLogger } from '../../middleware/logging';
import logger from '../../utils/logger';
import AuditLog, { ActionType } from '../../models/AuditLog';
import { AuthRequest } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../models/AuditLog');

describe('Logging Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockOn: jest.Mock;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup request mock
    mockReq = {
      method: 'GET',
      originalUrl: '/api/users',
      ip: '127.0.0.1',
      get: jest.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        if (header === 'set-cookie') return undefined;
        return undefined;
      }) as any,
      body: { test: 'data' },
      params: { id: '123' },
      query: { filter: 'active' }
    };
    
    // Setup response mock
    mockJson = jest.fn(function(data: any) {
      return data;
    });
    mockOn = jest.fn();
    
    mockRes = {
      statusCode: 200,
      json: mockJson,
      on: mockOn
    };
    
    // Setup next mock
    mockNext = jest.fn();
  });

  describe('requestLogger', () => {
    it('should log request details on response finish', () => {
      let finishCallback: Function;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      const startTime = Date.now();
      jest.spyOn(Date, 'now').mockReturnValueOnce(startTime);

      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('finish', expect.any(Function));

      // Simulate response finish after 150ms
      jest.spyOn(Date, 'now').mockReturnValueOnce(startTime + 150);
      finishCallback!();

      expect(logger.info).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/users',
        status: 200,
        duration: '150ms',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0'
      });
    });

    it('should handle different HTTP methods', () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      
      methods.forEach(method => {
        jest.clearAllMocks();
        mockReq.method = method;
        let finishCallback: Function;
        mockOn.mockImplementation((event: string, callback: Function) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        });

        requestLogger(mockReq as Request, mockRes as Response, mockNext);
        finishCallback!();

        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ method })
        );
      });
    });

    it('should handle different status codes', () => {
      const statusCodes = [201, 400, 401, 403, 404, 500];
      
      statusCodes.forEach(status => {
        jest.clearAllMocks();
        mockRes.statusCode = status;
        let finishCallback: Function;
        mockOn.mockImplementation((event: string, callback: Function) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        });

        requestLogger(mockReq as Request, mockRes as Response, mockNext);
        finishCallback!();

        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ status })
        );
      });
    });

    it('should handle missing user agent', () => {
      mockReq.get = jest.fn().mockReturnValue(undefined);
      let finishCallback: Function;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback!();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: undefined })
      );
    });

    it('should calculate accurate duration', () => {
      let finishCallback: Function;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      const startTime = 1000;
      const endTime = 1100;
      
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime);

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback!();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ duration: '100ms' })
      );
    });
  });

  describe('auditLogger', () => {
    beforeEach(() => {
      (AuditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should create audit log for successful requests', async () => {
      const middleware = auditLogger(ActionType.CREATE, 'user');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Call the wrapped json function
      const responseData = { _id: 'entity123', name: 'Test' };
      mockRes.json!(responseData);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(AuditLog.create).toHaveBeenCalledWith({
        userId: 'user123',
        action: ActionType.CREATE,
        entity: 'user',
        entityId: 'entity123',
        details: {
          method: 'GET',
          path: '/api/users',
          body: { test: 'data' },
          params: { id: '123' },
          query: { filter: 'active' }
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0'
      });
    });

    it('should use params.id if response data has no _id', async () => {
      const middleware = auditLogger(ActionType.UPDATE, 'team');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      const responseData = { success: true };
      mockRes.json!(responseData);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: '123' // from req.params.id
        })
      );
    });

    it('should not create audit log for error responses', async () => {
      const middleware = auditLogger(ActionType.DELETE, 'event');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      mockRes.statusCode = 404;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      const responseData = { error: 'Not found' };
      mockRes.json!(responseData);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(AuditLog.create).not.toHaveBeenCalled();
    });

    it('should not create audit log for unauthenticated requests', async () => {
      const middleware = auditLogger(ActionType.CREATE, 'fixture');
      const authReq = {
        ...mockReq,
        user: undefined
      } as AuthRequest;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      const responseData = { _id: 'fixture123' };
      mockRes.json!(responseData);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(AuditLog.create).not.toHaveBeenCalled();
    });

    it('should handle audit log creation errors', async () => {
      const middleware = auditLogger(ActionType.UPDATE, 'permission');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      
      const auditError = new Error('Database error');
      (AuditLog.create as jest.Mock).mockRejectedValue(auditError);
      
      middleware(authReq, mockRes as Response, mockNext);
      
      const responseData = { _id: 'permission123' };
      mockRes.json!(responseData);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(logger.error).toHaveBeenCalledWith('Audit log error:', auditError);
    });

    it('should preserve original json function behavior', () => {
      const middleware = auditLogger(ActionType.CREATE, 'match');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      
      const originalJson = jest.fn().mockReturnValue('original-return');
      mockRes.json = originalJson;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      const responseData = { _id: 'match123' };
      const result = mockRes.json!(responseData);
      
      expect(originalJson).toHaveBeenCalledWith(responseData);
      expect(result).toBe('original-return');
    });

    it('should handle different action types', async () => {
      const actions = [ActionType.CREATE, ActionType.UPDATE, ActionType.DELETE, ActionType.LOGIN, ActionType.LOGOUT] as const;
      
      for (const action of actions) {
        jest.clearAllMocks();
        const middleware = auditLogger(action, 'test');
        const authReq = {
          ...mockReq,
          user: { _id: 'user123' }
        } as AuthRequest;
        
        middleware(authReq, mockRes as Response, mockNext);
        mockRes.json!({ _id: 'test123' });
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(AuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({ action })
        );
      }
    });

    it('should bind json function to response context', () => {
      const middleware = auditLogger(ActionType.CREATE, 'sport');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      
      const originalJson = jest.fn(function(this: any) {
        return this;
      });
      mockRes.json = originalJson;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      const result = mockRes.json!({ _id: 'sport123' });
      
      expect(result).toBe(mockRes);
    });

    it('should handle status codes at boundary (299)', async () => {
      const middleware = auditLogger(ActionType.CREATE, 'boundary');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      mockRes.statusCode = 299;
      
      middleware(authReq, mockRes as Response, mockNext);
      mockRes.json!({ _id: 'boundary123' });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(AuditLog.create).toHaveBeenCalled();
    });

    it('should not log for status code 300', async () => {
      const middleware = auditLogger(ActionType.CREATE, 'redirect');
      const authReq = {
        ...mockReq,
        user: { _id: 'user123' }
      } as AuthRequest;
      mockRes.statusCode = 300;
      
      middleware(authReq, mockRes as Response, mockNext);
      mockRes.json!({ _id: 'redirect123' });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(AuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('errorLogger', () => {
    it('should log error details', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at Test.suite';
      
      errorLogger(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.error).toHaveBeenCalledWith({
        error: 'Test error',
        stack: error.stack,
        url: '/api/users',
        method: 'GET',
        ip: '127.0.0.1'
      });
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('No stack error');
      delete error.stack;
      
      errorLogger(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.error).toHaveBeenCalledWith({
        error: 'No stack error',
        stack: undefined,
        url: '/api/users',
        method: 'GET',
        ip: '127.0.0.1'
      });
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
        }
      }
      
      const error = new CustomError('Custom error', 'CUSTOM_001');
      
      errorLogger(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Custom error'
        })
      );
    });

    it('should pass error to next middleware', () => {
      const error = new Error('Pass through error');
      
      errorLogger(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle missing request properties', () => {
      const error = new Error('Missing props error');
      const minimalReq = {
        method: undefined,
        originalUrl: undefined,
        ip: undefined
      };
      
      errorLogger(error, minimalReq as any, mockRes as Response, mockNext);
      
      expect(logger.error).toHaveBeenCalledWith({
        error: 'Missing props error',
        stack: error.stack,
        url: undefined,
        method: undefined,
        ip: undefined
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with multiple logging middleware', () => {
      // Simulate request flow through multiple middleware
      const nextCallback = jest.fn();
      requestLogger(mockReq as Request, mockRes as Response, nextCallback);
      
      const middleware = auditLogger(ActionType.CREATE, 'integration');
      const authReq = { ...mockReq, user: { _id: 'user123' } } as AuthRequest;
      
      middleware(authReq, mockRes as Response, mockNext);
      
      // Both middleware should have been set up
      expect(mockOn).toHaveBeenCalled();
      expect(nextCallback).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle response without on method', () => {
      const resWithoutOn = {
        ...mockRes,
        on: undefined
      };
      
      expect(() => {
        requestLogger(mockReq as Request, resWithoutOn as any, mockNext);
      }).toThrow();
    });
  });
});

/**
 * Test Coverage Summary:
 * ✓ requestLogger middleware
 *   - Request logging on response finish
 *   - Duration calculation
 *   - Different HTTP methods and status codes
 *   - User agent handling
 * ✓ auditLogger middleware
 *   - Audit log creation for successful requests
 *   - Entity ID from response or params
 *   - Skip logging for errors and unauthenticated requests
 *   - Error handling
 *   - Different action types
 *   - Context preservation
 * ✓ errorLogger middleware
 *   - Error detail logging
 *   - Stack trace handling
 *   - Custom error types
 *   - Error propagation
 * ✓ Edge cases and integration scenarios
 * 
 * Coverage: ~100% of logging.ts functionality
 */