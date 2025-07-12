import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  name: string;
  description?: string;
  eventImage?: string;
  startDate?: Date;
  endDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  isOngoing?: boolean;
  hasEnded?: boolean;
  isUpcoming?: boolean;
}

const EventSchema = new Schema<IEvent>({
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
    maxlength: [100, 'Event name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  eventImage: {
    type: String,
    default: null
  },
  startDate: {
    type: Date,
    required: false
  },
  endDate: {
    type: Date,
    required: false,
    validate: {
      validator: function(this: IEvent, value: Date) {
        // Only validate if both dates exist
        if (!this.startDate || !value) return true;
        return value >= this.startDate;
      },
      message: 'End date must be after or equal to start date'
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
}, {
  timestamps: true
});

// Index for faster queries
EventSchema.index({ isActive: 1, startDate: -1 });
EventSchema.index({ createdBy: 1 });

// Virtual for checking if event is ongoing
EventSchema.virtual('isOngoing').get(function() {
  if (!this.startDate || !this.endDate) return false;
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

// Virtual for checking if event has ended
EventSchema.virtual('hasEnded').get(function() {
  if (!this.endDate) return false;
  return new Date() > this.endDate;
});

// Virtual for checking if event hasn't started
EventSchema.virtual('isUpcoming').get(function() {
  if (!this.startDate) return false;
  return new Date() < this.startDate;
});

// Ensure virtuals are included in JSON
EventSchema.set('toJSON', {
  virtuals: true
});

const Event = mongoose.model<IEvent>('Event', EventSchema);

export default Event;