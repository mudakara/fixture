import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CAPTAIN = 'captain',
  PLAYER = 'player'
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  teamId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Azure AD specific fields
  azureAdId?: string;
  displayName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  preferredLanguage?: string;
  userPrincipalName?: string;
  authProvider: 'local' | 'azuread';
  comparePassword?(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: function() {
        return this.authProvider === 'local';
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.PLAYER
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    // Azure AD fields
    azureAdId: {
      type: String,
      unique: true,
      sparse: true
    },
    displayName: {
      type: String
    },
    jobTitle: {
      type: String
    },
    department: {
      type: String
    },
    officeLocation: {
      type: String
    },
    mobilePhone: {
      type: String
    },
    preferredLanguage: {
      type: String
    },
    userPrincipalName: {
      type: String
    },
    authProvider: {
      type: String,
      enum: ['local', 'azuread'],
      default: 'local',
      required: true
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;