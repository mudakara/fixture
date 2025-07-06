import mongoose, { Document, Schema } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  sport: string;
  captain: mongoose.Types.ObjectId;
  players: mongoose.Types.ObjectId[];
  description?: string;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [50, 'Team name cannot exceed 50 characters']
    },
    sport: {
      type: String,
      required: [true, 'Sport type is required'],
      trim: true
    },
    captain: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Team captain is required']
    },
    players: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    logo: {
      type: String
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

const Team = mongoose.model<ITeam>('Team', teamSchema);

export default Team;