import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import User from '../models/User';
import Fixture from '../models/Fixture';
import Match from '../models/Match';
import Team from '../models/Team';
import logger from '../utils/logger';

const router = express.Router();

// Get all players with search
router.get('/players', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    
    // Build query
    let query: any = { 
      role: { $in: ['player', 'captain', 'vicecaptain'] },
      isActive: true 
    };
    
    // Add search if provided
    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search as string, 'i') } },
        { displayName: { $regex: new RegExp(search as string, 'i') } },
        { email: { $regex: new RegExp(search as string, 'i') } }
      ];
    }
    
    // Get total count
    const totalCount = await User.countDocuments(query);
    
    // Get players with pagination
    const players = await User.find(query)
      .select('name email displayName role createdAt teamMemberships')
      .sort({ name: 1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .lean();
    
    // Get statistics for each player
    const playersWithStats = await Promise.all(players.map(async (player) => {
      // Get completed fixtures where this player participated
      const playerFixtures = await Fixture.countDocuments({
        participantType: 'player',
        participants: player._id,
        status: 'completed',
        isActive: true
      });
      
      // Get total matches
      const totalMatches = await Match.countDocuments({
        $or: [
          { homeParticipant: player._id },
          { awayParticipant: player._id },
          { homePartner: player._id },
          { awayPartner: player._id }
        ],
        status: 'completed'
      });
      
      // Get wins
      const wins = await Match.countDocuments({
        $or: [
          { winner: player._id },
          { winnerPartner: player._id }
        ],
        status: 'completed'
      });
      
      return {
        ...player,
        statistics: {
          activitiesPlayed: playerFixtures,
          totalMatches,
          wins,
          winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
        }
      };
    }));
    
    res.json({
      success: true,
      players: playersWithStats,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching players:', error);
    res.status(500).json({ 
      error: 'Failed to fetch players',
      details: error.message 
    });
  }
});

// Get player profile with activities and points
router.get('/players/:id/profile', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Get player details
    const player = await User.findById(id)
      .select('name email displayName role teamMemberships createdAt')
      .lean();
    
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    // Get all completed fixtures where this player participated
    const playerFixtures = await Fixture.find({
      participantType: 'player',
      participants: id,
      status: 'completed',
      isActive: true
    })
    .populate('eventId', 'name')
    .populate('sportGameId', 'title type points isDoubles')
    .lean();
    
    // Map to store player's achievements
    const achievements = new Map<string, {
      activityId: string;
      activityName: string;
      activityType: string;
      eventId: string;
      eventName: string;
      position: 1 | 2 | 3;
      points: number;
      isDoubles: boolean;
      partnerId?: string;
      partnerName?: string;
    }>();
    
    // Process each fixture to find player's rankings
    for (const fixture of playerFixtures) {
      const sportGame = fixture.sportGameId as any;
      const event = fixture.eventId as any;
      
      if (!sportGame || !sportGame.points) continue;
      
      // Get all matches for this fixture
      const matches = await Match.find({ 
        fixtureId: fixture._id,
        status: 'completed'
      }).lean();
      
      if (matches.length === 0) continue;
      
      // Determine player's ranking in this fixture
      let position: 1 | 2 | 3 | null = null;
      let partnerId: string | undefined;
      let partnerName: string | undefined;
      
      if (fixture.format === 'knockout') {
        // Find the highest round (final)
        const maxRound = Math.max(...matches.map(m => m.round));
        const finalMatch = matches.find(m => m.round === maxRound && !m.isThirdPlaceMatch);
        
        if (finalMatch) {
          // Check if player won the final (1st place)
          if (finalMatch.winner?.toString() === id) {
            position = 1;
            partnerId = finalMatch.winnerPartner?.toString();
          }
          // Check if player lost the final (2nd place)
          else if (
            (finalMatch.homeParticipant?.toString() === id || finalMatch.awayParticipant?.toString() === id) &&
            finalMatch.winner
          ) {
            position = 2;
            // Find partner from the match
            if (finalMatch.homeParticipant?.toString() === id) {
              partnerId = finalMatch.homePartner?.toString();
            } else {
              partnerId = finalMatch.awayPartner?.toString();
            }
          }
          
          // Check for 3rd place
          if (!position) {
            const thirdPlaceMatch = matches.find(m => m.isThirdPlaceMatch);
            if (thirdPlaceMatch && thirdPlaceMatch.winner?.toString() === id) {
              position = 3;
              partnerId = thirdPlaceMatch.winnerPartner?.toString();
            }
          }
        }
      } else if (fixture.format === 'roundrobin') {
        // For round-robin, calculate based on wins
        const standings = new Map<string, number>();
        
        // Count wins for all participants
        for (const participantId of fixture.participants) {
          const wins = matches.filter(m => m.winner?.toString() === participantId.toString()).length;
          standings.set(participantId.toString(), wins);
        }
        
        // Sort by wins
        const sortedStandings = Array.from(standings.entries())
          .sort((a, b) => b[1] - a[1]);
        
        // Find player's position
        const playerIndex = sortedStandings.findIndex(([pid]) => pid === id);
        if (playerIndex === 0) position = 1;
        else if (playerIndex === 1) position = 2;
        else if (playerIndex === 2) position = 3;
        
        // For doubles, find partner from matches
        if (sportGame.isDoubles && position) {
          const playerMatch = matches.find(m => 
            (m.homeParticipant?.toString() === id || m.awayParticipant?.toString() === id)
          );
          if (playerMatch) {
            if (playerMatch.homeParticipant?.toString() === id) {
              partnerId = playerMatch.homePartner?.toString();
            } else {
              partnerId = playerMatch.awayPartner?.toString();
            }
          }
        }
      }
      
      // Award points if player achieved a ranking position
      if (position && sportGame.points) {
        const points = position === 1 ? sportGame.points.first :
                      position === 2 ? sportGame.points.second :
                      sportGame.points.third;
        
        if (points > 0) {
          // Get partner name if doubles
          if (partnerId) {
            const partner = await User.findById(partnerId).select('name displayName').lean();
            partnerName = partner?.displayName || partner?.name;
          }
          
          const key = `${fixture._id}_${position}`;
          achievements.set(key, {
            activityId: sportGame._id.toString(),
            activityName: sportGame.title,
            activityType: sportGame.type,
            eventId: event._id.toString(),
            eventName: event.name,
            position,
            points,
            isDoubles: sportGame.isDoubles || false,
            partnerId,
            partnerName
          });
        }
      }
    }
    
    // Convert achievements to array and calculate totals
    const achievementsList = Array.from(achievements.values());
    const totalPoints = achievementsList.reduce((sum, a) => sum + a.points, 0);
    const firstPlaces = achievementsList.filter(a => a.position === 1).length;
    const secondPlaces = achievementsList.filter(a => a.position === 2).length;
    const thirdPlaces = achievementsList.filter(a => a.position === 3).length;
    
    // Get player's teams
    const playerTeams = await Team.find({
      $or: [
        { captainId: id },
        { viceCaptainId: id },
        { players: id }
      ],
      isActive: true
    })
    .populate('eventId', 'name')
    .select('name eventId')
    .lean();
    
    res.json({
      success: true,
      player: {
        ...player,
        teams: playerTeams
      },
      statistics: {
        totalPoints,
        firstPlaces,
        secondPlaces,
        thirdPlaces,
        totalActivities: achievementsList.length
      },
      achievements: achievementsList.sort((a, b) => b.points - a.points)
    });
  } catch (error: any) {
    logger.error('Error fetching player profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player profile',
      details: error.message 
    });
  }
});

// Get player's match history
router.get('/players/:id/matches', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;
    
    // Find all matches where player participated
    const matches = await Match.find({
      $or: [
        { homeParticipant: id },
        { awayParticipant: id },
        { homePartner: id },
        { awayPartner: id }
      ]
    })
    .populate({
      path: 'fixtureId',
      select: 'name eventId sportGameId format',
      populate: [
        { path: 'eventId', select: 'name' },
        { path: 'sportGameId', select: 'title type isDoubles' }
      ]
    })
    .populate('homeParticipant', 'name displayName')
    .populate('awayParticipant', 'name displayName')
    .populate('homePartner', 'name displayName')
    .populate('awayPartner', 'name displayName')
    .populate('winner', 'name displayName')
    .populate('winnerPartner', 'name displayName')
    .sort({ actualDate: -1, scheduledDate: -1 })
    .limit(parseInt(limit as string))
    .skip(parseInt(offset as string))
    .lean();
    
    // Get total count
    const totalCount = await Match.countDocuments({
      $or: [
        { homeParticipant: id },
        { awayParticipant: id },
        { homePartner: id },
        { awayPartner: id }
      ]
    });
    
    // Process matches to add player-specific info
    const processedMatches = matches.map(match => {
      const fixture = match.fixtureId as any;
      const isHome = match.homeParticipant?._id.toString() === id || 
                     match.homePartner?._id.toString() === id;
      const isWinner = match.winner?._id.toString() === id ||
                      match.winnerPartner?._id.toString() === id;
      
      return {
        ...match,
        playerSide: isHome ? 'home' : 'away',
        result: match.status === 'completed' ? 
          (isWinner ? 'won' : 'lost') : 
          match.status,
        fixture: fixture ? {
          name: fixture.name,
          eventName: fixture.eventId?.name,
          activityName: fixture.sportGameId?.title,
          format: fixture.format
        } : null
      };
    });
    
    res.json({
      success: true,
      matches: processedMatches,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching player matches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player matches',
      details: error.message 
    });
  }
});

export default router;