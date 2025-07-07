import express, { Request, Response } from 'express';
import Team from '../models/Team';
import Event from '../models/Event';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/teams');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for team logo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'team-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware to check if user can manage teams
const canManageTeams = (req: Request, res: Response, next: Function): void => {
  const userRole = (req as any).user?.role;
  if (userRole !== 'super_admin' && userRole !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

// Create a new team
router.post('/teams', authenticate, canManageTeams, upload.single('teamLogo'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, eventId, captainId, viceCaptainId } = req.body;
    const user = (req as any).user;

    // Validate required fields
    if (!name || !eventId || !captainId || !viceCaptainId) {
      res.status(400).json({ error: 'Name, event, captain, and vice-captain are required' });
      return;
    }

    // Validate event exists
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      res.status(404).json({ error: 'Event not found or inactive' });
      return;
    }

    // Validate captain and vice-captain exist
    const captain = await User.findById(captainId);
    const viceCaptain = await User.findById(viceCaptainId);

    if (!captain || !viceCaptain) {
      res.status(404).json({ error: 'Captain or vice-captain not found' });
      return;
    }

    // Ensure captain and vice-captain are different
    if (captainId === viceCaptainId) {
      res.status(400).json({ error: 'Captain and vice-captain must be different users' });
      return;
    }

    // Create team
    const team = await Team.create({
      name,
      teamLogo: req.file ? `/uploads/teams/${req.file.filename}` : null,
      eventId,
      captainId,
      viceCaptainId,
      players: [captainId, viceCaptainId], // Auto-add captain and vice-captain
      createdBy: user._id
    });

    // Update user team memberships
    await User.findByIdAndUpdate(captainId, {
      $push: {
        teamMemberships: {
          teamId: team._id,
          eventId: eventId,
          role: 'captain',
          joinedAt: new Date()
        }
      }
    });

    await User.findByIdAndUpdate(viceCaptainId, {
      $push: {
        teamMemberships: {
          teamId: team._id,
          eventId: eventId,
          role: 'vicecaptain',
          joinedAt: new Date()
        }
      }
    });

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'create',
      entity: 'team',
      entityId: team._id,
      details: {
        teamName: team.name,
        eventId: eventId,
        captainId: captainId,
        viceCaptainId: viceCaptainId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Team created', {
      userId: user._id,
      teamId: team._id,
      teamName: team.name,
      eventId: eventId
    });

    // Populate the team before sending response
    const populatedTeam = await Team.findById(team._id)
      .populate('eventId', 'name')
      .populate('captainId', 'name email')
      .populate('viceCaptainId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      team: populatedTeam
    });
  } catch (error: any) {
    logger.error('Error creating team:', error);
    res.status(500).json({ error: error.message || 'Failed to create team' });
  }
});

// Get all teams
router.get('/teams', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.query;
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?._id;

    let query: any = { isActive: true };

    // Filter by event if provided
    if (eventId) {
      query.eventId = eventId;
    }

    // If user is captain or vice-captain, show only their teams
    if (userRole === 'captain' || userRole === 'vicecaptain') {
      query.$or = [
        { captainId: userId },
        { viceCaptainId: userId }
      ];
    }

    const teams = await Team.find(query)
      .populate('eventId', 'name startDate endDate')
      .populate('captainId', 'name email')
      .populate('viceCaptainId', 'name email')
      .populate('players', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      teams
    });
  } catch (error) {
    logger.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get single team
router.get('/teams/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?._id;

    const team = await Team.findById(id)
      .populate('eventId', 'name startDate endDate')
      .populate('captainId', 'name email displayName')
      .populate('viceCaptainId', 'name email displayName')
      .populate('players', 'name email displayName role');

    if (!team || !team.isActive) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check access permissions
    const isTeamMember = team.players.some(player => player._id.toString() === userId.toString());
    const isAdmin = userRole === 'super_admin' || userRole === 'admin';
    
    if (!isAdmin && !isTeamMember) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      success: true,
      team
    });
  } catch (error) {
    logger.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Update team
router.put('/teams/:id', authenticate, upload.single('teamLogo'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, captainId, viceCaptainId } = req.body;
    const user = (req as any).user;
    const userRole = user.role;

    const team = await Team.findById(id);
    if (!team || !team.isActive) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permissions
    const isAdmin = userRole === 'super_admin' || userRole === 'admin';
    const isCaptain = team.captainId.toString() === user._id.toString();
    
    if (!isAdmin && !isCaptain) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Prepare update object
    const updateData: any = {};
    const oldValues: any = {};

    if (name && name !== team.name) {
      updateData.name = name;
      oldValues.name = team.name;
    }

    // Only admins can change captain/vice-captain
    if (isAdmin) {
      if (captainId && captainId !== team.captainId.toString()) {
        const captain = await User.findById(captainId);
        if (!captain) {
          res.status(404).json({ error: 'Captain not found' });
          return;
        }
        updateData.captainId = captainId;
        oldValues.captainId = team.captainId;

        // Update team memberships
        await User.findByIdAndUpdate(team.captainId, {
          $pull: { teamMemberships: { teamId: team._id } }
        });
        await User.findByIdAndUpdate(captainId, {
          $push: {
            teamMemberships: {
              teamId: team._id,
              eventId: team.eventId,
              role: 'captain',
              joinedAt: new Date()
            }
          }
        });
      }

      if (viceCaptainId && viceCaptainId !== team.viceCaptainId.toString()) {
        const viceCaptain = await User.findById(viceCaptainId);
        if (!viceCaptain) {
          res.status(404).json({ error: 'Vice-captain not found' });
          return;
        }
        if (viceCaptainId === (updateData.captainId || team.captainId.toString())) {
          res.status(400).json({ error: 'Captain and vice-captain must be different users' });
          return;
        }
        updateData.viceCaptainId = viceCaptainId;
        oldValues.viceCaptainId = team.viceCaptainId;

        // Update team memberships
        await User.findByIdAndUpdate(team.viceCaptainId, {
          $pull: { teamMemberships: { teamId: team._id } }
        });
        await User.findByIdAndUpdate(viceCaptainId, {
          $push: {
            teamMemberships: {
              teamId: team._id,
              eventId: team.eventId,
              role: 'vicecaptain',
              joinedAt: new Date()
            }
          }
        });
      }
    }

    // Handle logo update
    if (req.file) {
      // Delete old logo if exists
      if (team.teamLogo) {
        const oldLogoPath = path.join(__dirname, '../..', team.teamLogo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      updateData.teamLogo = `/uploads/teams/${req.file.filename}`;
    }

    // Update team
    const updatedTeam = await Team.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('eventId captainId viceCaptainId players');

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'team',
      entityId: id,
      details: {
        updatedFields: Object.keys(updateData),
        oldValues,
        newValues: updateData
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Team updated', {
      userId: user._id,
      teamId: id,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Team updated successfully',
      team: updatedTeam
    });
  } catch (error: any) {
    logger.error('Error updating team:', error);
    res.status(500).json({ error: error.message || 'Failed to update team' });
  }
});

// Add player to team
router.post('/teams/:id/players', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;
    const user = (req as any).user;
    const userRole = user.role;

    if (!playerId) {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    const team = await Team.findById(id);
    if (!team || !team.isActive) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permissions
    const isAdmin = userRole === 'super_admin' || userRole === 'admin';
    const isCaptain = team.captainId.toString() === user._id.toString();
    const isViceCaptain = team.viceCaptainId.toString() === user._id.toString();
    
    if (!isAdmin && !isCaptain && !isViceCaptain) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if player exists
    const player = await User.findById(playerId);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Check if player is already in team
    if (team.players.some(p => p.toString() === playerId)) {
      res.status(400).json({ error: 'Player is already in the team' });
      return;
    }

    // Add player to team
    team.players.push(new mongoose.Types.ObjectId(playerId));
    await team.save();

    // Update player's team memberships
    await User.findByIdAndUpdate(playerId, {
      $push: {
        teamMemberships: {
          teamId: team._id,
          eventId: team.eventId,
          role: 'player',
          joinedAt: new Date()
        }
      }
    });

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'team',
      entityId: id,
      details: {
        action: 'add_player',
        playerId: playerId,
        playerName: player.name,
        teamName: team.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Player added to team', {
      userId: user._id,
      teamId: id,
      playerId: playerId
    });

    res.json({
      success: true,
      message: 'Player added successfully',
      player: {
        _id: player._id,
        name: player.name,
        email: player.email
      }
    });
  } catch (error: any) {
    logger.error('Error adding player:', error);
    res.status(500).json({ error: error.message || 'Failed to add player' });
  }
});

// Remove player from team
router.delete('/teams/:id/players/:playerId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, playerId } = req.params;
    const user = (req as any).user;
    const userRole = user.role;

    const team = await Team.findById(id);
    if (!team || !team.isActive) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permissions
    const isAdmin = userRole === 'super_admin' || userRole === 'admin';
    const isCaptain = team.captainId.toString() === user._id.toString();
    const isViceCaptain = team.viceCaptainId.toString() === user._id.toString();
    
    if (!isAdmin && !isCaptain && !isViceCaptain) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Cannot remove captain or vice-captain
    if (playerId === team.captainId.toString() || playerId === team.viceCaptainId.toString()) {
      res.status(400).json({ error: 'Cannot remove captain or vice-captain from team' });
      return;
    }

    // Remove player from team
    const initialLength = team.players.length;
    team.players = team.players.filter(p => p.toString() !== playerId);
    
    if (team.players.length === initialLength) {
      res.status(400).json({ error: 'Player not found in team' });
      return;
    }

    await team.save();

    // Update player's team memberships
    await User.findByIdAndUpdate(playerId, {
      $pull: { teamMemberships: { teamId: team._id } }
    });

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'team',
      entityId: id,
      details: {
        action: 'remove_player',
        playerId: playerId,
        teamName: team.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Player removed from team', {
      userId: user._id,
      teamId: id,
      playerId: playerId
    });

    res.json({
      success: true,
      message: 'Player removed successfully'
    });
  } catch (error: any) {
    logger.error('Error removing player:', error);
    res.status(500).json({ error: error.message || 'Failed to remove player' });
  }
});

// Bulk create players for a team
router.post('/teams/:id/players/bulk', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { players } = req.body;
    const user = (req as any).user;
    const userRole = user.role;

    if (!players || !Array.isArray(players) || players.length === 0) {
      res.status(400).json({ error: 'Players data is required' });
      return;
    }

    const team = await Team.findById(id).populate('eventId');
    if (!team || !team.isActive) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permissions
    const isAdmin = userRole === 'super_admin' || userRole === 'admin';
    const isCaptain = team.captainId.toString() === user._id.toString();
    const isViceCaptain = team.viceCaptainId.toString() === user._id.toString();
    
    if (!isAdmin && !isCaptain && !isViceCaptain) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const createdPlayers = [];
    const errors = [];

    // Process each player entry
    for (const playerEntry of players) {
      const trimmedEntry = playerEntry.trim();
      if (!trimmedEntry) continue;

      try {
        let name = '';
        let email = '';
        
        // Parse the entry - expected format: "Name <email>" or just "Name"
        const emailMatch = trimmedEntry.match(/^(.+?)\s*<(.+?)>$/);
        
        if (emailMatch) {
          // Format: "Name <email>"
          name = emailMatch[1].trim();
          email = emailMatch[2].trim();
        } else {
          // Just name provided, generate email
          name = trimmedEntry.trim();
          const baseEmail = name.toLowerCase().replace(/\s+/g, '.') + '@player.local';
          email = baseEmail;
          let counter = 1;
          
          // Check if email already exists and generate a unique one
          while (await User.findOne({ email })) {
            email = name.toLowerCase().replace(/\s+/g, '.') + counter + '@player.local';
            counter++;
          }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error(`Email already exists: ${email}`);
        }

        // Create the player
        const newPlayer = new User({
          name: name,
          displayName: name,
          email: email,
          password: await bcrypt.hash('changeme123', 10), // Default password
          role: 'player',
          isActive: true,
          microsoftId: null, // No Microsoft ID for bulk created players
          teamMemberships: [{
            teamId: team._id,
            eventId: team.eventId,
            role: 'player',
            joinedAt: new Date()
          }]
        });

        await newPlayer.save();

        // Add player to team
        team.players.push(newPlayer._id as mongoose.Types.ObjectId);

        // Log the action
        await AuditLog.create({
          userId: user._id,
          action: 'create',
          entity: 'user',
          entityId: newPlayer._id,
          details: {
            userType: 'player',
            playerName: name,
            playerEmail: email,
            teamId: team._id,
            teamName: team.name,
            eventId: team.eventId._id,
            createdBy: user.name,
            bulkCreated: true
          }
        });

        createdPlayers.push({
          _id: newPlayer._id,
          name: newPlayer.name,
          email: newPlayer.email
        });

      } catch (error: any) {
        errors.push({
          entry: trimmedEntry,
          error: error.message || 'Failed to create player'
        });
      }
    }

    // Save the team with new players
    await team.save();

    // Get updated team with populated players
    const updatedTeam = await Team.findById(id)
      .populate('players', 'name email displayName')
      .populate('captainId', 'name email displayName')
      .populate('viceCaptainId', 'name email displayName');

    res.json({
      success: true,
      message: `Created ${createdPlayers.length} players`,
      createdPlayers,
      errors: errors.length > 0 ? errors : undefined,
      team: updatedTeam
    });

  } catch (error: any) {
    logger.error('Error creating bulk players:', error);
    res.status(500).json({ error: error.message || 'Failed to create players' });
  }
});

// Delete team (soft delete)
router.delete('/teams/:id', authenticate, canManageTeams, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const team = await Team.findById(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Remove team memberships from all players
    await User.updateMany(
      { 'teamMemberships.teamId': team._id },
      { $pull: { teamMemberships: { teamId: team._id } } }
    );

    // Soft delete
    team.isActive = false;
    await team.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'delete',
      entity: 'team',
      entityId: id,
      details: {
        teamName: team.name,
        eventId: team.eventId,
        softDelete: true
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Team deleted', {
      userId: user._id,
      teamId: id,
      teamName: team.name
    });

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;