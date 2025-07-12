import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import logger from '../utils/logger';

interface AIOptimizationRequest {
  participants: Array<{
    id: string;
    name: string;
    teamId?: string;
    teamName?: string;
    stats?: {
      wins?: number;
      losses?: number;
      winRate?: number;
    };
  }>;
  format: 'knockout' | 'roundrobin';
  optimizationGoals: {
    balanceSkillLevels?: boolean;
    avoidSameTeamFirstRound?: boolean;
    prioritizeCompetitiveMatches?: boolean;
    fairScheduling?: boolean;
  };
  constraints?: {
    maxMatchesPerDay?: number;
    minRestBetweenMatches?: number;
  };
}

interface AIOptimizationResponse {
  optimizedOrder: string[];
  reasoning: string;
  confidenceScore: number;
  suggestions: string[];
}

export class AIFixtureService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private provider: 'anthropic' | 'openai' | 'local';

  constructor(provider: 'anthropic' | 'openai' | 'local' = 'local') {
    this.provider = provider;
    
    // Initialize Anthropic client if API key is available
    if (process.env.ANTHROPIC_API_KEY && provider === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      logger.info('Anthropic AI client initialized');
    }
    
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY && provider === 'openai') {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      logger.info('OpenAI client initialized');
    }
  }

  async optimizeFixture(request: AIOptimizationRequest): Promise<AIOptimizationResponse> {
    logger.info(`Optimizing fixture with ${this.provider} provider`);

    try {
      switch (this.provider) {
        case 'anthropic':
          if (!this.anthropicClient) {
            throw new Error('Anthropic API key not configured');
          }
          return await this.optimizeWithAnthropic(request);
          
        case 'openai':
          if (!this.openaiClient) {
            throw new Error('OpenAI API key not configured');
          }
          return await this.optimizeWithOpenAI(request);
          
        case 'local':
        default:
          return await this.optimizeWithLocalAlgorithm(request);
      }
    } catch (error) {
      logger.error('AI optimization failed, falling back to local algorithm', error);
      return await this.optimizeWithLocalAlgorithm(request);
    }
  }

  private async optimizeWithAnthropic(request: AIOptimizationRequest): Promise<AIOptimizationResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const prompt = this.buildOptimizationPrompt(request);
    
    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      // Parse the AI response
      const parsed = this.parseAIResponse(content.text, request.participants);
      
      return {
        optimizedOrder: parsed.order,
        reasoning: parsed.reasoning,
        confidenceScore: 95,
        suggestions: parsed.suggestions
      };
    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw error;
    }
  }

  private async optimizeWithOpenAI(request: AIOptimizationRequest): Promise<AIOptimizationResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = this.buildOptimizationPrompt(request);
    
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are a tournament optimization expert. Analyze the participants and create optimal matchups.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 1024
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the AI response
      const parsed = this.parseAIResponse(content, request.participants);
      
      return {
        optimizedOrder: parsed.order,
        reasoning: parsed.reasoning,
        confidenceScore: 92,
        suggestions: parsed.suggestions
      };
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw error;
    }
  }

  private async optimizeWithLocalAlgorithm(request: AIOptimizationRequest): Promise<AIOptimizationResponse> {
    logger.info('Using local optimization algorithm');
    
    const { participants, optimizationGoals } = request;
    let optimizedOrder = participants.map(p => p.id);
    
    // Group by teams if avoiding same-team matchups
    if (optimizationGoals.avoidSameTeamFirstRound && request.format === 'knockout') {
      const teamGroups = new Map<string, string[]>();
      
      participants.forEach(p => {
        if (p.teamId) {
          if (!teamGroups.has(p.teamId)) {
            teamGroups.set(p.teamId, []);
          }
          teamGroups.get(p.teamId)!.push(p.id);
        }
      });
      
      // Arrange to avoid same team in first round
      optimizedOrder = this.arrangeBySeparatingTeams(participants, teamGroups);
    }
    
    // Balance by skill levels if requested
    if (optimizationGoals.balanceSkillLevels) {
      optimizedOrder = this.balanceBySkillLevels(participants);
    }
    
    return {
      optimizedOrder,
      reasoning: 'Optimized using local algorithm with team separation and skill balancing',
      confidenceScore: 75,
      suggestions: [
        'Monitor early rounds for competitive balance',
        'Consider manual adjustments if any issues arise'
      ]
    };
  }

  private buildOptimizationPrompt(request: AIOptimizationRequest): string {
    const { participants, format, optimizationGoals, constraints } = request;
    
    return `
You are a tournament fixture optimization expert. Create an optimal arrangement of participants for a ${format} tournament.

Participants:
${participants.map((p, i) => `${i + 1}. ${p.name} (Team: ${p.teamName || 'None'}, Win Rate: ${p.stats?.winRate || 'Unknown'}%)`).join('\n')}

Optimization Goals:
${optimizationGoals.balanceSkillLevels ? '- Balance skill levels across the bracket for competitive matches\n' : ''}
${optimizationGoals.avoidSameTeamFirstRound ? '- Avoid same-team matchups in the first round\n' : ''}
${optimizationGoals.prioritizeCompetitiveMatches ? '- Create exciting, evenly-matched contests\n' : ''}
${optimizationGoals.fairScheduling ? '- Ensure fair scheduling with equal rest times\n' : ''}

${constraints ? `Constraints:
- Max matches per day: ${constraints.maxMatchesPerDay || 'No limit'}
- Min rest between matches: ${constraints.minRestBetweenMatches || 0} minutes
` : ''}

Please provide:
1. An optimized order of participant IDs for the tournament
2. Brief reasoning for your arrangement
3. 2-3 suggestions for tournament organizers

Format your response as JSON:
{
  "order": ["participant_id_1", "participant_id_2", ...],
  "reasoning": "Your reasoning here",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}
`;
  }

  private parseAIResponse(response: string, participants: any[]): {
    order: string[];
    reasoning: string;
    suggestions: string[];
  } {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          order: parsed.order || participants.map(p => p.id),
          reasoning: parsed.reasoning || 'AI optimization completed',
          suggestions: parsed.suggestions || []
        };
      }
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON, using fallback');
    }
    
    // Fallback: return original order
    return {
      order: participants.map(p => p.id),
      reasoning: 'AI response parsing failed, using original order',
      suggestions: ['Review participant order manually']
    };
  }

  private arrangeBySeparatingTeams(participants: any[], teamGroups: Map<string, string[]>): string[] {
    const arranged: string[] = [];
    const remaining = new Set(participants.map(p => p.id));
    
    // First, add one player from each team
    for (const [, players] of teamGroups) {
      if (players.length > 0 && remaining.has(players[0])) {
        arranged.push(players[0]);
        remaining.delete(players[0]);
      }
    }
    
    // Then add remaining players
    for (const id of remaining) {
      arranged.push(id);
    }
    
    return arranged;
  }

  private balanceBySkillLevels(participants: any[]): string[] {
    // Sort by win rate
    const sorted = [...participants].sort((a, b) => {
      const aRate = a.stats?.winRate || 50;
      const bRate = b.stats?.winRate || 50;
      return bRate - aRate;
    });
    
    // Snake draft arrangement for balance
    const balanced: string[] = [];
    const halfSize = Math.ceil(sorted.length / 2);
    
    for (let i = 0; i < halfSize; i++) {
      balanced.push(sorted[i].id);
      if (sorted.length - 1 - i !== i) {
        balanced.push(sorted[sorted.length - 1 - i].id);
      }
    }
    
    return balanced;
  }
}

export default AIFixtureService;