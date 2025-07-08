import mongoose, { Document, Schema } from 'mongoose';

export interface IMatch extends Document {
  fixtureId: mongoose.Types.ObjectId;
  round: number; // Round number or stage (e.g., 1 = Round of 16, 2 = Quarter Final, etc.)
  matchNumber: number; // Match number within the round
  homeParticipant?: mongoose.Types.ObjectId; // Player or Team ID
  awayParticipant?: mongoose.Types.ObjectId; // Player or Team ID
  homeScore?: number;
  awayScore?: number;
  winner?: mongoose.Types.ObjectId;
  loser?: mongoose.Types.ObjectId;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed' | 'walkover';
  scheduledDate?: Date;
  actualDate?: Date;
  venue?: string;
  duration?: number; // Actual duration in minutes
  
  // For knockout tournaments
  nextMatchId?: mongoose.Types.ObjectId; // Winner goes to this match
  previousMatchIds?: mongoose.Types.ObjectId[]; // Matches that feed into this one
  isThirdPlaceMatch?: boolean;
  
  // Match details
  notes?: string;
  scoreDetails?: {
    periods?: Array<{
      period: number;
      homeScore: number;
      awayScore: number;
    }>;
    overtime?: boolean;
    penaltyShootout?: {
      homeScore: number;
      awayScore: number;
    };
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    fixtureId: {
      type: Schema.Types.ObjectId,
      ref: 'Fixture',
      required: true
    },
    round: {
      type: Number,
      required: true,
      min: 1
    },
    matchNumber: {
      type: Number,
      required: true,
      min: 1
    },
    homeParticipant: {
      type: Schema.Types.ObjectId,
      refPath: 'participantModel'
    },
    awayParticipant: {
      type: Schema.Types.ObjectId,
      refPath: 'participantModel'
    },
    homeScore: {
      type: Number,
      min: 0
    },
    awayScore: {
      type: Number,
      min: 0
    },
    winner: {
      type: Schema.Types.ObjectId,
      refPath: 'participantModel'
    },
    loser: {
      type: Schema.Types.ObjectId,
      refPath: 'participantModel'
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed', 'walkover'],
      default: 'scheduled'
    },
    scheduledDate: {
      type: Date
    },
    actualDate: {
      type: Date
    },
    venue: {
      type: String,
      trim: true
    },
    duration: {
      type: Number,
      min: 0
    },
    
    // Knockout specific
    nextMatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match'
    },
    previousMatchIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Match'
    }],
    isThirdPlaceMatch: {
      type: Boolean,
      default: false
    },
    
    // Match details
    notes: {
      type: String,
      maxlength: 500
    },
    scoreDetails: {
      periods: [{
        period: Number,
        homeScore: Number,
        awayScore: Number
      }],
      overtime: Boolean,
      penaltyShootout: {
        homeScore: Number,
        awayScore: Number
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
MatchSchema.index({ fixtureId: 1, round: 1, matchNumber: 1 });
MatchSchema.index({ homeParticipant: 1 });
MatchSchema.index({ awayParticipant: 1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ scheduledDate: 1 });

// Virtual to determine participant model based on fixture
MatchSchema.virtual('participantModel').get(function() {
  // This will be populated from the fixture's participantType
  return 'User'; // Default, will be overridden in queries
});

// Method to determine match outcome
MatchSchema.methods.determineWinner = function() {
  if (this.status === 'completed' && this.homeScore !== undefined && this.awayScore !== undefined) {
    if (this.homeScore > this.awayScore) {
      this.winner = this.homeParticipant;
      this.loser = this.awayParticipant;
    } else if (this.awayScore > this.homeScore) {
      this.winner = this.awayParticipant;
      this.loser = this.homeParticipant;
    }
    // In case of draw, winner might be determined by penalty shootout
    else if (this.scoreDetails?.penaltyShootout) {
      if (this.scoreDetails.penaltyShootout.homeScore > this.scoreDetails.penaltyShootout.awayScore) {
        this.winner = this.homeParticipant;
        this.loser = this.awayParticipant;
      } else {
        this.winner = this.awayParticipant;
        this.loser = this.homeParticipant;
      }
    }
  }
};

const Match = mongoose.model<IMatch>('Match', MatchSchema);

export default Match;