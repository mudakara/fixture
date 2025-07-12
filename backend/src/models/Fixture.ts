import mongoose, { Document, Schema } from 'mongoose';

export interface IFixture extends Document {
  name: string;
  description?: string;
  eventId: mongoose.Types.ObjectId;
  sportGameId: mongoose.Types.ObjectId;
  format: 'knockout' | 'roundrobin';
  participantType: 'player' | 'team';
  participants: mongoose.Types.ObjectId[]; // Array of player IDs or team IDs
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  settings: {
    // Knockout specific settings
    thirdPlaceMatch?: boolean;
    randomizeSeeds?: boolean;
    avoidSameTeamFirstRound?: boolean; // For player fixtures, avoid same team players in first round
    
    // Round-robin specific settings
    rounds?: number; // Number of times each participant plays each other
    homeAndAway?: boolean; // For team fixtures
    
    // Common settings
    matchDuration?: number; // in minutes
    venue?: string;
    pointsForWin?: number;
    pointsForDraw?: number;
    pointsForLoss?: number;
  };
  winners?: {
    first?: mongoose.Types.ObjectId;
    second?: mongoose.Types.ObjectId;
    third?: mongoose.Types.ObjectId;
  };
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  participantCount?: number;
}

const FixtureSchema = new Schema<IFixture>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    sportGameId: {
      type: Schema.Types.ObjectId,
      ref: 'SportGame',
      required: true
    },
    format: {
      type: String,
      enum: ['knockout', 'roundrobin'],
      required: true
    },
    participantType: {
      type: String,
      enum: ['player', 'team'],
      required: true
    },
    participants: [{
      type: Schema.Types.ObjectId,
      refPath: 'participantType'
    }],
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'draft'
    },
    startDate: {
      type: Date,
      required: false
    },
    endDate: {
      type: Date
    },
    settings: {
      // Knockout settings
      thirdPlaceMatch: {
        type: Boolean,
        default: false
      },
      randomizeSeeds: {
        type: Boolean,
        default: true
      },
      avoidSameTeamFirstRound: {
        type: Boolean,
        default: true
      },
      
      // Round-robin settings
      rounds: {
        type: Number,
        default: 1,
        min: 1
      },
      homeAndAway: {
        type: Boolean,
        default: false
      },
      
      // Common settings
      matchDuration: {
        type: Number,
        min: 1
      },
      venue: {
        type: String,
        trim: true
      },
      pointsForWin: {
        type: Number,
        default: 3
      },
      pointsForDraw: {
        type: Number,
        default: 1
      },
      pointsForLoss: {
        type: Number,
        default: 0
      }
    },
    winners: {
      first: {
        type: Schema.Types.ObjectId
      },
      second: {
        type: Schema.Types.ObjectId
      },
      third: {
        type: Schema.Types.ObjectId
      }
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
FixtureSchema.index({ eventId: 1 });
FixtureSchema.index({ sportGameId: 1 });
FixtureSchema.index({ status: 1 });
FixtureSchema.index({ participantType: 1 });
FixtureSchema.index({ createdBy: 1 });

// Virtual to get participant count
FixtureSchema.virtual('participantCount').get(function() {
  return this.participants?.length || 0;
});

// Validate participant count based on format
FixtureSchema.pre('save', function(next) {
  if (this.format === 'knockout' && this.participants.length < 2) {
    next(new Error('Knockout format requires at least 2 participants'));
  } else if (this.format === 'roundrobin' && this.participants.length < 2) {
    next(new Error('Round-robin format requires at least 2 participants'));
  } else {
    next();
  }
});

const Fixture = mongoose.model<IFixture>('Fixture', FixtureSchema);

export default Fixture;