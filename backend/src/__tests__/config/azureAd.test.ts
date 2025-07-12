/**
 * Azure AD Configuration Tests
 * 
 * Tests for azureAd.ts including:
 * - Configuration object generation
 * - Environment variable handling
 * - Bearer strategy creation
 * - Token validation callback
 */

import { BearerStrategy } from 'passport-azure-ad';
import { createBearerStrategy } from '../../config/azureAd';

// Mock passport-azure-ad
jest.mock('passport-azure-ad', () => ({
  BearerStrategy: jest.fn().mockImplementation((config: any, callback: any) => {
    return { config, callback };
  })
}));

describe('Azure AD Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('azureAdConfig', () => {
    it('should generate config with default values when environment variables are not set', () => {
      delete process.env.AZURE_AD_TENANT_ID;
      delete process.env.AZURE_AD_CLIENT_ID;

      // Re-import to get fresh config
      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config).toMatchObject({
        identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
        clientID: 'dummy-client-id',
        validateIssuer: true,
        issuer: undefined,
        passReqToCallback: true,
        loggingLevel: 'error',
        loggingNoPII: false,
        allowMultiAudiencesInToken: false,
        audience: 'dummy-client-id',
        clockSkew: 300
      });
    });

    it('should use environment variables when set', () => {
      process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';

      // Re-import to get fresh config
      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config).toMatchObject({
        identityMetadata: 'https://login.microsoftonline.com/test-tenant-id/v2.0/.well-known/openid-configuration',
        clientID: 'test-client-id',
        validateIssuer: true,
        issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
        passReqToCallback: true,
        loggingLevel: 'error',
        loggingNoPII: false,
        allowMultiAudiencesInToken: false,
        audience: 'test-client-id',
        clockSkew: 300
      });
    });

    it('should use common tenant when AZURE_AD_TENANT_ID is not set', () => {
      delete process.env.AZURE_AD_TENANT_ID;
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';

      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config.identityMetadata).toContain('/common/');
      expect(config.issuer).toBeUndefined();
    });

    it('should set issuer only when tenant ID is provided', () => {
      process.env.AZURE_AD_TENANT_ID = 'specific-tenant';

      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config.issuer).toBe('https://login.microsoftonline.com/specific-tenant/v2.0');
    });

    it('should use client ID as audience', () => {
      process.env.AZURE_AD_CLIENT_ID = 'my-app-client-id';

      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config.audience).toBe('my-app-client-id');
      expect(config.clientID).toBe('my-app-client-id');
    });

    it('should have correct static configuration values', () => {
      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config.validateIssuer).toBe(true);
      expect(config.passReqToCallback).toBe(true);
      expect(config.loggingLevel).toBe('error');
      expect(config.loggingNoPII).toBe(false);
      expect(config.allowMultiAudiencesInToken).toBe(false);
      expect(config.clockSkew).toBe(300);
    });
  });

  describe('createBearerStrategy', () => {
    it('should create a BearerStrategy instance', () => {
      createBearerStrategy();

      expect(BearerStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: expect.any(String),
          identityMetadata: expect.any(String)
        }),
        expect.any(Function)
      );
    });

    it('should pass config and callback to BearerStrategy', () => {
      createBearerStrategy();

      const mockBearerStrategy = BearerStrategy as jest.MockedClass<typeof BearerStrategy>;
      expect(mockBearerStrategy).toHaveBeenCalledTimes(1);
      
      const [config, callback] = mockBearerStrategy.mock.calls[0];
      expect(config).toHaveProperty('clientID');
      expect(config).toHaveProperty('identityMetadata');
      expect(typeof callback).toBe('function');
    });

    it('should handle token validation callback correctly', () => {
      createBearerStrategy();

      const mockBearerStrategy = BearerStrategy as jest.MockedClass<typeof BearerStrategy>;
      const [, callback] = mockBearerStrategy.mock.calls[0];

      const mockToken = {
        oid: 'user-object-id',
        preferred_username: 'user@example.com',
        name: 'Test User',
        tid: 'tenant-id',
        azp: 'client-id'
      };

      const done = jest.fn();
      // Cast callback to any to bypass TypeScript's inference
      (callback as any)({}, mockToken, done);

      expect(done).toHaveBeenCalledWith(null, mockToken, mockToken);
    });

    it('should pass request object in callback', () => {
      createBearerStrategy();

      const mockBearerStrategy = BearerStrategy as jest.MockedClass<typeof BearerStrategy>;
      const [, callback] = mockBearerStrategy.mock.calls[0];

      const mockReq = { headers: { authorization: 'Bearer token' } };
      const mockToken = { oid: 'user-id' };
      const done = jest.fn();

      // Cast callback to any to bypass TypeScript's inference
      (callback as any)(mockReq, mockToken, done);

      expect(done).toHaveBeenCalledWith(null, mockToken, mockToken);
    });

    it('should return the strategy instance', () => {
      const mockStrategyInstance = { name: 'bearer' };
      (BearerStrategy as jest.Mock).mockReturnValueOnce(mockStrategyInstance);

      const strategy = createBearerStrategy();

      expect(strategy).toBe(mockStrategyInstance);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty string environment variables', () => {
      process.env.AZURE_AD_TENANT_ID = '';
      process.env.AZURE_AD_CLIENT_ID = '';

      const { azureAdConfig: config } = require('../../config/azureAd');

      // Empty strings should be treated as falsy
      expect(config.clientID).toBe('dummy-client-id');
      expect(config.identityMetadata).toContain('/common/');
    });

    it('should handle whitespace in environment variables', () => {
      process.env.AZURE_AD_TENANT_ID = '  tenant-with-spaces  ';
      process.env.AZURE_AD_CLIENT_ID = '  client-with-spaces  ';

      const { azureAdConfig: config } = require('../../config/azureAd');

      // The config should use the values as-is (Azure AD will handle validation)
      expect(config.identityMetadata).toContain('/  tenant-with-spaces  /');
      expect(config.clientID).toBe('  client-with-spaces  ');
    });

    it('should handle special characters in tenant ID', () => {
      process.env.AZURE_AD_TENANT_ID = 'tenant-with-special-chars!@#';

      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config.identityMetadata).toContain('/tenant-with-special-chars!@#/');
      expect(config.issuer).toContain('/tenant-with-special-chars!@#/');
    });
  });

  describe('Type Safety', () => {
    it('should export correct types', () => {
      const { azureAdConfig: config } = require('../../config/azureAd');

      // Verify the config has the expected shape
      expect(typeof config.identityMetadata).toBe('string');
      expect(typeof config.clientID).toBe('string');
      expect(typeof config.validateIssuer).toBe('boolean');
      expect(typeof config.passReqToCallback).toBe('boolean');
      expect(typeof config.loggingLevel).toBe('string');
      expect(typeof config.loggingNoPII).toBe('boolean');
      expect(typeof config.allowMultiAudiencesInToken).toBe('boolean');
      expect(typeof config.clockSkew).toBe('number');
    });

    it('should have correct optional fields', () => {
      delete process.env.AZURE_AD_TENANT_ID;

      const { azureAdConfig: config } = require('../../config/azureAd');

      expect(config.issuer).toBeUndefined();
      expect(config.identityMetadata).toBeDefined();
      expect(config.clientID).toBeDefined();
    });
  });
});

/**
 * Test Coverage Summary:
 * ✓ Configuration object generation with defaults
 * ✓ Environment variable integration
 * ✓ Tenant ID handling (specific vs common)
 * ✓ Issuer URL generation
 * ✓ Client ID and audience configuration
 * ✓ Static configuration values
 * ✓ Bearer strategy creation
 * ✓ Token validation callback
 * ✓ Edge cases (empty strings, whitespace, special chars)
 * ✓ Type safety checks
 * 
 * Coverage: ~100% of azureAd.ts functionality
 */