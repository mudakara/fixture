import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import all models to ensure they're registered
import '../models/User';
import '../models/Event';
import '../models/Team';
import '../models/SportGame';
import '../models/Fixture';
import '../models/Match';

async function checkFixtures() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matchmaker');
    console.log('Connected to MongoDB');

    const Fixture = mongoose.model('Fixture');
    const Match = mongoose.model('Match');

    // Get all fixtures
    const fixtures = await Fixture.find({ isActive: true }).lean();

    console.log(`\nTotal fixtures: ${fixtures.length}`);
    
    // Group by status
    const byStatus = fixtures.reduce((acc: any, f: any) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nFixtures by status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Check team fixtures
    const teamFixtures = fixtures.filter((f: any) => f.participantType === 'team');
    console.log(`\nTeam fixtures: ${teamFixtures.length}`);
    
    const completedTeamFixtures = teamFixtures.filter((f: any) => f.status === 'completed');
    console.log(`Completed team fixtures: ${completedTeamFixtures.length}`);

    // Check each fixture's match completion
    console.log('\nChecking match completion for first 5 fixtures:');
    for (const fixture of fixtures.slice(0, 5)) {
      const matches = await Match.find({ fixtureId: (fixture as any)._id });
      const completed = matches.filter((m: any) => m.status === 'completed' || m.status === 'walkover').length;
      console.log(`  ${(fixture as any).name}: ${completed}/${matches.length} matches completed (status: ${(fixture as any).status})`);
      
      // If all matches are completed but fixture is not, log it
      if (matches.length > 0 && completed === matches.length && (fixture as any).status !== 'completed') {
        console.log(`    ⚠️  This fixture should be marked as completed!`);
      }
    }

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkFixtures();