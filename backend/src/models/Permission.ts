import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
  role: string;
  permissions: {
    resource: string;
    actions: string[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema: Schema = new Schema({
  role: {
    type: String,
    required: true,
    unique: true,
    enum: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player']
  },
  permissions: [{
    resource: {
      type: String,
      required: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete']
    }]
  }]
}, {
  timestamps: true
});

export default mongoose.model<IPermission>('Permission', PermissionSchema);