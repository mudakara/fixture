# Test Checklist for MatchMaker Pro

## Critical Features to Test Before Any Release

### 1. Authentication & Authorization
- [ ] User login (local and Azure AD)
- [ ] Role-based access (super_admin, admin, captain, vicecaptain, player)
- [ ] JWT token validation
- [ ] Session management

### 2. Event Management
- [ ] Create event
- [ ] Edit event details
- [ ] Delete event (soft delete)
- [ ] List events with filters
- [ ] Event statistics

### 3. Team Management
- [ ] Create team
- [ ] Add/remove players
- [ ] Bulk player creation
- [ ] Captain/vice-captain assignment
- [ ] Team listing by event

### 4. Fixture Management
- [ ] Create knockout fixtures
- [ ] Create round-robin fixtures
- [ ] Match generation
- [ ] Match linking (nextMatchId, previousMatchIds)
- [ ] Bracket visualization
- [ ] Edit fixture mode (drag & drop)
- [ ] Delete matches
- [ ] Randomize bracket

### 5. Match Management
- [ ] Update match results
- [ ] Winner advancement
- [ ] Score validation
- [ ] Doubles partner management
- [ ] Multiple sets support

### 6. Scorecard & Statistics
- [ ] Team points calculation
- [ ] Player statistics
- [ ] Podium rate calculation
- [ ] Activity-based scoring

## Regression Tests for Common Issues

### 1. Match Deletion
**Test**: Delete a match and verify:
- [ ] Remaining matches are renumbered sequentially
- [ ] Match links are preserved
- [ ] No orphaned references

### 2. Participant Drag & Drop
**Test**: Move participants in edit mode and verify:
- [ ] Match links are recalculated
- [ ] Bracket lines connect correctly
- [ ] No participants are lost

### 3. Randomize Bracket
**Test**: Click randomize and verify:
- [ ] All participants are included
- [ ] Match structure is correct
- [ ] No 500 errors
- [ ] Settings are preserved

### 4. Doubles Tournaments
**Test**: Create doubles fixture and verify:
- [ ] Partner selection works
- [ ] Partners advance with winners
- [ ] Partner fields not cleared on drag/drop

### 5. Podium Rate Calculation
**Test**: Complete fixtures and verify:
- [ ] Only activities with points are counted
- [ ] Calculation is (podium finishes / total activities with points)
- [ ] Player profile shows correct percentage

## Manual Testing Workflow

1. **Before Starting Development**:
   - Run `npm test` to ensure all tests pass
   - Note any existing test failures

2. **During Development**:
   - Write tests for new features
   - Run `npm run test:watch` for affected files
   - Test edge cases

3. **Before Committing**:
   - Run full test suite: `npm test`
   - Run linting: `npm run lint`
   - Manually test affected features

4. **After Deployment**:
   - Run through critical features checklist
   - Test on different user roles
   - Verify no console errors

## Automated Testing Commands

```bash
# Run all tests
cd backend && npm test

# Run tests in watch mode
cd backend && npm run test:watch

# Run tests with coverage
cd backend && npm run test:coverage

# Run specific test file
cd backend && npm test fixtures.test.ts

# Run tests matching pattern
cd backend && npm test -- --testNamePattern="should create knockout fixture"
```

## Integration Test Scenarios

### Scenario 1: Complete Tournament Flow
1. Create event
2. Create teams
3. Add players to teams
4. Create knockout fixture
5. Play matches
6. Verify winner advancement
7. Complete tournament
8. Check scorecard

### Scenario 2: Edit Mode Changes
1. Create fixture with 8 players
2. Enter edit mode
3. Delete match 1
4. Move player from match 2 to match 4
5. Exit edit mode
6. Verify bracket integrity

### Scenario 3: Multi-Event Player
1. Create player
2. Add to team in Event A
3. Add to different team in Event B
4. Create fixtures in both events
5. Complete matches
6. Verify statistics are event-specific

## Performance Testing

- [ ] Load 100+ players in fixture
- [ ] Generate bracket for 64 participants
- [ ] Bulk create 50 players
- [ ] Load fixture with 100+ matches

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Responsiveness

Test key features on:
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (landscape/portrait)