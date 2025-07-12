// Example test file showing how to write tests for the application
// This demonstrates the testing setup is working correctly

describe('Example Tests', () => {
  describe('Basic Math', () => {
    it('should add numbers correctly', () => {
      expect(1 + 1).toBe(2);
      expect(5 + 3).toBe(8);
    });

    it('should multiply numbers correctly', () => {
      expect(3 * 4).toBe(12);
      expect(0 * 100).toBe(0);
    });
  });

  describe('String Operations', () => {
    it('should concatenate strings', () => {
      expect('Hello' + ' ' + 'World').toBe('Hello World');
    });

    it('should convert to uppercase', () => {
      expect('test'.toUpperCase()).toBe('TEST');
    });
  });

  describe('Array Operations', () => {
    it('should filter arrays', () => {
      const numbers = [1, 2, 3, 4, 5];
      const evens = numbers.filter(n => n % 2 === 0);
      expect(evens).toEqual([2, 4]);
    });

    it('should map arrays', () => {
      const numbers = [1, 2, 3];
      const doubled = numbers.map(n => n * 2);
      expect(doubled).toEqual([2, 4, 6]);
    });
  });
});

// To write actual tests for your features:
// 1. Import the models/services you want to test
// 2. Use the test utilities from src/test/utils.ts
// 3. Follow the pattern: Arrange → Act → Assert
// 4. Test both success and failure cases
// 5. Use descriptive test names

// Example structure for a real test:
/*
import User from '../models/User';
import { createTestUser } from '../test/utils';

describe('User Model', () => {
  it('should create a user with valid data', async () => {
    const user = await createTestUser({
      email: 'test@example.com',
      name: 'Test User'
    });
    
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('player'); // default role
  });
  
  it('should hash password on save', async () => {
    const user = await createTestUser({
      password: 'plaintext'
    });
    
    expect(user.password).not.toBe('plaintext');
    expect(user.password?.length).toBeGreaterThan(20); // bcrypt hash
  });
});
*/