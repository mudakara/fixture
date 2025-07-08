import express, { Request, Response } from 'express';
import Fixture from '../models/Fixture';
import Match from '../models/Match';
import Event from '../models/Event';
import Team from '../models/Team';
import User from '../models/User';
import SportGame from '../models/SportGame';
import { authenticate } from '../middleware/auth';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const router = express.Router();

// Middleware to check if user can manage fixtures
const canManageFixtures = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'captain' || user.role === 'vicecaptain')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Insufficient privileges.' });
  }
};

// Helper function to shuffle array using Fisher-Yates algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  
  // First shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Double shuffle for better randomization
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

// Helper function to generate knockout bracket
const generateKnockoutBracket = async (fixtureId: string, participants: mongoose.Types.ObjectId[], randomizeSeeds: boolean = true) => {
  const totalParticipants = participants.length;
  const totalRounds = Math.ceil(Math.log2(totalParticipants));
  
  logger.info(`generateKnockoutBracket called with randomizeSeeds: ${randomizeSeeds}`);
  
  // Shuffle participants if randomizeSeeds is true
  let orderedParticipants = [...participants];
  
  // Log original order
  logger.info(`Original participant order: ${participants.map(p => p.toString()).join(', ')}`);
  
  if (randomizeSeeds) {
    orderedParticipants = shuffleArray(orderedParticipants);
    logger.info(`Randomized participant order: ${orderedParticipants.map(p => p.toString()).join(', ')}`);
  } else {
    logger.info(`Randomization disabled, keeping original order`);
  }
  
  // Create a tree structure to properly generate matches
  const matches: any[] = [];
  let matchNumber = 1;
  
  // Generate matches from first round to final
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = Math.pow(2, totalRounds - round);
    
    for (let i = 0; i < matchesInRound; i++) {
      const match = new Match({
        fixtureId,
        round,
        matchNumber: matchNumber++,
        status: 'scheduled'
      });
      
      // For first round, assign participants
      if (round === 1) {
        const homeIndex = i * 2;
        const awayIndex = i * 2 + 1;
        
        if (homeIndex < orderedParticipants.length) {
          match.homeParticipant = orderedParticipants[homeIndex];
        }
        if (awayIndex < orderedParticipants.length) {
          match.awayParticipant = orderedParticipants[awayIndex];
        }
        
        // Log first round matchups
        logger.info(`Round 1, Match ${i + 1}: ${match.homeParticipant?.toString() || 'BYE'} vs ${match.awayParticipant?.toString() || 'BYE'}`);
        
        // Handle bye (when one participant is missing)
        if (homeIndex < orderedParticipants.length && awayIndex >= orderedParticipants.length) {
          match.winner = orderedParticipants[homeIndex];
          match.status = 'walkover';
        }
      }
      
      matches.push(match);
    }
  }
  
  // Link matches properly - winners advance to next round
  let matchIndex = 0;
  for (let round = 1; round < totalRounds; round++) {
    const matchesInRound = Math.pow(2, totalRounds - round);
    
    for (let i = 0; i < matchesInRound; i++) {
      const currentMatch = matches[matchIndex + i];
      const nextMatchIndex = matchIndex + matchesInRound + Math.floor(i / 2);
      const nextMatch = matches[nextMatchIndex];
      
      if (currentMatch && nextMatch) {
        currentMatch.nextMatchId = nextMatch._id;
        
        if (!nextMatch.previousMatchIds) {
          nextMatch.previousMatchIds = [];
        }
        nextMatch.previousMatchIds.push(currentMatch._id);
      }
    }
    
    matchIndex += matchesInRound;
  }
  
  // Save all matches
  await Match.insertMany(matches);
  
  // Handle automatic advancement for walkover matches
  for (const match of matches) {
    if (match.status === 'walkover' && match.winner && match.nextMatchId) {
      const nextMatch = await Match.findById(match.nextMatchId);
      if (nextMatch) {
        // Determine if this match feeds into home or away position
        const previousMatchIndex = nextMatch.previousMatchIds?.indexOf(match._id);
        if (previousMatchIndex === 0) {
          nextMatch.homeParticipant = match.winner;
        } else if (previousMatchIndex === 1) {
          nextMatch.awayParticipant = match.winner;
        }
        await nextMatch.save();
      }
    }
  }
  
  return matches;
};

// Helper function to generate round-robin schedule
const generateRoundRobinSchedule = async (fixtureId: string, participants: mongoose.Types.ObjectId[], rounds: number = 1) => {
  const matches: any[] = [];
  let matchNumber = 1;
  
  for (let round = 1; round <= rounds; round++) {
    // Generate all combinations
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const match = new Match({
          fixtureId,
          round,
          matchNumber: matchNumber++,
          homeParticipant: participants[i],
          awayParticipant: participants[j],
          status: 'scheduled'
        });
        
        matches.push(match);
      }
    }
  }
  
  // Save all matches
  await Match.insertMany(matches);
  
  return matches;
};

// Create a new fixture
router.post('/', authenticate, canManageFixtures, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      eventId,
      sportGameId,
      format,
      participantType,
      participants,
      startDate,
      endDate,
      settings
    } = req.body;
    const user = (req as any).user;

    // Validate required fields
    if (!name || !eventId || !sportGameId || !format || !participantType || !participants || !startDate) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Validate event exists
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Validate sport/game exists
    const sportGame = await SportGame.findById(sportGameId);
    if (!sportGame || !sportGame.isActive) {
      res.status(404).json({ error: 'Sport/Game not found' });
      return;
    }

    // Validate participants exist
    if (participantType === 'team') {
      const teams = await Team.find({ _id: { $in: participants }, isActive: true });
      if (teams.length !== participants.length) {
        res.status(400).json({ error: 'Some teams not found or inactive' });
        return;
      }
    } else {
      const users = await User.find({ _id: { $in: participants }, isActive: true });
      if (users.length !== participants.length) {
        res.status(400).json({ error: 'Some users not found or inactive' });
        return;
      }
    }

    // Convert participants to ObjectIds if they're strings
    const participantObjectIds = participants.map((p: string | mongoose.Types.ObjectId) => 
      typeof p === 'string' ? new mongoose.Types.ObjectId(p) : p
    );

    // Create fixture
    const fixture = new Fixture({
      name,
      description,
      eventId,
      sportGameId,
      format,
      participantType,
      participants: participantObjectIds,
      startDate,
      endDate,
      settings: settings || {},
      createdBy: user._id
    });

    await fixture.save();

    // Generate matches based on format
    if (format === 'knockout') {
      logger.info(`Creating knockout bracket with settings:`, { 
        randomizeSeeds: settings?.randomizeSeeds,
        settingsObject: settings 
      });
      
      await generateKnockoutBracket(
        (fixture._id as mongoose.Types.ObjectId).toString(), 
        participantObjectIds, 
        settings?.randomizeSeeds !== false // Default to true if not specified
      );
    } else if (format === 'roundrobin') {
      await generateRoundRobinSchedule(
        (fixture._id as mongoose.Types.ObjectId).toString(),
        participantObjectIds,
        settings?.rounds || 1
      );
    }

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'create',
      entity: 'fixture',
      entityId: fixture._id,
      details: {
        name: fixture.name,
        format: fixture.format,
        participantType: fixture.participantType,
        participantCount: participants.length
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Fixture created', {
      userId: user._id,
      fixtureId: fixture._id,
      name: fixture.name
    });

    // Populate and return
    const populatedFixture = await Fixture.findById(fixture._id)
      .populate('eventId', 'name')
      .populate('sportGameId', 'title type')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      fixture: populatedFixture,
      message: format === 'knockout' && settings?.randomizeSeeds !== false 
        ? 'Fixture created with randomized bracket' 
        : 'Fixture created'
    });
  } catch (error: any) {
    logger.error('Error creating fixture:', error);
    res.status(500).json({ error: error.message || 'Failed to create fixture' });
  }
});

// Get all fixtures
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, sportGameId, format, participantType, status } = req.query;
    const user = (req as any).user;

    let query: any = { isActive: true };

    if (eventId) query.eventId = eventId;
    if (sportGameId) query.sportGameId = sportGameId;
    if (format) query.format = format;
    if (participantType) query.participantType = participantType;
    if (status) query.status = status;

    // For captains/vice-captains, only show fixtures they're involved in
    if (user.role === 'captain' || user.role === 'vicecaptain') {
      const userTeams = await Team.find({
        $or: [
          { captainId: user._id },
          { viceCaptainId: user._id }
        ],
        isActive: true
      });
      const teamIds = userTeams.map(t => t._id);
      
      query.$or = [
        { participants: user._id, participantType: 'player' },
        { participants: { $in: teamIds }, participantType: 'team' }
      ];
    }

    const fixtures = await Fixture.find(query)
      .populate('eventId', 'name startDate endDate')
      .populate('sportGameId', 'title type')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      fixtures
    });
  } catch (error: any) {
    logger.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Failed to fetch fixtures' });
  }
});

// Get single fixture with matches
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const fixture = await Fixture.findById(id)
      .populate('eventId', 'name startDate endDate')
      .populate('sportGameId', 'title type category')
      .populate('createdBy', 'name email');

    if (!fixture || !fixture.isActive) {
      res.status(404).json({ error: 'Fixture not found' });
      return;
    }

    // Get all matches for this fixture
    let matches;
    
    try {
      if (fixture.participantType === 'team') {
        matches = await Match.find({ fixtureId: id })
          .populate({
            path: 'homeParticipant',
            model: Team,
            select: 'name teamLogo'
          })
          .populate({
            path: 'awayParticipant',
            model: Team,
            select: 'name teamLogo'
          })
          .populate({
            path: 'winner',
            model: Team,
            select: 'name teamLogo'
          })
          .populate('nextMatchId')
          .sort({ round: 1, matchNumber: 1 });
      } else {
        matches = await Match.find({ fixtureId: id })
          .populate({
            path: 'homeParticipant',
            model: User,
            select: 'name email displayName teamMemberships',
            populate: {
              path: 'teamMemberships.teamId',
              select: 'name eventId',
              match: { eventId: fixture.eventId }
            }
          })
          .populate({
            path: 'awayParticipant',
            model: User,
            select: 'name email displayName teamMemberships',
            populate: {
              path: 'teamMemberships.teamId',
              select: 'name eventId',
              match: { eventId: fixture.eventId }
            }
          })
          .populate({
            path: 'winner',
            model: User,
            select: 'name email displayName teamMemberships',
            populate: {
              path: 'teamMemberships.teamId',
              select: 'name eventId',
              match: { eventId: fixture.eventId }
            }
          })
          .populate('nextMatchId')
          .sort({ round: 1, matchNumber: 1 });
      }
    } catch (popError: any) {
      logger.error('Error populating matches:', popError);
      matches = await Match.find({ fixtureId: id }).sort({ round: 1, matchNumber: 1 });
    }

    // Get participant details based on type
    let participantDetails = [];
    if (fixture.participantType === 'team') {
      participantDetails = await Team.find({ _id: { $in: fixture.participants } })
        .populate('captainId', 'name email')
        .populate('viceCaptainId', 'name email');
    } else {
      participantDetails = await User.find({ _id: { $in: fixture.participants } })
        .select('name email displayName teamMemberships')
        .populate({
          path: 'teamMemberships.teamId',
          select: 'name eventId',
          match: { eventId: fixture.eventId }
        });
    }

    res.json({
      success: true,
      fixture,
      matches,
      participants: participantDetails
    });
  } catch (error: any) {
    logger.error('Error fetching fixture details:', {
      error: error.message,
      stack: error.stack,
      fixtureId: req.params.id
    });
    res.status(500).json({ 
      error: 'Failed to fetch fixture details',
      message: error.message 
    });
  }
});

// Update match result
router.put('/:fixtureId/matches/:matchId', authenticate, canManageFixtures, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fixtureId, matchId } = req.params;
    const { homeScore, awayScore, status, notes, scoreDetails } = req.body;
    const user = (req as any).user;

    const match = await Match.findOne({ _id: matchId, fixtureId });
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Update match
    if (homeScore !== undefined) match.homeScore = homeScore;
    if (awayScore !== undefined) match.awayScore = awayScore;
    if (status) match.status = status;
    if (notes) match.notes = notes;
    if (scoreDetails) match.scoreDetails = scoreDetails;

    // Determine winner if match is completed
    if (status === 'completed') {
      // Determine winner if match is completed
      if (match.homeScore !== undefined && match.awayScore !== undefined) {
        if (match.homeScore > match.awayScore) {
          match.winner = match.homeParticipant;
          match.loser = match.awayParticipant;
        } else if (match.awayScore > match.homeScore) {
          match.winner = match.awayParticipant;
          match.loser = match.homeParticipant;
        }
        // In case of draw, winner might be determined by penalty shootout
        else if (match.scoreDetails?.penaltyShootout) {
          if (match.scoreDetails.penaltyShootout.homeScore > match.scoreDetails.penaltyShootout.awayScore) {
            match.winner = match.homeParticipant;
            match.loser = match.awayParticipant;
          } else {
            match.winner = match.awayParticipant;
            match.loser = match.homeParticipant;
          }
        }
      }
      match.actualDate = new Date();
      
      // If knockout, update next match
      if (match.winner && match.nextMatchId) {
        const nextMatch = await Match.findById(match.nextMatchId);
        if (nextMatch) {
          // Determine if winner goes to home or away position
          if (!nextMatch.homeParticipant) {
            nextMatch.homeParticipant = match.winner;
          } else if (!nextMatch.awayParticipant) {
            nextMatch.awayParticipant = match.winner;
          }
          await nextMatch.save();
        }
      }
    }

    await match.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'match',
      entityId: matchId,
      details: {
        fixtureId,
        status,
        homeScore,
        awayScore
      }
    });

    res.json({
      success: true,
      match
    });
  } catch (error: any) {
    logger.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Get fixture standings (for round-robin)
router.get('/:id/standings', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const fixture = await Fixture.findById(id);
    if (!fixture || fixture.format !== 'roundrobin') {
      res.status(400).json({ error: 'Standings only available for round-robin fixtures' });
      return;
    }

    const matches = await Match.find({ 
      fixtureId: id, 
      status: 'completed' 
    });

    // Calculate standings
    const standings = new Map();
    
    // Initialize standings for all participants
    fixture.participants.forEach(participant => {
      standings.set(participant.toString(), {
        participantId: participant,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      });
    });

    // Process matches
    matches.forEach(match => {
      if (match.homeParticipant && match.awayParticipant) {
        const homeStats = standings.get(match.homeParticipant.toString());
        const awayStats = standings.get(match.awayParticipant.toString());

        if (homeStats && awayStats) {
          homeStats.played++;
          awayStats.played++;
          homeStats.goalsFor += match.homeScore || 0;
          homeStats.goalsAgainst += match.awayScore || 0;
          awayStats.goalsFor += match.awayScore || 0;
          awayStats.goalsAgainst += match.homeScore || 0;

          if (match.winner) {
            if (match.winner.toString() === match.homeParticipant.toString()) {
              homeStats.won++;
              homeStats.points += fixture.settings.pointsForWin || 3;
              awayStats.lost++;
              awayStats.points += fixture.settings.pointsForLoss || 0;
            } else {
              awayStats.won++;
              awayStats.points += fixture.settings.pointsForWin || 3;
              homeStats.lost++;
              homeStats.points += fixture.settings.pointsForLoss || 0;
            }
          } else {
            // Draw
            homeStats.drawn++;
            awayStats.drawn++;
            homeStats.points += fixture.settings.pointsForDraw || 1;
            awayStats.points += fixture.settings.pointsForDraw || 1;
          }

          homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
          awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;
        }
      }
    });

    // Convert to array and sort
    const standingsArray = Array.from(standings.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return 0;
    });

    // Populate participant details
    if (fixture.participantType === 'team') {
      await Team.populate(standingsArray, { path: 'participantId', select: 'name teamLogo' });
    } else {
      await User.populate(standingsArray, { path: 'participantId', select: 'name email displayName' });
    }

    res.json({
      success: true,
      standings: standingsArray
    });
  } catch (error: any) {
    logger.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// Randomize knockout fixture
router.post('/:id/randomize', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Only super admin can randomize
    if (user.role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admins can randomize fixtures' });
      return;
    }

    const fixture = await Fixture.findById(id);
    if (!fixture || !fixture.isActive) {
      res.status(404).json({ error: 'Fixture not found' });
      return;
    }

    // Only allow randomization for knockout fixtures
    if (fixture.format !== 'knockout') {
      res.status(400).json({ error: 'Can only randomize knockout fixtures' });
      return;
    }

    // Check if any matches have been played
    const playedMatches = await Match.find({ 
      fixtureId: id, 
      status: { $in: ['completed', 'in_progress'] }
    });

    if (playedMatches.length > 0) {
      res.status(400).json({ error: 'Cannot randomize fixture with matches already played' });
      return;
    }

    // Delete existing matches
    await Match.deleteMany({ fixtureId: id });

    // Convert participants to ObjectIds if needed
    const participantObjectIds = fixture.participants.map((p: any) => 
      typeof p === 'string' ? new mongoose.Types.ObjectId(p) : p
    );

    // Regenerate bracket with new randomization
    await generateKnockoutBracket(
      id,
      participantObjectIds,
      true // Force randomization
    );

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'fixture',
      entityId: id,
      details: {
        action: 'randomized',
        fixtureName: fixture.name
      }
    });

    logger.info('Fixture randomized', {
      userId: user._id,
      fixtureId: id,
      fixtureName: fixture.name
    });

    res.json({
      success: true,
      message: 'Fixture randomized successfully'
    });
  } catch (error: any) {
    logger.error('Error randomizing fixture:', error);
    res.status(500).json({ error: 'Failed to randomize fixture' });
  }
});

// Delete fixture
router.delete('/:id', authenticate, canManageFixtures, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const fixture = await Fixture.findById(id);
    if (!fixture) {
      res.status(404).json({ error: 'Fixture not found' });
      return;
    }

    // Check if user can delete (only admins or creator)
    if (user.role !== 'super_admin' && user.role !== 'admin' && fixture.createdBy.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Soft delete
    fixture.isActive = false;
    await fixture.save();

    // Also deactivate all matches
    await Match.updateMany({ fixtureId: id }, { status: 'cancelled' });

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'delete',
      entity: 'fixture',
      entityId: id,
      details: {
        name: fixture.name
      }
    });

    res.json({
      success: true,
      message: 'Fixture deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting fixture:', error);
    res.status(500).json({ error: 'Failed to delete fixture' });
  }
});

export default router;