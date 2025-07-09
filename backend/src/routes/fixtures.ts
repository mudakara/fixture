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

// Helper function to arrange participants to avoid same team in first round
const arrangeParticipantsAvoidSameTeam = (
  participants: mongoose.Types.ObjectId[],
  playerToTeamMap: Map<string, string>,
  randomizeSeeds: boolean = true
): { arrangedParticipants: mongoose.Types.ObjectId[], hasImpossibleMatches: boolean } => {
  // Group players by team
  const teamGroups = new Map<string, mongoose.Types.ObjectId[]>();
  const playersWithoutTeam: mongoose.Types.ObjectId[] = [];
  
  for (const participant of participants) {
    const participantId = participant.toString();
    const teamId = playerToTeamMap.get(participantId);
    
    if (teamId) {
      if (!teamGroups.has(teamId)) {
        teamGroups.set(teamId, []);
      }
      teamGroups.get(teamId)!.push(participant);
    } else {
      playersWithoutTeam.push(participant);
    }
  }
  
  const arrangedParticipants: mongoose.Types.ObjectId[] = [];
  const teamArray = Array.from(teamGroups.entries());
  
  // Check if same-team avoidance is mathematically possible
  const totalPairs = Math.ceil(participants.length / 2);
  const teamsWithMultiplePlayers = teamArray.filter(([, players]) => players.length > 1);
  let hasImpossibleMatches = false;
  
  // If any team has more than totalPairs/2 players, perfect avoidance is impossible
  for (const [teamId, players] of teamsWithMultiplePlayers) {
    if (players.length > Math.ceil(totalPairs / 2)) {
      hasImpossibleMatches = true;
      logger.warn(`Team ${teamId} has ${players.length} players, which may result in same-team matches`);
    }
  }
  
  // Strategy: Create pairs ensuring different teams
  const usedPlayers = new Set<string>();
  const pairs: mongoose.Types.ObjectId[][] = [];
  
  // First, try to create pairs from different teams
  for (const [teamId, players] of teamArray) {
    for (const player of players) {
      if (usedPlayers.has(player.toString())) continue;
      
      // Find a player from a different team to pair with
      let paired = false;
      for (const [otherTeamId, otherPlayers] of teamArray) {
        if (otherTeamId === teamId) continue;
        
        for (const otherPlayer of otherPlayers) {
          if (usedPlayers.has(otherPlayer.toString())) continue;
          
          // Create a pair
          pairs.push([player, otherPlayer]);
          usedPlayers.add(player.toString());
          usedPlayers.add(otherPlayer.toString());
          paired = true;
          break;
        }
        if (paired) break;
      }
      
      // If couldn't pair with different team, try with players without team
      if (!paired && playersWithoutTeam.length > 0) {
        for (const noTeamPlayer of playersWithoutTeam) {
          if (usedPlayers.has(noTeamPlayer.toString())) continue;
          
          pairs.push([player, noTeamPlayer]);
          usedPlayers.add(player.toString());
          usedPlayers.add(noTeamPlayer.toString());
          paired = true;
          break;
        }
      }
    }
  }
  
  // Handle remaining players without teams
  const remainingNoTeamPlayers = playersWithoutTeam.filter(p => !usedPlayers.has(p.toString()));
  for (let i = 0; i < remainingNoTeamPlayers.length; i += 2) {
    if (i + 1 < remainingNoTeamPlayers.length) {
      pairs.push([remainingNoTeamPlayers[i], remainingNoTeamPlayers[i + 1]]);
      usedPlayers.add(remainingNoTeamPlayers[i].toString());
      usedPlayers.add(remainingNoTeamPlayers[i + 1].toString());
    }
  }
  
  // Handle remaining unpaired players (this will result in same-team matches)
  const remainingPlayers = participants.filter(p => !usedPlayers.has(p.toString()));
  for (let i = 0; i < remainingPlayers.length; i += 2) {
    if (i + 1 < remainingPlayers.length) {
      pairs.push([remainingPlayers[i], remainingPlayers[i + 1]]);
      hasImpossibleMatches = true;
      logger.warn(`Forced same-team pairing: ${remainingPlayers[i]} vs ${remainingPlayers[i + 1]}`);
    }
  }
  
  // Flatten pairs to create arranged participants list
  for (const pair of pairs) {
    arrangedParticipants.push(...pair);
  }
  
  // Add any remaining single player (will get a bye)
  const finalRemaining = participants.filter(p => !usedPlayers.has(p.toString()));
  arrangedParticipants.push(...finalRemaining);
  
  // Shuffle pairs if randomization is enabled
  if (randomizeSeeds && pairs.length > 0) {
    const shuffledPairs = shuffleArray(pairs);
    arrangedParticipants.length = 0; // Clear array
    for (const pair of shuffledPairs) {
      arrangedParticipants.push(...pair);
    }
    arrangedParticipants.push(...finalRemaining);
  }
  
  logger.info(`Arranged ${pairs.length} pairs, ${hasImpossibleMatches ? 'some' : 'no'} same-team matches`);
  
  return { arrangedParticipants, hasImpossibleMatches };
};

// Helper function to validate no same-team matches in round 1
const validateNoSameTeamMatches = (
  matches: any[],
  playerToTeamMap: Map<string, string>,
  participantType: 'player' | 'team'
): { isValid: boolean, violations: string[] } => {
  const violations: string[] = [];
  
  if (participantType !== 'player') {
    return { isValid: true, violations: [] };
  }
  
  const round1Matches = matches.filter(m => m.round === 1);
  
  for (const match of round1Matches) {
    if (match.homeParticipant && match.awayParticipant) {
      const homeTeam = playerToTeamMap.get(match.homeParticipant.toString());
      const awayTeam = playerToTeamMap.get(match.awayParticipant.toString());
      
      if (homeTeam && awayTeam && homeTeam === awayTeam) {
        violations.push(`Match ${match.matchNumber}: Players from same team (${homeTeam})`);
      }
    }
  }
  
  return { isValid: violations.length === 0, violations };
};

// Helper function to generate knockout bracket
const generateKnockoutBracket = async (
  fixtureId: string, 
  participants: mongoose.Types.ObjectId[], 
  eventId: mongoose.Types.ObjectId,
  participantType: 'player' | 'team',
  settings: any = {}
) => {
  const totalParticipants = participants.length;
  const { randomizeSeeds = true, avoidSameTeamFirstRound = true } = settings;
  
  logger.info(`generateKnockoutBracket called with settings:`, { 
    randomizeSeeds, 
    avoidSameTeamFirstRound,
    participantType,
    totalParticipants
  });
  
  let orderedParticipants = [...participants];
  
  // Log original order
  logger.info(`Original participant order: ${participants.map(p => p.toString()).join(', ')}`);
  
  // Declare playerToTeamMap at the top level for validation later
  let playerToTeamMap = new Map<string, string>();
  
  // If we need to avoid same team matchups for player fixtures
  if (participantType === 'player' && avoidSameTeamFirstRound) {
    // Get team memberships for all players
    const playersWithTeams = await User.find({
      _id: { $in: participants }
    }).select('_id teamMemberships').lean();
    
    // Create a map of player to team for this event
    playersWithTeams.forEach(player => {
      const membership = player.teamMemberships.find(tm => tm.eventId.toString() === eventId.toString());
      if (membership) {
        playerToTeamMap.set(player._id.toString(), membership.teamId.toString());
      }
    });
    
    logger.info(`Player to team mapping:`, Object.fromEntries(playerToTeamMap));
    
    // Try to arrange participants to avoid same team in first round
    const { arrangedParticipants, hasImpossibleMatches } = arrangeParticipantsAvoidSameTeam(participants, playerToTeamMap, randomizeSeeds);
    
    if (hasImpossibleMatches) {
      logger.warn(`Could not perfectly avoid same-team matches for player fixtures. Some matches might be forced.`);
      orderedParticipants = arrangedParticipants; // Use arranged participants even if forced
    } else {
      orderedParticipants = arrangedParticipants;
    }
  } else if (randomizeSeeds) {
    // Regular randomization for team fixtures or when avoidSameTeamFirstRound is false
    orderedParticipants = shuffleArray(orderedParticipants);
    logger.info(`Randomized participant order: ${orderedParticipants.map(p => p.toString()).join(', ')}`);
  } else {
    logger.info(`Randomization disabled, keeping original order`);
  }
  
  // Calculate proper bracket structure for knockout tournament
  // Find the next power of 2 that can accommodate all participants
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalParticipants)));
  const firstRoundByes = bracketSize - totalParticipants;
  const firstRoundParticipants = totalParticipants - firstRoundByes;
  const firstRoundRealMatches = Math.floor(firstRoundParticipants / 2);
  const playersAdvancingFromRound1 = firstRoundRealMatches + firstRoundByes;
  
  // Calculate total rounds needed (including round 1)
  const totalRounds = Math.ceil(Math.log2(bracketSize));
  
  logger.info(`Bracket structure:`, {
    totalParticipants,
    bracketSize,
    firstRoundByes,
    firstRoundParticipants,
    firstRoundRealMatches,
    playersAdvancingFromRound1,
    totalRounds
  });
  
  const matches: any[] = [];
  let matchNumber = 1;
  
  // Generate matches for all rounds
  for (let round = 1; round <= totalRounds; round++) {
    let matchesInRound: number;
    
    if (round === 1) {
      // Round 1: Only create matches for participants who don't get byes
      matchesInRound = firstRoundRealMatches;
    } else {
      // Subsequent rounds: Half the number of participants from previous round
      const participantsInThisRound = Math.pow(2, totalRounds - round + 1);
      matchesInRound = participantsInThisRound / 2;
    }
    
    logger.info(`Round ${round}: Creating ${matchesInRound} matches`);
    
    for (let i = 0; i < matchesInRound; i++) {
      const match = new Match({
        fixtureId,
        round,
        matchNumber: matchNumber++,
        status: 'scheduled'
      });
      
      // For first round, assign participants directly
      if (round === 1) {
        const homeIndex = i * 2;
        const awayIndex = i * 2 + 1;
        
        // Only assign participants who don't get byes
        // Participants with byes are handled separately
        const nonByeParticipants = orderedParticipants.slice(0, firstRoundParticipants);
        
        if (homeIndex < nonByeParticipants.length) {
          match.homeParticipant = nonByeParticipants[homeIndex];
        }
        if (awayIndex < nonByeParticipants.length) {
          match.awayParticipant = nonByeParticipants[awayIndex];
        }
        
        // Log first round matchups
        logger.info(`Round 1, Match ${match.matchNumber}: ${match.homeParticipant?.toString() || 'BYE'} vs ${match.awayParticipant?.toString() || 'BYE'}`);
        
        // Handle cases where we don't have enough participants for a full match
        if (match.homeParticipant && !match.awayParticipant) {
          match.winner = match.homeParticipant;
          match.status = 'walkover';
          logger.info(`Match ${match.matchNumber} is a walkover, winner: ${match.winner}`);
        }
      }
      
      matches.push(match);
    }
  }
  
  // Handle participants who get byes (advance directly to round 2)
  if (firstRoundByes > 0) {
    const byeParticipants = orderedParticipants.slice(firstRoundParticipants);
    logger.info(`Players receiving byes to Round 2: ${byeParticipants.map(p => p.toString()).join(', ')}`);
    
    // These participants will be automatically placed in round 2 matches
    // We'll handle this in the match linking phase
  }
  
  // Link matches properly - winners advance to next round
  let matchIndex = 0;
  for (let round = 1; round < totalRounds; round++) {
    const matchesInThisRound = round === 1 ? firstRoundRealMatches : Math.pow(2, totalRounds - round);
    
    for (let i = 0; i < matchesInThisRound; i++) {
      const currentMatch = matches[matchIndex + i];
      const nextMatchIndex = matchIndex + matchesInThisRound + Math.floor(i / 2);
      const nextMatch = matches[nextMatchIndex];
      
      if (currentMatch && nextMatch) {
        currentMatch.nextMatchId = nextMatch._id;
        
        if (!nextMatch.previousMatchIds) {
          nextMatch.previousMatchIds = [];
        }
        nextMatch.previousMatchIds.push(currentMatch._id);
      }
    }
    
    matchIndex += matchesInThisRound;
  }
  
  // Handle bye participants advancing to round 2
  if (firstRoundByes > 0) {
    const byeParticipants = orderedParticipants.slice(firstRoundParticipants);
    const round2Matches = matches.filter(m => m.round === 2);
    
    // Place bye participants in round 2 matches
    let byeIndex = 0;
    for (const round2Match of round2Matches) {
      if (byeIndex < byeParticipants.length) {
        if (!round2Match.homeParticipant) {
          round2Match.homeParticipant = byeParticipants[byeIndex++];
          logger.info(`Bye participant ${round2Match.homeParticipant} placed in Round 2, Match ${round2Match.matchNumber} (home)`);
        } else if (!round2Match.awayParticipant) {
          round2Match.awayParticipant = byeParticipants[byeIndex++];
          logger.info(`Bye participant ${round2Match.awayParticipant} placed in Round 2, Match ${round2Match.matchNumber} (away)`);
        }
      }
    }
  }
  
  // MANDATORY VALIDATION: Check for same-team matches in round 1
  if (participantType === 'player' && avoidSameTeamFirstRound) {
    const { isValid, violations } = validateNoSameTeamMatches(matches, playerToTeamMap, participantType);
    
    if (!isValid) {
      logger.error(`VALIDATION FAILED: Same-team matches detected in Round 1:`, violations);
      throw new Error(`Cannot create fixture: Same-team matches detected in Round 1. ${violations.join(', ')}`);
    } else {
      logger.info('✅ VALIDATION PASSED: No same-team matches in Round 1');
    }
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
const generateRoundRobinSchedule = async (
  fixtureId: string, 
  participants: mongoose.Types.ObjectId[], 
  eventId: mongoose.Types.ObjectId,
  participantType: 'player' | 'team',
  settings: any = {}
) => {
  const { rounds = 1, avoidSameTeamFirstRound = true } = settings;
  const matches: any[] = [];
  let matchNumber = 1;
  
  // For round-robin, we need to check same team for ALL rounds, not just first
  let playerToTeamMap = new Map<string, string>();
  
  if (participantType === 'player' && avoidSameTeamFirstRound) {
    // Get team memberships for all players
    const playersWithTeams = await User.find({
      _id: { $in: participants }
    }).select('_id teamMemberships').lean();
    
    // Create a map of player to team for this event
    playersWithTeams.forEach(player => {
      const membership = player.teamMemberships.find(tm => tm.eventId.toString() === eventId.toString());
      if (membership) {
        playerToTeamMap.set(player._id.toString(), membership.teamId.toString());
      }
    });
    
    logger.info(`Round-robin player to team mapping:`, Object.fromEntries(playerToTeamMap));
  }
  
  for (let round = 1; round <= rounds; round++) {
    // Generate all combinations
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const homeParticipant = participants[i];
        const awayParticipant = participants[j];
        
        // Check if both players are from the same team (skip if avoidSameTeamFirstRound is true)
        if (participantType === 'player' && avoidSameTeamFirstRound) {
          const homeTeam = playerToTeamMap.get(homeParticipant.toString());
          const awayTeam = playerToTeamMap.get(awayParticipant.toString());
          
          if (homeTeam && awayTeam && homeTeam === awayTeam) {
            logger.warn(`Skipping same team match in round-robin: ${homeParticipant.toString()} vs ${awayParticipant.toString()} (both from team ${homeTeam})`);
            continue; // Skip this match
          }
        }
        
        const match = new Match({
          fixtureId,
          round,
          matchNumber: matchNumber++,
          homeParticipant,
          awayParticipant,
          status: 'scheduled'
        });
        
        matches.push(match);
      }
    }
  }
  
  // MANDATORY VALIDATION: Check for same-team matches (all rounds for round-robin)
  if (participantType === 'player' && avoidSameTeamFirstRound) {
    const violations: string[] = [];
    
    for (const match of matches) {
      if (match.homeParticipant && match.awayParticipant) {
        const homeTeam = playerToTeamMap.get(match.homeParticipant.toString());
        const awayTeam = playerToTeamMap.get(match.awayParticipant.toString());
        
        if (homeTeam && awayTeam && homeTeam === awayTeam) {
          violations.push(`Round ${match.round}, Match ${match.matchNumber}: Players from same team (${homeTeam})`);
        }
      }
    }
    
    if (violations.length > 0) {
      logger.error(`VALIDATION FAILED: Same-team matches detected in round-robin:`, violations);
      throw new Error(`Cannot create fixture: Same-team matches detected. ${violations.join(', ')}`);
    } else {
      logger.info('✅ VALIDATION PASSED: No same-team matches in round-robin');
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
    if (!name || !eventId || !sportGameId || !format || !participantType || !participants) {
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

    // PRE-CREATION VALIDATION: Check if same-team avoidance is possible
    if (participantType === 'player' && settings?.avoidSameTeamFirstRound !== false) {
      const playersWithTeams = await User.find({
        _id: { $in: participantObjectIds }
      }).select('_id teamMemberships').lean();
      
      const teamCounts = new Map<string, number>();
      let playersWithoutTeam = 0;
      
      playersWithTeams.forEach(player => {
        const membership = player.teamMemberships.find(tm => tm.eventId.toString() === eventId);
        if (membership) {
          const teamId = membership.teamId.toString();
          teamCounts.set(teamId, (teamCounts.get(teamId) || 0) + 1);
        } else {
          playersWithoutTeam++;
        }
      });
      
      const totalPairs = Math.ceil(participantObjectIds.length / 2);
      const largestTeamSize = Math.max(...Array.from(teamCounts.values()), 0);
      
      if (largestTeamSize > Math.ceil(totalPairs / 2)) {
        logger.warn(`Pre-creation warning: Team with ${largestTeamSize} players may force same-team matches`);
        // Don't throw error, just warn - the algorithm will handle it
      }
      
      logger.info(`Pre-creation check: ${teamCounts.size} teams, largest team: ${largestTeamSize} players, ${playersWithoutTeam} without team`);
    }

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
        avoidSameTeamFirstRound: settings?.avoidSameTeamFirstRound,
        settingsObject: settings 
      });
      
      await generateKnockoutBracket(
        (fixture._id as mongoose.Types.ObjectId).toString(), 
        participantObjectIds, 
        event._id as mongoose.Types.ObjectId,
        participantType,
        settings
      );
    } else if (format === 'roundrobin') {
      await generateRoundRobinSchedule(
        (fixture._id as mongoose.Types.ObjectId).toString(),
        participantObjectIds,
        event._id as mongoose.Types.ObjectId,
        participantType,
        settings
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
      .populate('sportGameId', 'title type category isDoubles')
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
            select: 'name email displayName teamMemberships'
          })
          .populate({
            path: 'awayParticipant',
            model: User,
            select: 'name email displayName teamMemberships'
          })
          .populate({
            path: 'winner',
            model: User,
            select: 'name email displayName teamMemberships'
          })
          .populate({
            path: 'homePartner',
            model: User,
            select: 'name email displayName'
          })
          .populate({
            path: 'awayPartner',
            model: User,
            select: 'name email displayName'
          })
          .populate({
            path: 'winnerPartner',
            model: User,
            select: 'name email displayName'
          })
          .populate({
            path: 'loserPartner',
            model: User,
            select: 'name email displayName'
          })
          .populate('nextMatchId')
          .sort({ round: 1, matchNumber: 1 });
          
        // Manually populate team information for the specific event
        const teamIds = new Set<string>();
        const playerIds: string[] = [];
        
        // Collect all player IDs and their team IDs
        matches.forEach(match => {
          ['homeParticipant', 'awayParticipant', 'winner'].forEach(field => {
            const participant = (match as any)[field];
            if (participant && participant._id) {
              playerIds.push(participant._id.toString());
              if (participant.teamMemberships && Array.isArray(participant.teamMemberships)) {
                participant.teamMemberships.forEach((tm: any) => {
                  // Log for debugging
                  logger.info(`Team membership for ${participant.name}:`, {
                    tmEventId: tm.eventId?.toString(),
                    fixtureEventId: fixture.eventId.toString(),
                    teamId: tm.teamId?.toString()
                  });
                  
                  if (tm.eventId && tm.eventId.toString() === fixture.eventId.toString()) {
                    teamIds.add(tm.teamId.toString());
                  }
                });
              }
            }
          });
        });
        
        // Fetch all relevant teams for this event
        const teams = await Team.find({ 
          _id: { $in: Array.from(teamIds) }
        }).select('_id name');
        
        logger.info(`Found ${teams.length} teams for event ${fixture.eventId}:`, teams.map(t => ({ id: t._id, name: t.name })));
        
        const teamMap = new Map<string, any>();
        teams.forEach((team: any) => {
          teamMap.set(team._id.toString(), {
            _id: team._id,
            name: team.name
          });
        });
        
        // Process each match to attach team information
        matches = matches.map(match => {
          const matchObj = match.toObject();
          
          ['homeParticipant', 'awayParticipant', 'winner'].forEach(field => {
            const participant = (matchObj as any)[field];
            if (participant && participant.teamMemberships && Array.isArray(participant.teamMemberships)) {
              (matchObj as any)[field].teamMemberships = participant.teamMemberships.map((tm: any) => {
                const tmObj = tm.toObject ? tm.toObject() : tm;
                if (tmObj.eventId && tmObj.eventId.toString() === fixture.eventId.toString() && 
                    tmObj.teamId && teamMap.has(tmObj.teamId.toString())) {
                  return {
                    _id: tmObj._id,
                    eventId: tmObj.eventId,
                    role: tmObj.role,
                    joinedAt: tmObj.joinedAt,
                    teamId: teamMap.get(tmObj.teamId.toString())
                  };
                }
                return tmObj;
              });
            }
          });
          
          return matchObj;
        });
        
        // Debug: Log first match to see if team data is attached
        if (matches.length > 0 && matches[0].homeParticipant) {
          const participant = matches[0].homeParticipant as any;
          logger.info('First match home participant after team attachment:', {
            name: participant.name,
            teamMemberships: participant.teamMemberships
          });
        }
      }
    } catch (popError: any) {
      logger.error('Error populating matches:', popError);
      matches = await Match.find({ fixtureId: id }).sort({ round: 1, matchNumber: 1 });
    }

    // Get participant details based on type
    let participantDetails: any[] = [];
    let allEventPlayers: any[] = []; // For doubles fixtures, we need all players from teams
    
    if (fixture.participantType === 'team') {
      participantDetails = await Team.find({ _id: { $in: fixture.participants } })
        .populate('captainId', 'name email')
        .populate('viceCaptainId', 'name email');
    } else {
      participantDetails = await User.find({ _id: { $in: fixture.participants } })
        .select('name email displayName teamMemberships')
        .lean();
      
      // For doubles fixtures, get ALL players from the teams in this event
      const sportGame = await SportGame.findById(fixture.sportGameId);
      if (sportGame && sportGame.isDoubles) {
        // Get all teams in this event
        const eventTeams = await Team.find({ 
          eventId: fixture.eventId,
          isActive: true 
        }).select('_id name players');
        
        // Get all unique player IDs from these teams
        const allPlayerIds = new Set<string>();
        eventTeams.forEach((team: any) => {
          if (team.players && Array.isArray(team.players)) {
            team.players.forEach((playerId: any) => {
              allPlayerIds.add(playerId.toString());
            });
          }
        });
        
        // Fetch all these players
        allEventPlayers = await User.find({ 
          _id: { $in: Array.from(allPlayerIds) } 
        })
          .select('name email displayName teamMemberships')
          .lean();
        
        logger.info(`Loaded ${allEventPlayers.length} total event players for doubles fixture`);
      }
      
      // Manually populate team names for better control
      const eventTeams = await Team.find({ 
        eventId: fixture.eventId,
        isActive: true 
      }).select('_id name');
      
      const teamMap = new Map<string, string>();
      eventTeams.forEach((team: any) => {
        teamMap.set(team._id.toString(), team.name);
      });
      
      // Process participants to add team names
      participantDetails = participantDetails.map(participant => {
        if (participant.teamMemberships && Array.isArray(participant.teamMemberships)) {
          participant.teamMemberships = participant.teamMemberships.map((tm: any) => ({
            ...tm,
            teamId: tm.teamId,
            teamName: teamMap.get(tm.teamId?.toString()) || null
          }));
        }
        return participant;
      });
      
      // Also process all event players if this is doubles
      if (allEventPlayers.length > 0) {
        allEventPlayers = allEventPlayers.map(player => {
          if (player.teamMemberships && Array.isArray(player.teamMemberships)) {
            player.teamMemberships = player.teamMemberships.map((tm: any) => ({
              ...tm,
              teamId: tm.teamId,
              teamName: teamMap.get(tm.teamId?.toString()) || null
            }));
          }
          return player;
        });
      }
      
      logger.info(`Loaded ${participantDetails.length} participants for fixture ${fixture._id}`);
    }

    res.json({
      success: true,
      fixture,
      matches,
      participants: participantDetails,
      allEventPlayers: allEventPlayers // Include all event players for doubles
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
      // Use the model's determineWinner method which handles partners
      match.determineWinner();
      match.actualDate = new Date();
      
      // If knockout, update next match
      if (match.winner && match.nextMatchId) {
        const nextMatch = await Match.findById(match.nextMatchId);
        if (nextMatch) {
          // Determine if winner goes to home or away position
          if (!nextMatch.homeParticipant) {
            nextMatch.homeParticipant = match.winner;
            // Also set partner if this is a doubles match
            if (match.winnerPartner) {
              nextMatch.homePartner = match.winnerPartner;
            }
          } else if (!nextMatch.awayParticipant) {
            nextMatch.awayParticipant = match.winner;
            // Also set partner if this is a doubles match
            if (match.winnerPartner) {
              nextMatch.awayPartner = match.winnerPartner;
            }
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

// Update match participants (for drag and drop editing)
router.put('/:fixtureId/matches/:matchId/participants', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fixtureId, matchId } = req.params;
    const { homeParticipant, awayParticipant } = req.body;
    const user = (req as any).user;

    // Check if user is super admin
    if (user?.role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admins can edit match participants' });
      return;
    }

    // Find the match
    const match = await Match.findOne({ _id: matchId, fixtureId });
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Update participants
    if (homeParticipant !== undefined) {
      match.homeParticipant = homeParticipant;
    }
    if (awayParticipant !== undefined) {
      match.awayParticipant = awayParticipant;
    }

    // Clear scores and winner if participants changed
    if (homeParticipant !== undefined || awayParticipant !== undefined) {
      match.homeScore = undefined;
      match.awayScore = undefined;
      match.winner = undefined;
      match.loser = undefined;
      match.status = 'scheduled';
    }

    await match.save();

    // Create audit log
    await AuditLog.create({
      userId: user.userId,
      action: 'update',
      resource: 'match',
      resourceId: matchId,
      details: {
        field: 'participants',
        fixtureId,
        homeParticipant,
        awayParticipant
      }
    });

    // Populate and return the updated match
    const updatedMatch = await Match.findById(matchId)
      .populate('homeParticipant', 'name email displayName')
      .populate('awayParticipant', 'name email displayName');

    res.json({ success: true, match: updatedMatch });
  } catch (error: any) {
    logger.error('Error updating match participants:', error);
    res.status(500).json({ error: 'Failed to update match participants' });
  }
});

// Update match partners (for doubles)
router.put('/:fixtureId/matches/:matchId/partners', authenticate, canManageFixtures, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fixtureId, matchId } = req.params;
    const { homePartner, awayPartner } = req.body;
    const user = (req as any).user;

    const match = await Match.findOne({ _id: matchId, fixtureId });
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Check if fixture is for doubles
    const fixture = await Fixture.findById(fixtureId).populate('sportGameId');
    if (!fixture) {
      res.status(404).json({ error: 'Fixture not found' });
      return;
    }

    const sportGame = fixture.sportGameId as any;
    if (!sportGame?.isDoubles) {
      res.status(400).json({ error: 'This fixture is not for doubles' });
      return;
    }

    // Update partners
    if (homePartner !== undefined) {
      match.homePartner = homePartner || undefined;
    }
    if (awayPartner !== undefined) {
      match.awayPartner = awayPartner || undefined;
    }

    // If match is completed and has partners, update winner/loser partners
    if (match.status === 'completed' && match.winner) {
      if (match.winner.toString() === match.homeParticipant?.toString()) {
        match.winnerPartner = match.homePartner;
        match.loserPartner = match.awayPartner;
      } else if (match.winner.toString() === match.awayParticipant?.toString()) {
        match.winnerPartner = match.awayPartner;
        match.loserPartner = match.homePartner;
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
        partnersUpdated: true,
        homePartner,
        awayPartner
      }
    });

    res.json({
      success: true,
      match
    });
  } catch (error: any) {
    logger.error('Error updating match partners:', error);
    res.status(500).json({ error: 'Failed to update match partners' });
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
      fixture.eventId,
      fixture.participantType,
      fixture.settings
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