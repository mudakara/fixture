/**
 * SportGame Model Tests
 * 
 * Tests for SportGame.ts model including:
 * - Schema validation
 * - Field constraints and defaults
 * - Pre-save hooks for validation
 * - Unique title constraint
 * - Sets configuration logic
 * - Points configuration
 * - Indexes creation
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import SportGame from '../../models/SportGame';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoServer.stop();
});

describe('SportGame Model', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  
  afterEach(async () => {
    await SportGame.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a sport game with valid required fields', async () => {
      const sportGameData = {
        title: 'Basketball',
        type: 'sport' as const,
        createdBy: mockUserId
      };

      const sportGame = new SportGame(sportGameData);
      const savedGame = await sportGame.save();

      expect(savedGame._id).toBeDefined();
      expect(savedGame.title).toBe('Basketball');
      expect(savedGame.type).toBe('sport');
      expect(savedGame.createdBy).toEqual(mockUserId);
      expect(savedGame.isActive).toBe(true);
      expect(savedGame.isDoubles).toBe(false);
      expect(savedGame.hasMultipleSets).toBe(false);
      expect(savedGame.numberOfSets).toBe(1);
      expect(savedGame.points?.first).toBe(0);
      expect(savedGame.points?.second).toBe(0);
      expect(savedGame.points?.third).toBe(0);
      expect(savedGame.createdAt).toBeDefined();
      expect(savedGame.updatedAt).toBeDefined();
    });

    it('should create a game with all optional fields', async () => {
      const sportGameData = {
        title: 'Chess Tournament',
        description: 'Strategic board game competition',
        type: 'game' as const,
        category: 'Board Games',
        rules: 'Standard FIDE rules apply',
        minPlayers: 2,
        maxPlayers: 2,
        duration: 60,
        venue: 'Game Room',
        equipment: ['Chess board', 'Chess pieces', 'Chess clock'],
        image: 'chess.jpg',
        isDoubles: false,
        hasMultipleSets: true,
        numberOfSets: 3,
        points: {
          first: 10,
          second: 5,
          third: 3
        },
        isActive: true,
        createdBy: mockUserId
      };

      const sportGame = new SportGame(sportGameData);
      const savedGame = await sportGame.save();

      expect(savedGame.description).toBe('Strategic board game competition');
      expect(savedGame.category).toBe('Board Games');
      expect(savedGame.rules).toBe('Standard FIDE rules apply');
      expect(savedGame.minPlayers).toBe(2);
      expect(savedGame.maxPlayers).toBe(2);
      expect(savedGame.duration).toBe(60);
      expect(savedGame.venue).toBe('Game Room');
      expect(savedGame.equipment).toEqual(['Chess board', 'Chess pieces', 'Chess clock']);
      expect(savedGame.image).toBe('chess.jpg');
      expect(savedGame.hasMultipleSets).toBe(true);
      expect(savedGame.numberOfSets).toBe(3);
      expect(savedGame.points?.first).toBe(10);
      expect(savedGame.points?.second).toBe(5);
      expect(savedGame.points?.third).toBe(3);
    });

    it('should require title', async () => {
      const sportGame = new SportGame({
        type: 'sport',
        createdBy: mockUserId
      });

      await expect(sportGame.save()).rejects.toThrow('title');
    });

    it('should require type', async () => {
      const sportGame = new SportGame({
        title: 'Tennis',
        createdBy: mockUserId
      });

      await expect(sportGame.save()).rejects.toThrow('type');
    });

    it('should require createdBy', async () => {
      const sportGame = new SportGame({
        title: 'Tennis',
        type: 'sport'
      });

      await expect(sportGame.save()).rejects.toThrow('createdBy');
    });

    it('should enforce valid type values', async () => {
      const sportGame = new SportGame({
        title: 'Invalid Type',
        type: 'invalid' as any,
        createdBy: mockUserId
      });

      await expect(sportGame.save()).rejects.toThrow('invalid');
    });

    it('should trim string fields', async () => {
      const sportGame = new SportGame({
        title: '  Badminton  ',
        description: '  Racquet sport  ',
        category: '  Racquet Sports  ',
        venue: '  Indoor Court  ',
        equipment: ['  Racquet  ', '  Shuttlecock  '],
        type: 'sport',
        createdBy: mockUserId
      });

      const savedGame = await sportGame.save();
      expect(savedGame.title).toBe('Badminton');
      expect(savedGame.description).toBe('Racquet sport');
      expect(savedGame.category).toBe('Racquet Sports');
      expect(savedGame.venue).toBe('Indoor Court');
      expect(savedGame.equipment).toEqual(['Racquet', 'Shuttlecock']);
    });

    it('should enforce unique title constraint', async () => {
      await SportGame.create({
        title: 'Unique Sport',
        type: 'sport',
        createdBy: mockUserId
      });

      const duplicate = new SportGame({
        title: 'Unique Sport',
        type: 'game',
        createdBy: mockUserId
      });

      await expect(duplicate.save()).rejects.toThrow();
    });

    it('should enforce minimum values', async () => {
      const sportGame = new SportGame({
        title: 'Min Values Test',
        type: 'sport',
        createdBy: mockUserId,
        minPlayers: 0,
        maxPlayers: 0,
        duration: 0,
        numberOfSets: 0,
        points: {
          first: -1,
          second: -1,
          third: -1
        }
      });

      const errors = sportGame.validateSync();
      expect(errors?.errors).toHaveProperty('minPlayers');
      expect(errors?.errors).toHaveProperty('maxPlayers');
      expect(errors?.errors).toHaveProperty('duration');
      expect(errors?.errors).toHaveProperty('numberOfSets');
      // Points validation errors use dot notation in the error path
      expect(errors?.errors['points.first']).toBeDefined();
      expect(errors?.errors['points.second']).toBeDefined();
      expect(errors?.errors['points.third']).toBeDefined();
    });

    it('should enforce maximum numberOfSets', async () => {
      const sportGame = new SportGame({
        title: 'Max Sets Test',
        type: 'sport',
        createdBy: mockUserId,
        hasMultipleSets: true,
        numberOfSets: 6
      });

      const errors = sportGame.validateSync();
      expect(errors?.errors).toHaveProperty('numberOfSets');
    });
  });

  describe('Pre-save Validation', () => {
    it('should validate maxPlayers >= minPlayers', async () => {
      const sportGame = new SportGame({
        title: 'Invalid Players',
        type: 'sport',
        createdBy: mockUserId,
        minPlayers: 10,
        maxPlayers: 5
      });

      await expect(sportGame.save()).rejects.toThrow('Maximum players must be greater than or equal to minimum players');
    });

    it('should allow maxPlayers equal to minPlayers', async () => {
      const sportGame = new SportGame({
        title: 'Equal Players',
        type: 'sport',
        createdBy: mockUserId,
        minPlayers: 4,
        maxPlayers: 4
      });

      const savedGame = await sportGame.save();
      expect(savedGame.minPlayers).toBe(4);
      expect(savedGame.maxPlayers).toBe(4);
    });

    it('should validate numberOfSets when hasMultipleSets is true', async () => {
      const sportGame = new SportGame({
        title: 'Invalid Sets',
        type: 'sport',
        createdBy: mockUserId,
        hasMultipleSets: true,
        numberOfSets: 0
      });

      await expect(sportGame.save()).rejects.toThrow('numberOfSets');
    });

    it('should validate numberOfSets maximum when hasMultipleSets is true', async () => {
      const sportGame = new SportGame({
        title: 'Too Many Sets',
        type: 'sport',
        createdBy: mockUserId,
        hasMultipleSets: true,
        numberOfSets: 6
      });

      await expect(sportGame.save()).rejects.toThrow('numberOfSets');
    });

    it('should reset numberOfSets to 1 when hasMultipleSets is false', async () => {
      const sportGame = new SportGame({
        title: 'Reset Sets',
        type: 'sport',
        createdBy: mockUserId,
        hasMultipleSets: false,
        numberOfSets: 5
      });

      const savedGame = await sportGame.save();
      expect(savedGame.numberOfSets).toBe(1);
    });

    it('should allow valid numberOfSets when hasMultipleSets is true', async () => {
      const validSetNumbers = [1, 2, 3, 4, 5];
      
      for (const sets of validSetNumbers) {
        const sportGame = new SportGame({
          title: `Valid Sets ${sets}`,
          type: 'sport',
          createdBy: mockUserId,
          hasMultipleSets: true,
          numberOfSets: sets
        });

        const savedGame = await sportGame.save();
        expect(savedGame.numberOfSets).toBe(sets);
        
        await savedGame.deleteOne();
      }
    });

    it('should handle undefined numberOfSets when hasMultipleSets is true', async () => {
      const sportGame = new SportGame({
        title: 'Undefined Sets',
        type: 'sport',
        createdBy: mockUserId,
        hasMultipleSets: true
      });

      // numberOfSets defaults to 1, which is valid, so this should succeed
      const savedGame = await sportGame.save();
      expect(savedGame.numberOfSets).toBe(1);
    });
  });

  describe('Doubles Configuration', () => {
    it('should create doubles sport', async () => {
      const sportGame = new SportGame({
        title: 'Doubles Tennis',
        type: 'sport',
        createdBy: mockUserId,
        isDoubles: true,
        minPlayers: 4,
        maxPlayers: 4
      });

      const savedGame = await sportGame.save();
      expect(savedGame.isDoubles).toBe(true);
      expect(savedGame.minPlayers).toBe(4);
      expect(savedGame.maxPlayers).toBe(4);
    });

    it('should default isDoubles to false', async () => {
      const sportGame = new SportGame({
        title: 'Singles Sport',
        type: 'sport',
        createdBy: mockUserId
      });

      const savedGame = await sportGame.save();
      expect(savedGame.isDoubles).toBe(false);
    });
  });

  describe('Points Configuration', () => {
    it('should have default points of 0', async () => {
      const sportGame = new SportGame({
        title: 'No Points',
        type: 'sport',
        createdBy: mockUserId
      });

      const savedGame = await sportGame.save();
      expect(savedGame.points?.first).toBe(0);
      expect(savedGame.points?.second).toBe(0);
      expect(savedGame.points?.third).toBe(0);
    });

    it('should allow custom points configuration', async () => {
      const sportGame = new SportGame({
        title: 'Custom Points',
        type: 'sport',
        createdBy: mockUserId,
        points: {
          first: 25,
          second: 15,
          third: 10
        }
      });

      const savedGame = await sportGame.save();
      expect(savedGame.points?.first).toBe(25);
      expect(savedGame.points?.second).toBe(15);
      expect(savedGame.points?.third).toBe(10);
    });

    it('should allow partial points configuration', async () => {
      const sportGame = new SportGame({
        title: 'Partial Points',
        type: 'sport',
        createdBy: mockUserId,
        points: {
          first: 20
        } as any
      });

      const savedGame = await sportGame.save();
      expect(savedGame.points?.first).toBe(20);
      expect(savedGame.points?.second).toBe(0); // default
      expect(savedGame.points?.third).toBe(0); // default
    });
  });

  describe('Index Creation', () => {
    it('should create unique index on title', async () => {
      const indexes = await SportGame.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      const hasTitleIndex = indexNames.some(name => name.includes('title'));
      expect(hasTitleIndex).toBe(true);
    });

    it('should create index on type', async () => {
      const indexes = await SportGame.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      const hasTypeIndex = indexNames.some(name => name.includes('type'));
      expect(hasTypeIndex).toBe(true);
    });

    it('should create index on category', async () => {
      const indexes = await SportGame.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      const hasCategoryIndex = indexNames.some(name => name.includes('category'));
      expect(hasCategoryIndex).toBe(true);
    });

    it('should create index on isActive', async () => {
      const indexes = await SportGame.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      const hasActiveIndex = indexNames.some(name => name.includes('isActive'));
      expect(hasActiveIndex).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty equipment array', async () => {
      const sportGame = new SportGame({
        title: 'No Equipment',
        type: 'sport',
        createdBy: mockUserId,
        equipment: []
      });

      const savedGame = await sportGame.save();
      expect(savedGame.equipment).toEqual([]);
    });

    it('should handle large equipment array', async () => {
      const equipment = Array.from({ length: 50 }, (_, i) => `Equipment ${i + 1}`);
      
      const sportGame = new SportGame({
        title: 'Many Equipment',
        type: 'sport',
        createdBy: mockUserId,
        equipment
      });

      const savedGame = await sportGame.save();
      expect(savedGame.equipment).toHaveLength(50);
    });

    it('should handle very long duration', async () => {
      const sportGame = new SportGame({
        title: 'Marathon',
        type: 'sport',
        createdBy: mockUserId,
        duration: 9999
      });

      const savedGame = await sportGame.save();
      expect(savedGame.duration).toBe(9999);
    });

    it('should handle undefined optional fields', async () => {
      const sportGame = new SportGame({
        title: 'Minimal',
        type: 'sport',
        createdBy: mockUserId,
        description: undefined,
        category: undefined,
        rules: undefined,
        minPlayers: undefined,
        maxPlayers: undefined
      });

      const savedGame = await sportGame.save();
      expect(savedGame.description).toBeUndefined();
      expect(savedGame.category).toBeUndefined();
      expect(savedGame.rules).toBeUndefined();
      expect(savedGame.minPlayers).toBeUndefined();
      expect(savedGame.maxPlayers).toBeUndefined();
    });

    it('should handle minPlayers without maxPlayers', async () => {
      const sportGame = new SportGame({
        title: 'Min Only',
        type: 'sport',
        createdBy: mockUserId,
        minPlayers: 2
      });

      const savedGame = await sportGame.save();
      expect(savedGame.minPlayers).toBe(2);
      expect(savedGame.maxPlayers).toBeUndefined();
    });

    it('should handle maxPlayers without minPlayers', async () => {
      const sportGame = new SportGame({
        title: 'Max Only',
        type: 'sport',
        createdBy: mockUserId,
        maxPlayers: 10
      });

      const savedGame = await sportGame.save();
      expect(savedGame.minPlayers).toBeUndefined();
      expect(savedGame.maxPlayers).toBe(10);
    });

    it('should handle updating hasMultipleSets from true to false', async () => {
      const sportGame = await SportGame.create({
        title: 'Toggle Sets',
        type: 'sport',
        createdBy: mockUserId,
        hasMultipleSets: true,
        numberOfSets: 5
      });

      sportGame.hasMultipleSets = false;
      const savedGame = await sportGame.save();
      
      expect(savedGame.hasMultipleSets).toBe(false);
      expect(savedGame.numberOfSets).toBe(1);
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case sensitive for unique title', async () => {
      await SportGame.create({
        title: 'football',
        type: 'sport',
        createdBy: mockUserId
      });

      const upperCase = new SportGame({
        title: 'FOOTBALL',
        type: 'sport',
        createdBy: mockUserId
      });

      // MongoDB by default is case sensitive for unique constraints
      const savedGame = await upperCase.save();
      expect(savedGame.title).toBe('FOOTBALL');
    });
  });
});

/**
 * Test Coverage Summary:
 * ✓ Schema validation for required and optional fields
 * ✓ Field constraints (min/max values, enums, unique)
 * ✓ Default values (isActive, isDoubles, hasMultipleSets, points)
 * ✓ Pre-save validation hooks
 * ✓ Player count validation (max >= min)
 * ✓ Sets configuration logic
 * ✓ Points configuration with defaults
 * ✓ String trimming for relevant fields
 * ✓ Index creation verification
 * ✓ Edge cases and error handling
 * ✓ Doubles configuration
 * 
 * Coverage: ~100% of SportGame.ts functionality
 */