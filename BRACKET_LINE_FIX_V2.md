# Tournament Bracket Line Connection Fix v2

## Issue Fixed
When two matches connect to one match in the next round, only one match was drawing the complete vertical line. The bottom match's vertical line was appearing incomplete (half only).

## Root Cause
The vertical line positioning for the bottom match was incorrect. The calculation `matchHeight / 2 - (currentY - midY)` was placing the line's starting point above the match center, causing it to appear disconnected.

## Solution Applied

### 1. Fixed Bottom Match Vertical Line Position (Line 553)
Changed from:
```typescript
top: `${matchHeight / 2 - (currentY - midY)}px`
```

To:
```typescript
top: `${midY - currentY + matchHeight / 2}px`
```

This ensures the vertical line starts from the match center and extends upward to the junction point.

### 2. Added Winner Path Highlighting
- Both top and bottom match vertical lines now use winner colors (green #10b981) when a winner exists
- The shared horizontal line and junction dot also highlight when either match has a winner
- This provides visual continuity for the winner's path through the tournament

### 3. Enhanced Debug Logging (Lines 528-537)
Added detailed logging to track:
- Match positions (currentY, siblingY)
- Junction point calculation (midY)
- Vertical line heights for both matches
- Whether the match is top or bottom in the pair

## How It Works Now

For two matches connecting to one:
1. **Top Match**: Draws vertical line downward from match center to midpoint
2. **Bottom Match**: Draws vertical line upward from match center to midpoint
3. **Shared Elements**: Only the top match draws:
   - Horizontal line from junction to next match
   - Junction dot at the meeting point

This prevents duplication while ensuring both matches have complete connections.

## Visual Result
- Both matches now have full vertical lines to the junction point
- No more "half lines" or incomplete connections
- Winner paths are highlighted in green throughout
- Clean bracket appearance with proper connections