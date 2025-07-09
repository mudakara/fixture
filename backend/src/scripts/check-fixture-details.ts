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

async function checkFixtureDetails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matchmaker');
    console.log('Connected to MongoDB');

    const Fixture = mongoose.model('Fixture');
    const Match = mongoose.model('Match');
    const SportGame = mongoose.model('SportGame');
    const Team = mongoose.model('Team');

    // Get completed team fixtures
    const fixtures = await Fixture.find({ 
      isActive: true,
      participantType: 'team',
      status: 'completed'
    }).populate('sportGameId').lean();

    console.log(`\nCompleted team fixtures: ${fixtures.length}`);
    
    for (const fixture of fixtures) {
      console.log(`\nFixture: ${(fixture as any).name}`);
      console.log(`Format: ${(fixture as any).format}`);
      console.log(`Activity: ${(fixture as any).sportGameId?.title}`);
      console.log(`Points: 1st=${(fixture as any).sportGameId?.points?.first}, 2nd=${(fixture as any).sportGameId?.points?.second}, 3rd=${(fixture as any).sportGameId?.points?.third}`);
      
      // Get matches
      const matches = await Match.find({ 
        fixtureId: (fixture as any)._id,
        status: 'completed'
      }).lean();
      
      console.log(`Completed matches: ${matches.length}`);
      
      // For knockout, find the final match
      if ((fixture as any).format === 'knockout') {
        const maxRound = Math.max(...matches.map((m: any) => m.round));
        const finalMatch = matches.find((m: any) => m.round === maxRound && !m.isThirdPlaceMatch);
        
        if (finalMatch) {
          console.log(`\nFinal match found in round ${maxRound}:`);
          console.log(`  Winner: ${(finalMatch as any).winner}`);
          
          const winner = await Team.findById((finalMatch as any).winner).lean();
          const loser = (finalMatch as any).homeParticipant?.toString() === (finalMatch as any).winner?.toString()
            ? await Team.findById((finalMatch as any).awayParticipant).lean()
            : await Team.findById((finalMatch as any).homeParticipant).lean();
            
          console.log(`  1st place: ${(winner as any)?.name} (${(fixture as any).sportGameId?.points?.first} points)`);
          console.log(`  2nd place: ${(loser as any)?.name} (${(fixture as any).sportGameId?.points?.second} points)`);
          
          // Check for 3rd place
          const thirdPlaceMatch = matches.find((m: any) => m.isThirdPlaceMatch);
          if (thirdPlaceMatch) {
            const thirdPlace = await Team.findById((thirdPlaceMatch as any).winner).lean();
            console.log(`  3rd place: ${(thirdPlace as any)?.name} (${(fixture as any).sportGameId?.points?.third} points)`);
          }
        }
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

checkFixtureDetails();