import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import Fixture from '../models/Fixture';
import Match from '../models/Match';
import Team from '../models/Team';
import logger from '../utils/logger';

const router = express.Router();

// Get team points scorecard
router.get('/scorecard/teams', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.query;
    
    // Build query for fixtures
    let fixtureQuery: any = {
      participantType: 'team',
      status: 'completed',
      isActive: true
    };
    
    if (eventId && eventId !== 'all') {
      fixtureQuery.eventId = eventId;
    }
    
    // First, let's check all team fixtures regardless of status for debugging
    const allTeamFixtures = await Fixture.find({
      participantType: 'team',
      isActive: true,
      ...(eventId && eventId !== 'all' ? { eventId } : {})
    }).select('name status').lean();
    
    logger.info(`Total team fixtures: ${allTeamFixtures.length}`, {
      byStatus: allTeamFixtures.reduce((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    // Get all completed team fixtures
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
      let rankings: { teamId: string; position: 1 | 2 | 3 }[] = [];
      
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
            teamId: finalMatch.winner.toString(),
            position: 1
          });
          
          // 2nd place - loser of final
          const runnerUp = finalMatch.homeParticipant?.toString() === finalMatch.winner.toString()
            ? finalMatch.awayParticipant?.toString()
            : finalMatch.homeParticipant?.toString();
            
          if (runnerUp) {
            rankings.push({
              teamId: runnerUp,
              position: 2
            });
          }
          
          // 3rd place - check for third place match or semi-final losers
          const thirdPlaceMatch = matches.find(m => m.isThirdPlaceMatch);
          if (thirdPlaceMatch && thirdPlaceMatch.winner) {
            rankings.push({
              teamId: thirdPlaceMatch.winner.toString(),
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
                    teamId: loser,
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
        if (sortedTeams[0]) rankings.push({ teamId: sortedTeams[0][0], position: 1 });
        if (sortedTeams[1]) rankings.push({ teamId: sortedTeams[1][0], position: 2 });
        if (sortedTeams[2]) rankings.push({ teamId: sortedTeams[2][0], position: 3 });
      }
      
      // Award points based on rankings
      logger.info(`Fixture ${fixture.name}: Found ${rankings.length} rankings`);
      
      for (const ranking of rankings) {
        const points = ranking.position === 1 ? sportGame.points.first :
                      ranking.position === 2 ? sportGame.points.second :
                      sportGame.points.third;
        
        logger.info(`Awarding ${points} points for position ${ranking.position} to team ${ranking.teamId}`);
        
        if (points > 0) {
          // Get team details
          const team = await Team.findById(ranking.teamId).lean();
          if (!team) {
            logger.warn(`Team ${ranking.teamId} not found`);
            continue;
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
            activityName: sportGame.title,
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
        allFixtureStatuses: allTeamFixtures.reduce((acc, f) => {
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