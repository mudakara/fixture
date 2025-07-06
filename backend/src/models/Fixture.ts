import mongoose, { Document, Schema } from 'mongoose';

export enum FixtureStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed'
}

export interface IFixture extends Document {
  homeTeam: mongoose.Types.ObjectId;
  awayTeam: mongoose.Types.ObjectId;
  sport: string;
  venue: string;
  scheduledDate: Date;
  status: FixtureStatus;
  homeTeamScore?: number;
  awayTeamScore?: number;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const fixtureSchema = new Schema<IFixture>(
  {
    homeTeam: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Home team is required']
    },
    awayTeam: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Away team is required']
    },
    sport: {
      type: String,
      required: [true, 'Sport type is required']
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required']
    },
    status: {
      type: String,
      enum: Object.values(FixtureStatus),
      default: FixtureStatus.SCHEDULED
    },
    homeTeamScore: {
      type: Number,
      min: 0
    },
    awayTeamScore: {
      type: Number,
      min: 0
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters']
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

fixtureSchema.index({ homeTeam: 1, awayTeam: 1, scheduledDate: 1 });

const Fixture = mongoose.model<IFixture>('Fixture', fixtureSchema);

export default Fixture;