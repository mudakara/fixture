import mongoose, { Document, Schema } from 'mongoose';

export interface ISportGame extends Document {
  title: string;
  description?: string;
  type: 'sport' | 'game';
  category?: string;
  rules?: string;
  minPlayers?: number;
  maxPlayers?: number;
  duration?: number; // in minutes
  venue?: string;
  equipment?: string[];
  image?: string;
  isDoubles?: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SportGameSchema = new Schema<ISportGame>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['sport', 'game'],
      required: true
    },
    category: {
      type: String,
      trim: true
    },
    rules: {
      type: String
    },
    minPlayers: {
      type: Number,
      min: 1
    },
    maxPlayers: {
      type: Number,
      min: 1
    },
    duration: {
      type: Number, // in minutes
      min: 1
    },
    venue: {
      type: String,
      trim: true
    },
    equipment: [{
      type: String,
      trim: true
    }],
    image: {
      type: String
    },
    isDoubles: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
// Title already has unique: true which creates an index
SportGameSchema.index({ type: 1 });
SportGameSchema.index({ category: 1 });
SportGameSchema.index({ isActive: 1 });

// Validate max players is greater than or equal to min players
SportGameSchema.pre('save', function(next) {
  if (this.minPlayers && this.maxPlayers && this.maxPlayers < this.minPlayers) {
    next(new Error('Maximum players must be greater than or equal to minimum players'));
  } else {
    next();
  }
});

const SportGame = mongoose.model<ISportGame>('SportGame', SportGameSchema);

export default SportGame;