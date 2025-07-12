# Test Coverage Plan for MatchMaker Pro

## Goal: Achieve 100% Test Coverage

This document outlines a comprehensive plan to write test cases for all existing functionality in the MatchMaker Pro application.

## Test Categories

### 1. Unit Tests (Models) - 15% of total effort
Test individual model methods and validations.

### 2. Integration Tests (API Endpoints) - 40% of total effort
Test complete request/response cycles with database interactions.

### 3. Service Tests (Business Logic) - 25% of total effort
Test complex business logic in isolation.

### 4. Middleware Tests - 10% of total effort
Test authentication, authorization, and request processing.

### 5. Utility Tests - 10% of total effort
Test helper functions and utilities.

## Detailed Test Plan

### Phase 1: Model Unit Tests (Week 1)

#### User Model (`src/__tests__/models/user.test.ts`)
- [ ] User creation with valid data
- [ ] Password hashing on save
- [ ] Email validation and uniqueness
- [ ] Role validation (enum values)
- [ ] Team membership operations
- [ ] Azure AD fields handling
- [ ] comparePassword method
- [ ] Virtual fields calculation
- [ ] Pre-save hooks
- [ ] Schema validation errors

#### Event Model (`src/__tests__/models/event.test.ts`)
- [ ] Event creation with valid dates
- [ ] Date validation (end date after start date)
- [ ] Virtual fields (isOngoing, hasEnded, isUpcoming, status)
- [ ] Soft delete functionality
- [ ] Required fields validation
- [ ] Image path handling

#### Team Model (`src/__tests__/models/team.test.ts`)
- [ ] Team creation with captain
- [ ] Vice-captain validation (different from captain)
- [ ] Player array management
- [ ] Player count virtual field
- [ ] Team soft delete
- [ ] Event reference validation

#### Fixture Model (`src/__tests__/models/fixture.test.ts`)
- [ ] Knockout fixture creation
- [ ] Round-robin fixture creation
- [ ] Participant type validation
- [ ] Format validation
- [ ] Status transitions
- [ ] Settings validation
- [ ] Participant array handling

#### Match Model (`src/__tests__/models/match.test.ts`)
- [ ] Match creation
- [ ] Score validation
- [ ] Status transitions
- [ ] Match linking (nextMatchId, previousMatchIds)
- [ ] Doubles partner fields
- [ ] Score details for multiple sets
- [ ] Winner/loser determination

#### SportGame Model (`src/__tests__/models/sportgame.test.ts`)
- [ ] Activity creation
- [ ] Type validation (sport/game)
- [ ] Player limits validation
- [ ] Points configuration
- [ ] Multiple sets configuration
- [ ] Doubles configuration

#### AuditLog Model (`src/__tests__/models/auditlog.test.ts`)
- [ ] Log entry creation
- [ ] Action enum validation
- [ ] Entity validation
- [ ] Timestamp handling
- [ ] Details object storage

#### Permission Model (`src/__tests__/models/permission.test.ts`)
- [ ] Permission creation
- [ ] Role validation
- [ ] Resource validation
- [ ] Actions array validation
- [ ] Unique constraint

### Phase 2: API Integration Tests (Week 2-3)

#### Authentication Routes (`src/__tests__/routes/auth.test.ts`)
- [ ] POST /api/auth/login - Local authentication
  - [ ] Valid credentials
  - [ ] Invalid credentials
  - [ ] Missing fields
  - [ ] Inactive user
- [ ] POST /api/auth/microsoft - Azure AD authentication
  - [ ] Valid token
  - [ ] Invalid token
  - [ ] User creation on first login
  - [ ] User update on subsequent login
- [ ] POST /api/auth/logout
  - [ ] Clear cookie
  - [ ] Audit log creation
- [ ] GET /api/auth/me
  - [ ] Authenticated user
  - [ ] Unauthenticated request

#### User Routes (`src/__tests__/routes/users.test.ts`)
- [ ] GET /api/users
  - [ ] List all users
  - [ ] Role filtering
  - [ ] Search functionality
  - [ ] Pagination
- [ ] POST /api/users
  - [ ] Create user with valid data
  - [ ] Duplicate email handling
  - [ ] Role validation
  - [ ] Password hashing
- [ ] GET /api/users/:id
  - [ ] Valid user ID
  - [ ] Invalid user ID
  - [ ] Include team memberships
- [ ] PUT /api/users/:id
  - [ ] Update user details
  - [ ] Role change restrictions
  - [ ] Self-update vs admin update
- [ ] DELETE /api/users/:id
  - [ ] Super admin only
  - [ ] Cannot delete self
  - [ ] Cannot delete last super admin

#### Event Routes (`src/__tests__/routes/events.test.ts`)
- [ ] GET /api/events
  - [ ] List all events
  - [ ] Status filtering
  - [ ] Date range filtering
  - [ ] Include statistics
- [ ] POST /api/events
  - [ ] Create with valid data
  - [ ] Date validation
  - [ ] Image upload handling
  - [ ] Admin/super admin only
- [ ] GET /api/events/:id
  - [ ] Include teams
  - [ ] Include statistics
  - [ ] Soft deleted events
- [ ] PUT /api/events/:id
  - [ ] Update event details
  - [ ] Image update
  - [ ] Date validation
- [ ] DELETE /api/events/:id
  - [ ] Soft delete
  - [ ] Cascade effects
- [ ] GET /api/events/:id/stats
  - [ ] Team count
  - [ ] Player count
  - [ ] Fixture count

#### Team Routes (`src/__tests__/routes/teams.test.ts`)
- [ ] GET /api/teams
  - [ ] List all teams
  - [ ] Filter by event
  - [ ] Include player count
- [ ] POST /api/teams
  - [ ] Create with valid data
  - [ ] Captain/vice-captain validation
  - [ ] Auto-add leaders to players
  - [ ] Logo upload
- [ ] GET /api/teams/:id
  - [ ] Include players
  - [ ] Include event details
- [ ] PUT /api/teams/:id
  - [ ] Update team details
  - [ ] Captain/vice-captain changes
  - [ ] Logo update
- [ ] DELETE /api/teams/:id
  - [ ] Soft delete
  - [ ] Remove from fixtures
- [ ] POST /api/teams/:id/players
  - [ ] Add single player
  - [ ] Duplicate player check
- [ ] POST /api/teams/:id/players/bulk
  - [ ] Parse "Name <email>" format
  - [ ] Create new users
  - [ ] Add existing users
- [ ] DELETE /api/teams/:id/players/:playerId
  - [ ] Remove player
  - [ ] Cannot remove captain/vice-captain

#### Fixture Routes (`src/__tests__/routes/fixtures.test.ts`)
- [ ] GET /api/fixtures
  - [ ] List all fixtures
  - [ ] Filter by event
  - [ ] Filter by format
  - [ ] Filter by status
- [ ] POST /api/fixtures
  - [ ] Create knockout fixture
  - [ ] Create round-robin fixture
  - [ ] Match generation
  - [ ] Bracket structure validation
  - [ ] Same-team avoidance
  - [ ] Bye handling
- [ ] GET /api/fixtures/:id
  - [ ] Include matches
  - [ ] Include participants
  - [ ] Team name resolution
- [ ] PUT /api/fixtures/:fixtureId/matches/:matchId
  - [ ] Update match result
  - [ ] Winner advancement
  - [ ] Status transitions
  - [ ] Multiple sets handling
  - [ ] Doubles partner tracking
- [ ] PUT /api/fixtures/:fixtureId/matches/:matchId/participants
  - [ ] Drag-drop participant update
  - [ ] Match link recalculation
  - [ ] Score clearing
  - [ ] Super admin only
- [ ] PUT /api/fixtures/:fixtureId/matches/:matchId/partners
  - [ ] Update doubles partners
  - [ ] Partner advancement
  - [ ] Validation
- [ ] DELETE /api/fixtures/:fixtureId/matches/:matchId
  - [ ] Delete empty matches only
  - [ ] Match renumbering
  - [ ] Link updates
- [ ] POST /api/fixtures/:id/randomize
  - [ ] Randomize participants
  - [ ] Preserve settings
  - [ ] No played matches
  - [ ] Admin/super admin only
- [ ] GET /api/fixtures/:id/standings
  - [ ] Round-robin standings
  - [ ] Points calculation
  - [ ] Tiebreakers

#### SportGame Routes (`src/__tests__/routes/sportgames.test.ts`)
- [ ] GET /api/sportgames
  - [ ] List all activities
  - [ ] Filter by type
  - [ ] Include usage count
- [ ] POST /api/sportgames
  - [ ] Create activity
  - [ ] Validation rules
  - [ ] Points configuration
  - [ ] Admin only
- [ ] GET /api/sportgames/:id
  - [ ] Activity details
  - [ ] Usage statistics
- [ ] PUT /api/sportgames/:id
  - [ ] Update activity
  - [ ] Cannot change if in use
- [ ] DELETE /api/sportgames/:id
  - [ ] Soft delete
  - [ ] Check fixture usage

#### Permission Routes (`src/__tests__/routes/permissions.test.ts`)
- [ ] GET /api/permissions
  - [ ] List all permissions
  - [ ] Super admin only
- [ ] GET /api/permissions/:role
  - [ ] Get role permissions
  - [ ] Valid roles only
- [ ] PUT /api/permissions/:role
  - [ ] Update permissions
  - [ ] Valid resources/actions
  - [ ] Super admin only
- [ ] POST /api/permissions/check
  - [ ] Check user permission
  - [ ] Resource/action validation

#### Dashboard Routes (`src/__tests__/routes/dashboard.test.ts`)
- [ ] GET /api/dashboard/stats
  - [ ] Overall statistics
  - [ ] Role-specific data
  - [ ] Active counts
  - [ ] Recent activity

#### Player Routes (`src/__tests__/routes/players.test.ts`)
- [ ] GET /api/players
  - [ ] List all players
  - [ ] Search functionality
  - [ ] Include statistics
  - [ ] Win rate calculation
- [ ] GET /api/players/:id/profile
  - [ ] Player details
  - [ ] Achievement calculation
  - [ ] Points totals
  - [ ] Podium rate
- [ ] GET /api/players/:id/matches
  - [ ] Match history
  - [ ] Result determination
  - [ ] Pagination

#### Scorecard Routes (`src/__tests__/routes/scorecard.test.ts`)
- [ ] GET /api/scorecard/teams
  - [ ] Team rankings
  - [ ] Points calculation
  - [ ] Activity breakdown
  - [ ] Event filtering
  - [ ] Player contribution tracking

### Phase 3: Service Tests (Week 4)

#### Auth Service (`src/__tests__/services/authService.test.ts`)
- [ ] Token generation
- [ ] Token validation
- [ ] Cookie handling
- [ ] Password comparison
- [ ] User session management

#### Azure AD Service (`src/__tests__/services/azureAdService.test.ts`)
- [ ] Token validation
- [ ] User profile extraction
- [ ] Graph API calls
- [ ] Error handling

#### Permission Service (`src/__tests__/services/permissionService.test.ts`)
- [ ] Permission checking
- [ ] Role hierarchy
- [ ] Resource access control
- [ ] Action validation

### Phase 4: Middleware Tests (Week 5)

#### Auth Middleware (`src/__tests__/middleware/auth.test.ts`)
- [ ] JWT validation
- [ ] Cookie extraction
- [ ] User attachment to request
- [ ] Error responses

#### Role Middleware (`src/__tests__/middleware/roles.test.ts`)
- [ ] canManageFixtures
- [ ] canManageTeams
- [ ] canManageEvents
- [ ] isAdmin
- [ ] isSuperAdmin

#### Error Middleware (`src/__tests__/middleware/error.test.ts`)
- [ ] Error formatting
- [ ] Status code handling
- [ ] Logging integration

### Phase 5: Utility Tests (Week 5)

#### Logger (`src/__tests__/utils/logger.test.ts`)
- [ ] Log levels
- [ ] File rotation
- [ ] Format output
- [ ] Error handling

#### Helper Functions (`src/__tests__/utils/helpers.test.ts`)
- [ ] Date formatting
- [ ] String validation
- [ ] Array operations
- [ ] Object transformations

### Phase 6: Complex Integration Tests (Week 6)

#### Complete Tournament Flow (`src/__tests__/integration/tournament-flow.test.ts`)
- [ ] Create event
- [ ] Add teams
- [ ] Add players
- [ ] Create fixture
- [ ] Play matches
- [ ] Advance winners
- [ ] Complete tournament
- [ ] Verify scorecard

#### Team Management Flow (`src/__tests__/integration/team-management.test.ts`)
- [ ] Create team
- [ ] Add captain/vice-captain
- [ ] Bulk add players
- [ ] Remove players
- [ ] Update roles
- [ ] Delete team

#### User Journey Tests (`src/__tests__/integration/user-journeys.test.ts`)
- [ ] Super Admin Journey
  - [ ] System setup
  - [ ] User management
  - [ ] Permission configuration
- [ ] Admin Journey
  - [ ] Event creation
  - [ ] Team management
  - [ ] Fixture management
- [ ] Captain Journey
  - [ ] Team management
  - [ ] Player management
  - [ ] Fixture creation
- [ ] Player Journey
  - [ ] View fixtures
  - [ ] View standings
  - [ ] View profile

## Test Implementation Strategy

### 1. Test Data Management
```typescript
// Create test data factories
export const factories = {
  user: (overrides = {}) => ({
    name: faker.name.fullName(),
    email: faker.internet.email(),
    password: 'Test123!',
    role: 'player',
    ...overrides
  }),
  
  event: (overrides = {}) => ({
    name: faker.company.name() + ' Tournament',
    startDate: faker.date.future(),
    endDate: faker.date.future(),
    ...overrides
  }),
  
  // ... more factories
};
```

### 2. Test Helpers
```typescript
// Common test scenarios
export const scenarios = {
  authenticatedRequest: (role = 'player') => {
    const user = await createTestUser({ role });
    const token = generateAuthToken(user._id, role);
    return { user, token, cookie: `token=${token}` };
  },
  
  completeFixture: async () => {
    // Create event, teams, players, fixture, play matches
    // Return complete test data
  }
};
```

### 3. Coverage Tracking

#### Coverage Goals by Category:
- Models: 100% coverage
- Routes: 95% coverage (some error paths may be excluded)
- Services: 100% coverage
- Middleware: 100% coverage
- Utils: 90% coverage

#### Coverage Commands:
```bash
# Run with coverage
npm run test:coverage

# Generate HTML report
npm run test:coverage -- --coverageReporters=html

# Check coverage thresholds
npm run test:coverage -- --coverageThreshold='{
  "global": {
    "branches": 90,
    "functions": 90,
    "lines": 90,
    "statements": 90
  }
}'
```

## Test File Structure

```
backend/src/__tests__/
├── models/
│   ├── user.test.ts
│   ├── event.test.ts
│   ├── team.test.ts
│   ├── fixture.test.ts
│   ├── match.test.ts
│   ├── sportgame.test.ts
│   ├── auditlog.test.ts
│   └── permission.test.ts
├── routes/
│   ├── auth.test.ts
│   ├── users.test.ts
│   ├── events.test.ts
│   ├── teams.test.ts
│   ├── fixtures.test.ts
│   ├── sportgames.test.ts
│   ├── permissions.test.ts
│   ├── dashboard.test.ts
│   ├── players.test.ts
│   └── scorecard.test.ts
├── services/
│   ├── authService.test.ts
│   ├── azureAdService.test.ts
│   └── permissionService.test.ts
├── middleware/
│   ├── auth.test.ts
│   ├── roles.test.ts
│   └── error.test.ts
├── utils/
│   ├── logger.test.ts
│   └── helpers.test.ts
├── integration/
│   ├── tournament-flow.test.ts
│   ├── team-management.test.ts
│   └── user-journeys.test.ts
└── fixtures/
    └── test-data.ts
```

## Implementation Timeline

### Week 1: Foundation
- Set up test utilities and factories
- Complete all model unit tests
- Achieve 100% model coverage

### Week 2-3: API Coverage
- Implement all route tests
- Focus on happy paths first
- Add error cases
- Achieve 90%+ route coverage

### Week 4: Services & Business Logic
- Test all service methods
- Cover edge cases
- Achieve 100% service coverage

### Week 5: Middleware & Utilities
- Complete middleware tests
- Test utility functions
- Clean up any gaps

### Week 6: Integration & Polish
- Implement complex flow tests
- Fix coverage gaps
- Refactor test code
- Document test patterns

## Success Metrics

1. **Coverage Targets**:
   - Overall: 95%+
   - Statements: 95%+
   - Branches: 90%+
   - Functions: 95%+
   - Lines: 95%+

2. **Test Quality**:
   - All tests pass consistently
   - Tests run in < 30 seconds
   - No flaky tests
   - Clear test descriptions

3. **Maintainability**:
   - DRY test code
   - Reusable test utilities
   - Clear naming conventions
   - Good documentation

## Continuous Integration

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:related"
    }
  }
}
```

### GitHub Actions
```yaml
- name: Test Coverage
  run: |
    npm run test:coverage
    npm run test:threshold
```

### Coverage Reporting
- Use Codecov or similar service
- Block PRs below threshold
- Track coverage trends

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
   ```typescript
   describe('User Model', () => {
     it('should hash password before saving to database', async () => {
       // test implementation
     });
   });
   ```

2. **Test Organization**: Group related tests using describe blocks
3. **Setup/Teardown**: Use beforeEach/afterEach for consistent state
4. **Assertions**: One logical assertion per test
5. **Test Data**: Use factories for consistent test data
6. **Mocking**: Mock external dependencies (email, file system)
7. **Error Testing**: Test both success and failure paths

## Next Steps

1. Review and approve this plan
2. Set up test infrastructure
3. Begin with Phase 1 (Model Tests)
4. Track progress weekly
5. Adjust timeline as needed