# Knockout Bracket Line Connection Fix

## Changes Made to `/frontend/app/fixtures/[id]/page.tsx`

### 1. Fixed Base Horizontal Line (Line 430-440)
- Changed starting position from `matchWidth - 2px` to `matchWidth` 
- This ensures the line starts exactly at the card edge
- Added zIndex: 5 for proper layering

### 2. Improved Connection Dot (Line 443-455)
- Positioned at `matchWidth - 4px` to sit on card edge
- 8px diameter with white border for visibility
- zIndex: 10 to appear above lines

### 3. Refactored Two-Match Connections (Line 476-544)
- Fixed logic to draw lines only once (from first match of pair)
- Calculates proper top/bottom positions
- Draws vertical lines from each match to junction point
- Horizontal line from junction to next match
- Junction dot at the meeting point

### 4. Simplified Single Match Connections (Line 545-609)
- For straight connections (yDiff < 5px), uses base horizontal line only
- For vertical offset, creates L-shaped connection:
  - Horizontal segment to 3/4 point
  - Vertical segment to align with next match
  - Final horizontal segment to complete connection
- Corner dot at the turn point

### 5. Added Debug Logging (Line 470-476)
- Logs connection details for each match
- Helps identify positioning issues

## Key Improvements:
1. Lines now properly start from card edges
2. Eliminated duplicate line drawing
3. Proper calculation of junction points for paired matches
4. Clean L-shaped connections for single matches with vertical offset
5. Consistent z-index layering for proper visual hierarchy

## Testing:
- Test with even number of participants (2, 4, 8, 16)
- Test with odd numbers (3, 5, 7, 9)
- Verify lines connect properly in all scenarios
- Check console for debug output