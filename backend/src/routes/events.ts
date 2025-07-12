import express, { Request, Response } from 'express';
import Event from '../models/Event';
import Team from '../models/Team';
import { authenticate } from '../middleware/auth';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/events');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for event image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
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

// Middleware to check if user is admin or super_admin
const adminOnly = (req: Request, res: Response, next: Function): void => {
  const userRole = (req as any).user?.role;
  if (userRole !== 'super_admin' && userRole !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

// Create a new event
router.post('/events', authenticate, adminOnly, upload.single('eventImage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, endDate } = req.body;
    const user = (req as any).user;

    // Validate required fields
    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, start date, and end date are required' });
      return;
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    if (end < start) {
      res.status(400).json({ error: 'End date must be after or equal to start date' });
      return;
    }

    // Create event
    const event = await Event.create({
      name,
      description,
      eventImage: req.file ? `/uploads/events/${req.file.filename}` : null,
      startDate: start,
      endDate: end,
      createdBy: user._id
    });

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'create',
      entity: 'event',
      entityId: event._id,
      details: {
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Event created', {
      userId: user._id,
      eventId: event._id,
      eventName: event.name
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error: any) {
    logger.error('Error creating event:', error);
    res.status(500).json({ error: error.message || 'Failed to create event' });
  }
});

// Get all events
router.get('/events', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await Event.find({ isActive: true })
      .populate('createdBy', 'name email')
      .sort({ startDate: -1 });

    res.json({
      success: true,
      events
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event with teams
router.get('/events/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('createdBy', 'name email');

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Get teams for this event
    const teams = await Team.find({ eventId: id, isActive: true })
      .populate('captainId', 'name email')
      .populate('viceCaptainId', 'name email')
      .populate('players', 'name email');

    res.json({
      success: true,
      event,
      teams
    });
  } catch (error) {
    logger.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Update event
router.put('/events/:id', authenticate, adminOnly, upload.single('eventImage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate } = req.body;
    const user = (req as any).user;

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Prepare update object
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        updateData.startDate = start;
      }
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        updateData.endDate = end;
      }
    }

    // Validate dates if both are being updated
    if (updateData.startDate && updateData.endDate && updateData.endDate < updateData.startDate) {
      res.status(400).json({ error: 'End date must be after or equal to start date' });
      return;
    }

    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (event.eventImage) {
        const oldImagePath = path.join(__dirname, '../..', event.eventImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.eventImage = `/uploads/events/${req.file.filename}`;
    }

    // Update event
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'event',
      entityId: id,
      details: {
        updatedFields: Object.keys(updateData),
        oldValues: {
          name: event.name,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate
        },
        newValues: updateData
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Event updated', {
      userId: user._id,
      eventId: id,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent
    });
  } catch (error: any) {
    logger.error('Error updating event:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
});

// Delete event (soft delete)
router.delete('/events/:id', authenticate, adminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Check if event has active teams
    const teamCount = await Team.countDocuments({ eventId: id, isActive: true });
    if (teamCount > 0) {
      res.status(400).json({ error: 'Cannot delete event with active teams. Please delete all teams first.' });
      return;
    }

    // Soft delete
    event.isActive = false;
    await event.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'delete',
      entity: 'event',
      entityId: id,
      details: {
        eventName: event.name,
        softDelete: true
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Event deleted', {
      userId: user._id,
      eventId: id,
      eventName: event.name
    });

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Get event statistics
router.get('/events/:id/stats', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const teamCount = await Team.countDocuments({ eventId: id, isActive: true });
    const teams = await Team.find({ eventId: id, isActive: true });
    const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);

    const now = new Date();
    const status = event.isActive && event.startDate && event.endDate && 
      now >= event.startDate && now <= event.endDate
      ? 'ongoing'
      : event.endDate && now > event.endDate
      ? 'ended'
      : 'upcoming';

    res.json({
      success: true,
      stats: {
        eventName: event.name,
        status,
        teamCount,
        totalPlayers,
        startDate: event.startDate,
        endDate: event.endDate
      }
    });
  } catch (error) {
    logger.error('Error fetching event stats:', error);
    res.status(500).json({ error: 'Failed to fetch event statistics' });
  }
});

export default router;