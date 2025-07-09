import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import all models to ensure they're registered
import '../models/SportGame';

async function checkActivities() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matchmaker');
    console.log('Connected to MongoDB');

    const SportGame = mongoose.model('SportGame');

    // Get all activities
    const activities = await SportGame.find({ isActive: true }).lean();

    console.log(`\nTotal activities: ${activities.length}`);
    
    console.log('\nActivities with points:');
    activities.forEach((activity: any) => {
      console.log(`\n${activity.title} (${activity.type}):`);
      if (activity.points) {
        console.log(`  1st place: ${activity.points.first || 0} points`);
        console.log(`  2nd place: ${activity.points.second || 0} points`);
        console.log(`  3rd place: ${activity.points.third || 0} points`);
      } else {
        console.log('  No points configured');
      }
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkActivities();