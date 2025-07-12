import mongoose, { Document, Schema } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  teamLogo?: string;
  eventId: mongoose.Types.ObjectId;
  captainId: mongoose.Types.ObjectId;
  viceCaptainId?: mongoose.Types.ObjectId;
  players: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  playerCount?: number;
}

const TeamSchema = new Schema<ITeam>({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },
  teamLogo: {
    type: String,
    default: null
  },
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required'],
    index: true
  },
  captainId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Team captain is required']
  },
  viceCaptainId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    validate: {
      validator: function(this: ITeam, value: mongoose.Types.ObjectId) {
        if (!value) return true;
        return !value.equals(this.captainId);
      },
      message: 'Vice-captain cannot be the same as captain'
    }
  },
  players: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
TeamSchema.index({ eventId: 1, isActive: 1 });
TeamSchema.index({ captainId: 1 });
TeamSchema.index({ viceCaptainId: 1 });
TeamSchema.index({ players: 1 });

// Ensure captain and vice-captain are always in players array
TeamSchema.pre('save', function(next) {
  // Initialize players array if it doesn't exist
  if (!this.players) {
    this.players = [];
  }
  
  if (!this.players.some(player => player.equals(this.captainId))) {
    this.players.push(this.captainId);
  }
  if (this.viceCaptainId && !this.players.some(player => player.equals(this.viceCaptainId))) {
    this.players.push(this.viceCaptainId);
  }
  next();
});

// Virtual for player count
TeamSchema.virtual('playerCount').get(function() {
  return this.players?.length || 0;
});

// Method to add a player
TeamSchema.methods.addPlayer = function(playerId: mongoose.Types.ObjectId) {
  if (!this.players) {
    this.players = [];
  }
  if (!this.players.some((player: mongoose.Types.ObjectId) => player.equals(playerId))) {
    this.players.push(playerId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove a player
TeamSchema.methods.removePlayer = function(playerId: mongoose.Types.ObjectId) {
  // Cannot remove captain or vice-captain
  if (playerId.equals(this.captainId) || playerId.equals(this.viceCaptainId)) {
    throw new Error('Cannot remove captain or vice-captain from team');
  }
  
  this.players = (this.players || []).filter((player: mongoose.Types.ObjectId) => !player.equals(playerId));
  return this.save();
};

// Ensure virtuals are included in JSON
TeamSchema.set('toJSON', {
  virtuals: true
});

const Team = mongoose.model<ITeam>('Team', TeamSchema);

export default Team;