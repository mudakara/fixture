import express, { Request, Response } from 'express';
import SportGame from '../models/SportGame';
import { authenticate } from '../middleware/auth';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/sportgames');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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

// Middleware to check if user is admin
const adminOnly = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (user && (user.role === 'super_admin' || user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
};

// Create a new sport/game
router.post('/sportgames', authenticate, adminOnly, upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, type, category, rules, minPlayers, maxPlayers, duration, venue, equipment, isDoubles } = req.body;
    const user = (req as any).user;

    // Validate required fields
    if (!title || !type) {
      res.status(400).json({ error: 'Title and type are required' });
      return;
    }

    // Check if sport/game with same title already exists
    const existingSportGame = await SportGame.findOne({ title: { $regex: new RegExp(`^${title}$`, 'i') } });
    if (existingSportGame) {
      res.status(400).json({ error: 'A sport/game with this title already exists' });
      return;
    }

    // Parse equipment if it's a string
    let equipmentArray: string[] = [];
    if (equipment) {
      if (typeof equipment === 'string') {
        equipmentArray = equipment.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
      } else if (Array.isArray(equipment)) {
        equipmentArray = equipment;
      }
    }

    // Create sport/game
    const sportGame = new SportGame({
      title,
      description,
      type,
      category,
      rules,
      minPlayers: minPlayers ? parseInt(minPlayers) : undefined,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : undefined,
      duration: duration ? parseInt(duration) : undefined,
      venue,
      equipment: equipmentArray,
      isDoubles: isDoubles === 'true' || isDoubles === true,
      image: req.file ? `/uploads/sportgames/${req.file.filename}` : undefined,
      createdBy: user._id
    });

    await sportGame.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'create',
      entity: 'sportgame',
      entityId: sportGame._id,
      details: {
        title: sportGame.title,
        type: sportGame.type
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Sport/Game created', {
      userId: user._id,
      sportGameId: sportGame._id,
      title: sportGame.title
    });

    res.status(201).json({
      success: true,
      sportGame
    });
  } catch (error: any) {
    logger.error('Error creating sport/game:', error);
    res.status(500).json({ error: error.message || 'Failed to create sport/game' });
  }
});

// Get all sports/games
router.get('/sportgames', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, category, search } = req.query;
    
    let query: any = { isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    if (category) {
      query.category = { $regex: new RegExp(category as string, 'i') };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: new RegExp(search as string, 'i') } },
        { description: { $regex: new RegExp(search as string, 'i') } },
        { category: { $regex: new RegExp(search as string, 'i') } }
      ];
    }

    const sportGames = await SportGame.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      sportGames
    });
  } catch (error: any) {
    logger.error('Error fetching sports/games:', error);
    res.status(500).json({ error: 'Failed to fetch sports/games' });
  }
});

// Get single sport/game
router.get('/sportgames/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sportGame = await SportGame.findById(id)
      .populate('createdBy', 'name email');

    if (!sportGame || !sportGame.isActive) {
      res.status(404).json({ error: 'Sport/Game not found' });
      return;
    }

    res.json({
      success: true,
      sportGame
    });
  } catch (error: any) {
    logger.error('Error fetching sport/game:', error);
    res.status(500).json({ error: 'Failed to fetch sport/game' });
  }
});

// Update sport/game
router.put('/sportgames/:id', authenticate, adminOnly, upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, type, category, rules, minPlayers, maxPlayers, duration, venue, equipment, isDoubles } = req.body;
    const user = (req as any).user;

    const sportGame = await SportGame.findById(id);
    if (!sportGame || !sportGame.isActive) {
      res.status(404).json({ error: 'Sport/Game not found' });
      return;
    }

    // Check if new title conflicts with existing
    if (title && title !== sportGame.title) {
      const existingSportGame = await SportGame.findOne({ 
        title: { $regex: new RegExp(`^${title}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingSportGame) {
        res.status(400).json({ error: 'A sport/game with this title already exists' });
        return;
      }
    }

    // Store old values for audit
    const oldValues: any = {};
    const updateData: any = {};

    // Update fields if provided
    if (title !== undefined && title !== sportGame.title) {
      oldValues.title = sportGame.title;
      updateData.title = title;
    }
    if (description !== undefined && description !== sportGame.description) {
      oldValues.description = sportGame.description;
      updateData.description = description;
    }
    if (type !== undefined && type !== sportGame.type) {
      oldValues.type = sportGame.type;
      updateData.type = type;
    }
    if (category !== undefined && category !== sportGame.category) {
      oldValues.category = sportGame.category;
      updateData.category = category;
    }
    if (rules !== undefined && rules !== sportGame.rules) {
      oldValues.rules = sportGame.rules;
      updateData.rules = rules;
    }
    if (minPlayers !== undefined) {
      const minPlayersNum = parseInt(minPlayers);
      if (minPlayersNum !== sportGame.minPlayers) {
        oldValues.minPlayers = sportGame.minPlayers;
        updateData.minPlayers = minPlayersNum;
      }
    }
    if (maxPlayers !== undefined) {
      const maxPlayersNum = parseInt(maxPlayers);
      if (maxPlayersNum !== sportGame.maxPlayers) {
        oldValues.maxPlayers = sportGame.maxPlayers;
        updateData.maxPlayers = maxPlayersNum;
      }
    }
    if (duration !== undefined) {
      const durationNum = parseInt(duration);
      if (durationNum !== sportGame.duration) {
        oldValues.duration = sportGame.duration;
        updateData.duration = durationNum;
      }
    }
    if (venue !== undefined && venue !== sportGame.venue) {
      oldValues.venue = sportGame.venue;
      updateData.venue = venue;
    }
    if (equipment !== undefined) {
      let equipmentArray: string[] = [];
      if (typeof equipment === 'string') {
        equipmentArray = equipment.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
      } else if (Array.isArray(equipment)) {
        equipmentArray = equipment;
      }
      oldValues.equipment = sportGame.equipment;
      updateData.equipment = equipmentArray;
    }
    if (isDoubles !== undefined) {
      const isDoublesBoolean = isDoubles === 'true' || isDoubles === true;
      if (isDoublesBoolean !== sportGame.isDoubles) {
        oldValues.isDoubles = sportGame.isDoubles;
        updateData.isDoubles = isDoublesBoolean;
      }
    }

    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (sportGame.image) {
        const oldImagePath = path.join(__dirname, '../..', sportGame.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      oldValues.image = sportGame.image;
      updateData.image = `/uploads/sportgames/${req.file.filename}`;
    }

    // Update sport/game
    Object.assign(sportGame, updateData);
    await sportGame.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'update',
      entity: 'sportgame',
      entityId: id,
      details: {
        oldValues,
        newValues: updateData
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Sport/Game updated', {
      userId: user._id,
      sportGameId: id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      sportGame
    });
  } catch (error: any) {
    logger.error('Error updating sport/game:', error);
    res.status(500).json({ error: error.message || 'Failed to update sport/game' });
  }
});

// Delete sport/game (soft delete)
router.delete('/sportgames/:id', authenticate, adminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const sportGame = await SportGame.findById(id);
    if (!sportGame) {
      res.status(404).json({ error: 'Sport/Game not found' });
      return;
    }

    sportGame.isActive = false;
    await sportGame.save();

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'delete',
      entity: 'sportgame',
      entityId: id,
      details: {
        title: sportGame.title,
        type: sportGame.type
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Sport/Game deleted', {
      userId: user._id,
      sportGameId: id,
      title: sportGame.title
    });

    res.json({
      success: true,
      message: 'Sport/Game deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting sport/game:', error);
    res.status(500).json({ error: 'Failed to delete sport/game' });
  }
});

// Get sport/game categories
router.get('/sportgames-categories', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await SportGame.distinct('category', { isActive: true, category: { $ne: null } });
    
    res.json({
      success: true,
      categories: categories.filter(cat => cat && cat.trim().length > 0)
    });
  } catch (error: any) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;