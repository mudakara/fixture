import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import User from '../models/User';
import Event from '../models/Event';
import Team from '../models/Team';
import Fixture from '../models/Fixture';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard/stats', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userRole = user.role;
    const userId = user._id;

    let stats: any = {
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        displayName: user.displayName
      }
    };

    // Get common statistics
    const now = new Date();
    const events = await Event.find({ isActive: true });
    
    // Categorize events
    const upcomingEvents = events.filter(e => new Date(e.startDate) > now);
    const ongoingEvents = events.filter(e => 
      new Date(e.startDate) <= now && new Date(e.endDate) >= now
    );
    const pastEvents = events.filter(e => new Date(e.endDate) < now);

    // Super Admin and Admin statistics
    if (userRole === 'super_admin' || userRole === 'admin') {
      const totalUsers = await User.countDocuments({ isActive: true });
      const totalTeams = await Team.countDocuments({ isActive: true });
      const totalFixtures = await Fixture.countDocuments({ isActive: true });
      const recentActivities = await AuditLog.find()
        .populate('userId', 'name email')
        .sort({ timestamp: -1 })
        .limit(5);

      // User breakdown by role
      const usersByRole = await User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      stats = {
        ...stats,
        overview: {
          totalUsers,
          totalTeams,
          totalEvents: events.length,
          totalFixtures,
          upcomingEvents: upcomingEvents.length,
          ongoingEvents: ongoingEvents.length,
          pastEvents: pastEvents.length
        },
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentActivities: recentActivities.map(activity => ({
          action: activity.action,
          entity: activity.entity,
          user: activity.userId ? {
            name: (activity.userId as any).name,
            email: (activity.userId as any).email
          } : null,
          timestamp: activity.timestamp,
          details: activity.details
        })),
        upcomingEventsList: upcomingEvents.slice(0, 5).map(e => ({
          _id: e._id,
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate
        }))
      };
    }

    // Captain and Vice-Captain statistics
    if (userRole === 'captain' || userRole === 'vicecaptain') {
      // Get teams where user is captain or vice-captain
      const myTeams = await Team.find({
        $or: [
          { captainId: userId },
          { viceCaptainId: userId }
        ],
        isActive: true
      }).populate('eventId', 'name startDate endDate').lean();

      const totalPlayers = myTeams.reduce((sum, team) => {
        // For lean queries, calculate manually
        const playerArrayLength = Array.isArray(team.players) ? team.players.length : 0;
        return sum + playerArrayLength;
      }, 0);

      stats = {
        ...stats,
        myTeams: {
          total: myTeams.length,
          list: myTeams.map(team => ({
            _id: team._id,
            name: team.name,
            role: team.captainId.toString() === userId.toString() ? 'Captain' : 'Vice Captain',
            playerCount: Array.isArray(team.players) ? team.players.length : 0,
            event: {
              _id: (team.eventId as any)._id,
              name: (team.eventId as any).name,
              startDate: (team.eventId as any).startDate,
              endDate: (team.eventId as any).endDate
            }
          }))
        },
        overview: {
          totalTeamsManaged: myTeams.length,
          totalPlayersManaged: totalPlayers,
          upcomingEvents: upcomingEvents.length,
          ongoingEvents: ongoingEvents.length
        }
      };
    }

    // Player statistics
    if (userRole === 'player') {
      // Get user's team memberships
      const userWithTeams = await User.findById(userId).populate({
        path: 'teamMemberships.teamId',
        populate: {
          path: 'eventId',
          select: 'name startDate endDate'
        }
      });

      const myTeams = userWithTeams?.teamMemberships || [];

      stats = {
        ...stats,
        myTeams: {
          total: myTeams.length,
          list: myTeams.map((membership: any) => ({
            teamId: membership.teamId._id,
            teamName: membership.teamId.name,
            role: membership.role,
            joinedAt: membership.joinedAt,
            event: {
              _id: membership.teamId.eventId._id,
              name: membership.teamId.eventId.name,
              startDate: membership.teamId.eventId.startDate,
              endDate: membership.teamId.eventId.endDate
            }
          }))
        },
        overview: {
          totalTeams: myTeams.length,
          upcomingEvents: upcomingEvents.length,
          ongoingEvents: ongoingEvents.length
        }
      };
    }

    // Get recent events for all users
    stats.recentEvents = events.slice(0, 5).map(e => ({
      _id: e._id,
      name: e.name,
      startDate: e.startDate,
      endDate: e.endDate,
      status: new Date(e.startDate) > now ? 'upcoming' : 
              (new Date(e.endDate) < now ? 'ended' : 'ongoing')
    }));

    res.json({
      success: true,
      stats
    });

  } catch (error: any) {
    logger.error('Error fetching dashboard stats:', {
      error: error.message,
      stack: error.stack,
      user: (req as any).user?.email
    });
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      message: error.message 
    });
  }
});

export default router;