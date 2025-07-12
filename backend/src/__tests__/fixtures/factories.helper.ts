/**
 * Test Data Factories
 * 
 * These factories create consistent test data for use across all tests.
 * Use these instead of creating test data manually to ensure consistency.
 */

import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';

// User Factory
export const userFactory = (overrides = {}) => ({
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  password: 'TestPassword123!',
  role: 'player',
  isActive: true,
  authProvider: 'local',
  teamMemberships: [],
  ...overrides
});

// Event Factory
export const eventFactory = (creatorId: string, overrides = {}) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 37);
  
  return {
    name: `${faker.company.name()} Tournament ${faker.number.int({ min: 2024, max: 2025 })}`,
    description: faker.lorem.paragraph(),
    startDate: startDate,
    endDate: endDate,
    createdBy: creatorId,
    isActive: true,
    ...overrides
  };
};

// Team Factory
export const teamFactory = (eventId: string, captainId: string, overrides = {}) => ({
  name: `Team ${faker.animal.type()}`,
  eventId,
  captainId,
  viceCaptainId: new mongoose.Types.ObjectId(), // Will need to be replaced with actual user
  players: [captainId],
  createdBy: captainId,
  isActive: true,
  ...overrides
});

// SportGame Factory
export const sportGameFactory = (creatorId: string, overrides = {}) => ({
  title: faker.helpers.arrayElement(['Badminton', 'Table Tennis', 'Chess', 'Carrom', 'Football']),
  type: faker.helpers.arrayElement(['sport', 'game']),
  category: faker.helpers.arrayElement(['Indoor Sports', 'Outdoor Sports', 'Board Games']),
  description: faker.lorem.sentence(),
  minPlayers: 2,
  maxPlayers: faker.number.int({ min: 4, max: 22 }),
  points: {
    first: 3,
    second: 2,
    third: 1
  },
  isDoubles: false,
  hasMultipleSets: false,
  numberOfSets: 1,
  createdBy: creatorId,
  isActive: true,
  ...overrides
});

// Fixture Factory
export const fixtureFactory = (
  eventId: string,
  sportGameId: string,
  creatorId: string,
  participants: string[],
  overrides = {}
) => ({
  name: `${faker.helpers.arrayElement(['Knockout', 'League'])} Tournament`,
  description: faker.lorem.sentence(),
  eventId,
  sportGameId,
  format: 'knockout',
  participantType: 'player',
  participants,
  status: 'scheduled',
  settings: {
    randomizeSeeds: true,
    avoidSameTeamFirstRound: true,
    thirdPlaceMatch: false
  },
  createdBy: creatorId,
  isActive: true,
  ...overrides
});

// Match Factory
export const matchFactory = (fixtureId: string, overrides = {}) => {
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 7);
  
  return {
    fixtureId,
    round: 1,
    matchNumber: faker.number.int({ min: 1, max: 10 }),
    status: 'scheduled',
    scheduledDate: scheduledDate,
    ...overrides
  };
};

// Bulk User Creation
export const createBulkUsers = (count: number, role = 'player') => {
  return Array.from({ length: count }, () => userFactory({ role }));
};

// Tournament Participants
export const generateTournamentParticipants = (count: number) => {
  return Array.from({ length: count }, () => new mongoose.Types.ObjectId().toString());
};

// Match Results
export const generateMatchResult = () => ({
  homeScore: faker.number.int({ min: 0, max: 21 }),
  awayScore: faker.number.int({ min: 0, max: 21 }),
  status: 'completed',
  actualDate: new Date()
});

// Test Scenarios
export const scenarios = {
  // Create a complete tournament setup
  completeTournament: (participantCount = 8) => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const eventId = new mongoose.Types.ObjectId().toString();
    const sportGameId = new mongoose.Types.ObjectId().toString();
    const participants = generateTournamentParticipants(participantCount);
    
    return {
      admin: userFactory({ _id: adminId, role: 'admin' }),
      event: eventFactory(adminId, { _id: eventId }),
      sportGame: sportGameFactory(adminId, { _id: sportGameId }),
      fixture: fixtureFactory(eventId, sportGameId, adminId, participants),
      participants: participants.map(id => userFactory({ _id: id }))
    };
  },
  
  // Create a team with players
  teamWithPlayers: (playerCount = 5) => {
    const captainId = new mongoose.Types.ObjectId().toString();
    const viceCaptainId = new mongoose.Types.ObjectId().toString();
    const eventId = new mongoose.Types.ObjectId().toString();
    const players = [captainId, viceCaptainId];
    
    for (let i = 0; i < playerCount - 2; i++) {
      players.push(new mongoose.Types.ObjectId().toString());
    }
    
    return {
      captain: userFactory({ _id: captainId, role: 'captain' }),
      viceCaptain: userFactory({ _id: viceCaptainId, role: 'vicecaptain' }),
      team: teamFactory(eventId, captainId, { viceCaptainId, players }),
      players: players.map(id => userFactory({ _id: id }))
    };
  }
};