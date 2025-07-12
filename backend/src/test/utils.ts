import jwt from 'jsonwebtoken';
import User from '../models/User';
import Event from '../models/Event';
import Team from '../models/Team';
import Fixture from '../models/Fixture';
import SportGame from '../models/SportGame';

export const createTestUser = async (overrides = {}): Promise<any> => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'player',
    authProvider: 'local',
    isActive: true,
    ...overrides
  };
  
  const user = await User.create(defaultUser);
  return user;
};

export const createTestEvent = async (creatorId: string, overrides = {}): Promise<any> => {
  const defaultEvent = {
    name: 'Test Event',
    description: 'Test event description',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
    createdBy: creatorId,
    isActive: true,
    ...overrides
  };
  
  const event = await Event.create(defaultEvent);
  return event;
};

export const createTestTeam = async (eventId: string, captainId: string, overrides = {}): Promise<any> => {
  const defaultTeam = {
    name: 'Test Team',
    eventId,
    captainId,
    players: [captainId],
    createdBy: captainId,
    isActive: true,
    ...overrides
  };
  
  const team = await Team.create(defaultTeam);
  return team;
};

export const createTestSportGame = async (creatorId: string, overrides = {}): Promise<any> => {
  const defaultSportGame = {
    title: 'Test Sport',
    type: 'sport',
    category: 'Team Sports',
    minPlayers: 2,
    maxPlayers: 10,
    points: {
      first: 3,
      second: 2,
      third: 1
    },
    createdBy: creatorId,
    isActive: true,
    ...overrides
  };
  
  const sportGame = await SportGame.create(defaultSportGame);
  return sportGame;
};

export const createTestFixture = async (
  eventId: string, 
  sportGameId: string, 
  creatorId: string, 
  participants: string[],
  overrides = {}
): Promise<any> => {
  const defaultFixture = {
    name: 'Test Fixture',
    eventId,
    sportGameId,
    format: 'knockout',
    participantType: 'player',
    participants,
    status: 'scheduled',
    settings: {
      randomizeSeeds: true,
      avoidSameTeamFirstRound: true
    },
    createdBy: creatorId,
    isActive: true,
    ...overrides
  };
  
  const fixture = await Fixture.create(defaultFixture);
  return fixture;
};

export const generateAuthToken = (userId: string, role = 'player') => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1d' }
  );
};

export const getAuthCookie = (userId: string, role = 'player') => {
  const token = generateAuthToken(userId, role);
  return `token=${token}`;
};