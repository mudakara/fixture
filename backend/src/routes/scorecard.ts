import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import Fixture from '../models/Fixture';
import Match from '../models/Match';
import Team from '../models/Team';
import User from '../models/User';
import logger from '../utils/logger';

const router = express.Router();

// Get team points scorecard
router.get('/scorecard/teams', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.query;
    
    // Build query for fixtures - include both team and player fixtures
    let fixtureQuery: any = {
      status: 'completed',
      isActive: true
    };
    
    if (eventId && eventId !== 'all') {
      fixtureQuery.eventId = eventId;
    }
    
    // First, let's check all fixtures regardless of status for debugging
    const allFixtures = await Fixture.find({
      isActive: true,
      ...(eventId && eventId !== 'all' ? { eventId } : {})
    }).select('name status participantType').lean();
    
    logger.info(`Total fixtures: ${allFixtures.length}`, {
      byStatus: allFixtures.reduce((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: allFixtures.reduce((acc, f) => {
        acc[f.participantType] = (acc[f.participantType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    // Get all completed fixtures (both team and player)
    const fixtures = await Fixture.find(fixtureQuery)
      .populate({
        path: 'sportGameId',
        select: 'title type points'
      })
      .populate('eventId')
      .lean();
    
    logger.info(`Found ${fixtures.length} completed team fixtures for scorecard calculation`);
    
    // Map to store team points
    const teamPointsMap = new Map<string, {
      teamId: string;
      teamName: string;
      eventId: string;
      eventName: string;
      totalPoints: number;
      breakdown: Array<{
        activityId: string;
        activityName: string;
        position: 1 | 2 | 3;
        points: number;
      }>;
    }>();
    
    // Process each fixture to calculate rankings
    for (const fixture of fixtures) {
      const sportGame = fixture.sportGameId as any;
      const event = fixture.eventId as any;
      
      logger.info(`Processing fixture: ${fixture.name}, sportGame: ${sportGame?.title}, points config:`, sportGame?.points);
      
      if (!sportGame || !sportGame.points) {
        logger.warn(`Skipping fixture ${fixture.name} - no sportGame or points configuration`);
        continue;
      }
      
      // Get all matches for this fixture
      const matches = await Match.find({ 
        fixtureId: fixture._id,
        status: 'completed'
      }).lean();
      
      if (matches.length === 0) continue;
      
      // Determine tournament rankings
      let rankings: { participantId: string; position: 1 | 2 | 3 }[] = [];
      
      if (fixture.format === 'knockout') {
        // For knockout tournaments
        // Find the highest round number (which is the final)
        const maxRound = Math.max(...matches.map(m => m.round));
        const finalMatch = matches.find(m => m.round === maxRound && !m.isThirdPlaceMatch);
        const semiFinalRound = maxRound - 1;
        const semiFinalMatches = matches.filter(m => m.round === semiFinalRound && !m.isThirdPlaceMatch);
        
        logger.info(`Fixture ${fixture.name}: format=${fixture.format}, totalMatches=${matches.length}, maxRound=${maxRound}, finalMatch found=${!!finalMatch}, semiFinals=${semiFinalMatches.length}`);
        
        if (finalMatch && finalMatch.winner) {
          // 1st place - winner of final
          rankings.push({
            participantId: finalMatch.winner.toString(),
            position: 1
          });
          
          // 2nd place - loser of final
          const runnerUp = finalMatch.homeParticipant?.toString() === finalMatch.winner.toString()
            ? finalMatch.awayParticipant?.toString()
            : finalMatch.homeParticipant?.toString();
            
          if (runnerUp) {
            rankings.push({
              participantId: runnerUp,
              position: 2
            });
          }
          
          // 3rd place - check for third place match or semi-final losers
          const thirdPlaceMatch = matches.find(m => m.isThirdPlaceMatch);
          if (thirdPlaceMatch && thirdPlaceMatch.winner) {
            rankings.push({
              participantId: thirdPlaceMatch.winner.toString(),
              position: 3
            });
          } else if (semiFinalMatches.length >= 2) {
            // Award 3rd place to both semi-final losers
            for (const match of semiFinalMatches) {
              if (match.winner) {
                const loser = match.homeParticipant?.toString() === match.winner.toString()
                  ? match.awayParticipant?.toString()
                  : match.homeParticipant?.toString();
                  
                if (loser && loser !== finalMatch.winner.toString() && loser !== runnerUp) {
                  rankings.push({
                    participantId: loser,
                    position: 3
                  });
                  break; // Only award to one team
                }
              }
            }
          }
        }
      } else if (fixture.format === 'roundrobin') {
        // For round-robin tournaments, calculate based on points/wins
        const standings = new Map<string, { wins: number; points: number }>();
        
        // Initialize standings
        for (const participantId of fixture.participants) {
          standings.set(participantId.toString(), { wins: 0, points: 0 });
        }
        
        // Calculate wins
        for (const match of matches) {
          if (match.winner) {
            const winnerStanding = standings.get(match.winner.toString());
            if (winnerStanding) {
              winnerStanding.wins++;
              winnerStanding.points += fixture.settings?.pointsForWin || 3;
            }
          } else if (match.homeScore === match.awayScore && match.homeScore !== undefined) {
            // Draw
            const homeStanding = standings.get(match.homeParticipant?.toString() || '');
            const awayStanding = standings.get(match.awayParticipant?.toString() || '');
            if (homeStanding) homeStanding.points += fixture.settings?.pointsForDraw || 1;
            if (awayStanding) awayStanding.points += fixture.settings?.pointsForDraw || 1;
          }
        }
        
        // Sort by points and wins
        const sortedTeams = Array.from(standings.entries())
          .sort((a, b) => {
            if (b[1].points !== a[1].points) return b[1].points - a[1].points;
            return b[1].wins - a[1].wins;
          });
        
        // Assign rankings
        if (sortedTeams[0]) rankings.push({ participantId: sortedTeams[0][0], position: 1 });
        if (sortedTeams[1]) rankings.push({ participantId: sortedTeams[1][0], position: 2 });
        if (sortedTeams[2]) rankings.push({ participantId: sortedTeams[2][0], position: 3 });
      }
      
      // Award points based on rankings
      logger.info(`Fixture ${fixture.name}: Found ${rankings.length} rankings, participantType: ${fixture.participantType}`);
      
      for (const ranking of rankings) {
        const points = ranking.position === 1 ? sportGame.points.first :
                      ranking.position === 2 ? sportGame.points.second :
                      sportGame.points.third;
        
        logger.info(`Awarding ${points} points for position ${ranking.position} to participant ${ranking.participantId}`);
        
        if (points > 0) {
          let team: any;
          let winnerName: string = '';
          
          // Check if this is a team or player fixture
          if (fixture.participantType === 'team') {
            // For team fixtures, the participant is already a team
            team = await Team.findById(ranking.participantId).lean();
            if (!team) {
              logger.warn(`Team ${ranking.participantId} not found`);
              continue;
            }
          } else if (fixture.participantType === 'player') {
            // For player fixtures, find the player's team for this event
            const player = await User.findById(ranking.participantId).lean();
            if (!player) {
              logger.warn(`Player ${ranking.participantId} not found`);
              continue;
            }
            
            winnerName = player.displayName || player.name;
            
            // Find player's team membership for this event
            const membership = player.teamMemberships.find(tm => 
              tm.eventId.toString() === event._id.toString()
            );
            
            if (!membership) {
              logger.warn(`Player ${player.name} has no team for event ${event.name}`);
              continue;
            }
            
            team = await Team.findById(membership.teamId).lean();
            if (!team) {
              logger.warn(`Team ${membership.teamId} not found for player ${player.name}`);
              continue;
            }
            
            logger.info(`Player ${player.name} from team ${team.name} won position ${ranking.position}`);
          }
          
          const key = `${team._id}_${event._id}`;
          let teamData = teamPointsMap.get(key);
          
          if (!teamData) {
            teamData = {
              teamId: team._id.toString(),
              teamName: team.name,
              eventId: event._id.toString(),
              eventName: event.name,
              totalPoints: 0,
              breakdown: []
            };
            teamPointsMap.set(key, teamData);
          }
          
          teamData.totalPoints += points;
          teamData.breakdown.push({
            activityId: sportGame._id.toString(),
            activityName: sportGame.title + (winnerName ? ` (${winnerName})` : ''),
            position: ranking.position,
            points
          });
        }
      }
    }
    
    // Convert map to array
    const teamPoints = Array.from(teamPointsMap.values());
    
    res.json({
      success: true,
      teamPoints,
      debug: {
        fixtureCount: fixtures.length,
        teamsProcessed: teamPointsMap.size,
        allFixtureStatuses: allFixtures.reduce((acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching team points:', error);
    res.status(500).json({ 
      error: 'Failed to fetch team points',
      details: error.message 
    });
  }
});

export default router;