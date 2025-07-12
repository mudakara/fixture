# AI Fixtures Setup Guide

## Overview
The AI Fixtures feature uses artificial intelligence to create optimized tournament brackets and schedules. It can analyze participant data, balance skill levels, avoid same-team matchups, and create more competitive tournaments.

## Supported AI Providers

### 1. Anthropic Claude (Recommended)
- Best for: Complex tournament optimization with nuanced understanding
- Model: Claude 3 Opus
- Get API Key: https://console.anthropic.com/

### 2. OpenAI GPT-4
- Best for: General-purpose optimization with good reasoning
- Model: GPT-4
- Get API Key: https://platform.openai.com/api-keys

### 3. Local Algorithm (Default)
- No API key required
- Uses enhanced tournament generation algorithms
- Good for basic optimization without external dependencies

## Setup Instructions

### Step 1: Configure Environment Variables

Add your API keys to the backend `.env` file:

```bash
# For Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# For OpenAI
OPENAI_API_KEY=sk-your-openai-key-here
```

### Step 2: Install Dependencies

The required packages are already installed:
- `@anthropic-ai/sdk` - Anthropic Claude SDK
- `openai` - OpenAI SDK

### Step 3: Using AI Fixtures

1. **Access the Feature**
   - Log in as Super Admin or Admin
   - Navigate to "AI Fixtures" in the menu

2. **Create AI Fixture**
   - Select event and activity
   - Choose optimization goals:
     - Balance skill levels
     - Avoid same-team matchups
     - Prioritize competitive matches
     - Fair scheduling
   - Select AI provider (Claude, GPT-4, or Local)
   - Choose participants
   - Click "Create AI Fixture"

3. **AI Optimization Process**
   - AI analyzes participant data (win rates, team affiliations)
   - Creates optimal bracket arrangement
   - Provides reasoning and suggestions
   - Shows optimization score (confidence level)

## How It Works

### Data Analysis
The AI service collects:
- Player/team names and IDs
- Team affiliations (for player fixtures)
- Historical match data
- Win/loss statistics
- Calculated win rates

### Optimization Goals
- **Balance Skill Levels**: Distributes strong and weak participants evenly
- **Avoid Same-Team Matchups**: Prevents teammates from facing each other early
- **Competitive Matches**: Creates exciting, evenly-matched contests
- **Fair Scheduling**: Ensures equal rest times between matches

### AI Processing
1. Prepares participant data with statistics
2. Sends optimization request to AI provider
3. AI analyzes and returns optimized arrangement
4. System creates fixture with AI-optimized seeding
5. Generates matches based on optimization

### Fallback Mechanism
If AI optimization fails:
- Automatically falls back to enhanced local algorithm
- Still applies team separation and basic balancing
- Logs the failure for debugging
- User is notified but fixture creation continues

## API Key Pricing

### Anthropic Claude
- Pay per token (input + output)
- Approximately $0.01-0.05 per fixture optimization
- Free tier available for testing

### OpenAI GPT-4
- Pay per token (input + output)
- Approximately $0.03-0.10 per fixture optimization
- Free credits for new accounts

## Best Practices

1. **Participant Count**
   - Optimal: 16-64 participants
   - AI works best with sufficient data
   - More participants = better optimization opportunities

2. **Data Quality**
   - Ensure players have match history for better win rate calculation
   - Complete team assignments for better team separation

3. **Provider Selection**
   - Use Claude for complex tournaments with many constraints
   - Use GPT-4 for standard tournaments
   - Use Local for quick fixtures or when API access is limited

4. **Cost Management**
   - Monitor API usage in provider dashboards
   - Use Local algorithm for testing
   - Set up billing alerts

## Troubleshooting

### "AI generation failed" Error
- Check API key is correctly set in `.env`
- Verify API key has sufficient credits
- Check network connectivity
- Review backend logs for specific errors

### Poor Optimization Results
- Ensure sufficient match history data
- Try different optimization goals
- Adjust creativity level (temperature)
- Consider manual adjustments after generation

### Rate Limiting
- Both Anthropic and OpenAI have rate limits
- Space out multiple fixture creations
- Consider upgrading API tier if needed

## Security Notes
- API keys are stored in backend only
- Never expose API keys in frontend code
- Use environment variables, not hardcoded values
- Regularly rotate API keys
- Monitor usage for unauthorized access

## Future Enhancements
- Support for more AI providers (Gemini, Cohere)
- Custom training on your tournament data
- Real-time optimization during tournaments
- Predictive match outcomes
- Automated schedule optimization