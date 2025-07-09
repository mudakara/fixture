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
  hasMultipleSets?: boolean;
  numberOfSets?: number; // 1 to 5
  points?: {
    first: number;
    second: number;
    third: number;
  };
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
    hasMultipleSets: {
      type: Boolean,
      default: false
    },
    numberOfSets: {
      type: Number,
      min: 1,
      max: 5,
      default: 1
    },
    // Points configuration for rankings
    points: {
      first: {
        type: Number,
        min: 0,
        default: 0
      },
      second: {
        type: Number,
        min: 0,
        default: 0
      },
      third: {
        type: Number,
        min: 0,
        default: 0
      }
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
// and validate sets configuration
SportGameSchema.pre('save', function(next) {
  if (this.minPlayers && this.maxPlayers && this.maxPlayers < this.minPlayers) {
    next(new Error('Maximum players must be greater than or equal to minimum players'));
  } else if (this.hasMultipleSets && (!this.numberOfSets || this.numberOfSets < 1 || this.numberOfSets > 5)) {
    next(new Error('Number of sets must be between 1 and 5 when multiple sets are enabled'));
  } else if (!this.hasMultipleSets) {
    // Reset numberOfSets to 1 if hasMultipleSets is false
    this.numberOfSets = 1;
    next();
  } else {
    next();
  }
});

const SportGame = mongoose.model<ISportGame>('SportGame', SportGameSchema);

export default SportGame;