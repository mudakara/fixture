'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { use } from 'react';
import axios from 'axios';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const EditableKnockoutBracket = dynamic(
  () => import('./EditableKnockoutBracket'),
  { ssr: false }
);

interface Params {
  id: string;
}

interface Fixture {
  _id: string;
  name: string;
  description?: string;
  eventId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  sportGameId: {
    _id: string;
    title: string;
    type: string;
    category: string;
    isDoubles?: boolean;
    hasMultipleSets?: boolean;
    numberOfSets?: number;
  };
  format: 'knockout' | 'roundrobin';
  participantType: 'player' | 'team';
  participants: string[];
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  settings: any;
  winners?: {
    first?: { _id: string; name?: string; displayName?: string; };
    second?: { _id: string; name?: string; displayName?: string; };
    third?: { _id: string; name?: string; displayName?: string; };
  };
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

interface Match {
  _id: string;
  fixtureId: string;
  round: number;
  matchNumber: number;
  homeParticipant?: any;
  awayParticipant?: any;
  homePartner?: any;
  awayPartner?: any;
  homeScore?: number;
  awayScore?: number;
  winner?: any;
  winnerPartner?: any;
  loserPartner?: any;
  status: string;
  scheduledDate?: string;
  actualDate?: string;
  notes?: string;
  nextMatchId?: string;
  previousMatchIds?: string[];
  isThirdPlaceMatch?: boolean;
  scoreDetails?: {
    sets?: Array<{
      setNumber: number;
      homeScore: number;
      awayScore: number;
    }>;
  };
}

interface Participant {
  _id: string;
  name: string;
  email?: string;
  displayName?: string;
  teamLogo?: string;
  teamMemberships?: Array<{
    teamId: string | { _id: string; name: string };
    eventId: string;
    role: string;
  }>;
}

function FixtureDetailContent({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allEventPlayers, setAllEventPlayers] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [teamMap, setTeamMap] = useState<Map<string, string>>(new Map());
  const [updateForm, setUpdateForm] = useState({
    homeScore: 0,
    awayScore: 0,
    status: 'scheduled',
    notes: '',
    homePartner: '',
    awayPartner: '',
    sets: [] as Array<{ setNumber: number; homeScore: number; awayScore: number }>,
    winner: '' as string // Will store participant ID
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [winners, setWinners] = useState({
    first: '',
    second: '',
    third: ''
  });
  const [isSavingWinners, setIsSavingWinners] = useState(false);

  const canManageFixtures = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'captain' || user?.role === 'vicecaptain';
  const isSuperAdmin = user?.role === 'super_admin';
  
  // Check if any matches have been played
  const hasPlayedMatches = matches.some(m => m.status === 'completed' || m.status === 'in_progress');
  
  // Check if this is a doubles fixture
  const isDoubles = fixture?.sportGameId?.isDoubles === true;
  
  // Check if this activity has multiple sets
  const hasMultipleSets = fixture?.sportGameId?.hasMultipleSets === true;
  const numberOfSets = fixture?.sportGameId?.numberOfSets || 1;
  
  // Debug logging
  useEffect(() => {
    if (fixture) {
      console.log('Fixture details:', {
        sportGameId: fixture.sportGameId,
        isDoubles: fixture.sportGameId?.isDoubles,
        participantType: fixture.participantType,
        isDoublesCheck: isDoubles
      });
    }
  }, [fixture, isDoubles]);

  useEffect(() => {
    fetchFixtureDetails();
  }, [resolvedParams.id]);
  
  // Check if tournament has reached semi-finals
  const hasReachedSemiFinals = () => {
    if (fixture?.format !== 'knockout') return false;
    
    // Find the highest round number
    const maxRound = Math.max(...matches.map(m => m.round), 0);
    
    // Semi-finals is typically round maxRound - 1
    // Check if any semi-final matches have been played
    const semiFinalMatches = matches.filter(m => m.round === maxRound - 1);
    return semiFinalMatches.some(m => m.status === 'completed' || m.status === 'in_progress');
  };
  
  // Load saved winners or auto-populate from final match
  useEffect(() => {
    if (fixture?.format === 'knockout') {
      // First check if winners are already saved
      if (fixture.winners) {
        setWinners({
          first: fixture.winners.first?._id || '',
          second: fixture.winners.second?._id || '',
          third: fixture.winners.third?._id || ''
        });
      } else if (matches.length > 0) {
        // Auto-populate from matches if no winners saved
        const maxRound = Math.max(...matches.map(m => m.round));
        const finalMatch = matches.find(m => m.round === maxRound && !m.isThirdPlaceMatch);
        
        if (finalMatch && finalMatch.status === 'completed' && finalMatch.winner) {
          // Set 1st place
          if (finalMatch.winner._id) {
            setWinners(prev => ({ ...prev, first: finalMatch.winner._id }));
          }
          
          // Set 2nd place (loser of final)
          const secondPlace = finalMatch.homeParticipant?._id === finalMatch.winner._id
            ? finalMatch.awayParticipant?._id
            : finalMatch.homeParticipant?._id;
          if (secondPlace) {
            setWinners(prev => ({ ...prev, second: secondPlace }));
          }
        }
        
        // Check for 3rd place match
        const thirdPlaceMatch = matches.find(m => m.isThirdPlaceMatch && m.status === 'completed');
        if (thirdPlaceMatch && thirdPlaceMatch.winner?._id) {
          setWinners(prev => ({ ...prev, third: thirdPlaceMatch.winner._id }));
        }
      }
    }
  }, [fixture, matches]);

  const fetchTeamData = async (eventId: string, matches: Match[]) => {
    try {
      // Get all unique team IDs from player team memberships
      const teamIds = new Set<string>();
      
      matches.forEach(match => {
        ['homeParticipant', 'awayParticipant', 'winner'].forEach(field => {
          const participant = (match as any)[field];
          if (participant && participant.teamMemberships) {
            participant.teamMemberships.forEach((tm: any) => {
              if (tm.eventId === eventId && tm.teamId) {
                teamIds.add(tm.teamId);
              }
            });
          }
        });
      });
      
      // Fetch teams for this event
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/teams?eventId=${eventId}`,
        { withCredentials: true }
      );
      
      // Create a map of teamId to team name
      const newTeamMap = new Map<string, string>();
      response.data.teams.forEach((team: any) => {
        newTeamMap.set(team._id, team.name);
      });
      
      setTeamMap(newTeamMap);
      console.log('Team map created:', Object.fromEntries(newTeamMap));
    } catch (err) {
      console.error('Error fetching team data:', err);
    }
  };

  const fetchFixtureDetails = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${resolvedParams.id}`,
        { withCredentials: true }
      );
      
      setFixture(response.data.fixture);
      setMatches(response.data.matches || []);
      setParticipants(response.data.participants || []);
      setAllEventPlayers(response.data.allEventPlayers || []);
      
      // Debug participants data
      console.log('=== FIXTURE DETAILS DEBUG ===');
      console.log('Participants data:', response.data.participants);
      console.log('Participants length:', response.data.participants?.length);
      console.log('All event players:', response.data.allEventPlayers);
      console.log('All event players length:', response.data.allEventPlayers?.length);
      if (response.data.participants?.length > 0) {
        console.log('First participant full object:', JSON.stringify(response.data.participants[0], null, 2));
        console.log('First participant teamMemberships:', response.data.participants[0].teamMemberships);
      }
      console.log('Fixture sport game:', response.data.fixture.sportGameId);
      console.log('Is doubles fixture?', response.data.fixture.sportGameId?.isDoubles);
      console.log('Fixture event ID:', response.data.fixture.eventId);
      console.log('=== END DEBUG ===');
      
      // Debug: Check if matches have nextMatchId
      console.log('Matches data:', response.data.matches?.map((m: any) => ({
        id: m._id,
        round: m.round,
        matchNumber: m.matchNumber,
        nextMatchId: m.nextMatchId,
        previousMatchIds: m.previousMatchIds
      })));
      
      // If it's a player fixture, fetch team data
      if (response.data.fixture.participantType === 'player' && response.data.fixture.eventId) {
        await fetchTeamData(response.data.fixture.eventId._id, response.data.matches);
      }
      
      // Debug: Log first match with player data
      if (response.data.matches && response.data.matches.length > 0) {
        const firstMatch = response.data.matches[0];
        console.log('First match participant data:', {
          homeParticipant: firstMatch.homeParticipant,
          awayParticipant: firstMatch.awayParticipant
        });
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching fixture details:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch fixture details';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: { [key: string]: string } = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      postponed: 'bg-gray-100 text-gray-800',
      walkover: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Calculate winner based on sets won
  const calculateWinnerFromSets = (sets: Array<{ setNumber: number; homeScore: number; awayScore: number }>) => {
    let homeSetsWon = 0;
    let awaySetsWon = 0;
    
    sets.forEach(set => {
      if (set.homeScore > set.awayScore) {
        homeSetsWon++;
      } else if (set.awayScore > set.homeScore) {
        awaySetsWon++;
      }
    });
    
    return { homeSetsWon, awaySetsWon };
  };

  const handleMatchClick = (match: Match) => {
    // Check if it's a bye match (only one participant)
    const isByeMatch = (match.homeParticipant && !match.awayParticipant) || (!match.homeParticipant && match.awayParticipant);
    
    if (canManageFixtures && match.status !== 'walkover') {
      console.log('Match clicked:', match);
      console.log('Current participants state:', participants);
      console.log('Is doubles?', isDoubles);
      
      setSelectedMatch(match);
      
      // Initialize sets if activity has multiple sets
      let sets: Array<{ setNumber: number; homeScore: number; awayScore: number }> = [];
      if (hasMultipleSets) {
        // If match already has sets data, use it
        if (match.scoreDetails?.sets && match.scoreDetails.sets.length > 0) {
          sets = match.scoreDetails.sets;
        } else {
          // Initialize empty sets
          for (let i = 1; i <= numberOfSets; i++) {
            sets.push({ setNumber: i, homeScore: 0, awayScore: 0 });
          }
        }
      }
      
      setUpdateForm({
        homeScore: match.homeScore || 0,
        awayScore: match.awayScore || 0,
        status: match.status,
        notes: match.notes || '',
        homePartner: match.homePartner?._id || '',
        awayPartner: match.awayPartner?._id || '',
        sets,
        winner: match.winner?._id || ''
      });
      setShowUpdateModal(true);
    }
  };

  const handleUpdateMatch = async () => {
    if (!selectedMatch) return;

    // Check if it's a bye match
    const isByeMatch = (selectedMatch.homeParticipant && !selectedMatch.awayParticipant) || 
                      (!selectedMatch.homeParticipant && selectedMatch.awayParticipant);

    try {
      // For bye matches, automatically set status to walkover
      if (isByeMatch) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture?._id}/matches/${selectedMatch._id}`,
          {
            status: 'walkover',
            notes: 'Bye match - automatic advancement'
          },
          { withCredentials: true }
        );
        
        setShowUpdateModal(false);
        fetchFixtureDetails(); // Refresh data
        return;
      }

      // Calculate scores from sets if applicable
      let homeScore = updateForm.homeScore;
      let awayScore = updateForm.awayScore;
      
      // Prepare score details with sets if applicable
      const scoreDetails: any = {};
      if (hasMultipleSets && updateForm.sets.length > 0) {
        scoreDetails.sets = updateForm.sets;
        
        // Calculate final scores based on sets won
        const { homeSetsWon, awaySetsWon } = calculateWinnerFromSets(updateForm.sets);
        homeScore = homeSetsWon;
        awayScore = awaySetsWon;
      }
      
      // Update match scores and status
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture?._id}/matches/${selectedMatch._id}`,
        {
          homeScore,
          awayScore,
          status: updateForm.status,
          notes: updateForm.notes,
          scoreDetails,
          // Include manual winner override if sets are used and admin/super admin
          ...(hasMultipleSets && updateForm.winner && (user?.role === 'super_admin' || user?.role === 'admin') 
            ? { winnerId: updateForm.winner } 
            : {})
        },
        { withCredentials: true }
      );
      
      // Update partners if this is a doubles fixture
      if (isDoubles && (updateForm.homePartner !== selectedMatch.homePartner?._id || updateForm.awayPartner !== selectedMatch.awayPartner?._id)) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture?._id}/matches/${selectedMatch._id}/partners`,
          {
            homePartner: updateForm.homePartner || null,
            awayPartner: updateForm.awayPartner || null
          },
          { withCredentials: true }
        );
      }
      
      setShowUpdateModal(false);
      fetchFixtureDetails(); // Refresh data
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update match');
    }
  };

  const handleMatchParticipantUpdate = async (matchId: string, updates: any) => {
    if (!fixture) return;

    try {
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture._id}/matches/${matchId}/participants`,
        updates,
        { withCredentials: true }
      );

      if (response.data.success) {
        // Update local state immediately for better UX
        setMatches(prevMatches => 
          prevMatches.map(match => 
            match._id === matchId 
              ? { ...match, ...response.data.match }
              : match
          )
        );
        
        // Refresh full data in background
        fetchFixtureDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update match participants');
      // Refresh to revert changes
      fetchFixtureDetails();
    }
  };

  const getAvailablePartners = (participantId: string | undefined, side: 'home' | 'away'): Participant[] => {
    console.log('=== GET AVAILABLE PARTNERS DEBUG ===');
    console.log('Input:', { participantId, side });
    
    // Use allEventPlayers if available (for doubles), otherwise use participants
    const playerPool = allEventPlayers.length > 0 ? allEventPlayers : participants;
    
    if (!participantId || !fixture || !playerPool || playerPool.length === 0) {
      console.log('Missing required data:', { 
        participantId, 
        hasFixture: !!fixture, 
        playerPoolLength: playerPool?.length,
        isUsingAllEventPlayers: allEventPlayers.length > 0
      });
      return [];
    }
    
    // Find the participant who is selecting a partner
    const participant = playerPool.find(p => p._id === participantId);
    if (!participant) {
      console.log('ERROR: Participant not found in player pool');
      console.log('Looking in pool of', playerPool.length, 'players');
      return [];
    }
    
    console.log('Found participant:', {
      name: participant.name,
      _id: participant._id,
      teamMemberships: participant.teamMemberships
    });
    
    // Get participant's team for this event
    let participantTeamId: string | null = null;
    if (participant.teamMemberships && Array.isArray(participant.teamMemberships)) {
      const membership = participant.teamMemberships.find((tm: any) => {
        const tmEventId = typeof tm.eventId === 'string' ? tm.eventId : tm.eventId?._id;
        const fixtureEventId = typeof fixture.eventId === 'string' ? fixture.eventId : fixture.eventId._id;
        return tmEventId === fixtureEventId;
      });
      
      if (membership) {
        participantTeamId = typeof membership.teamId === 'string' ? membership.teamId : membership.teamId?._id;
        console.log('Participant is from team:', participantTeamId);
      }
    }
    
    if (!participantTeamId) {
      console.log('Participant has no team for this event');
      return [];
    }
    
    // Get all players from the participant's team in this event
    const teamPlayers = playerPool.filter(p => {
      if (p.teamMemberships && Array.isArray(p.teamMemberships)) {
        const membership = p.teamMemberships.find((tm: any) => {
          const tmEventId = typeof tm.eventId === 'string' ? tm.eventId : tm.eventId?._id;
          const fixtureEventId = typeof fixture.eventId === 'string' ? fixture.eventId : fixture.eventId._id;
          return tmEventId === fixtureEventId;
        });
        
        if (membership) {
          const playerTeamId = typeof membership.teamId === 'string' ? membership.teamId : membership.teamId?._id;
          return playerTeamId === participantTeamId;
        }
      }
      return false;
    });
    
    console.log(`Found ${teamPlayers.length} players from the same team`);
    
    // Get all players from this team who are already in ANY match in this fixture
    const teamPlayersInMatches = new Set<string>();
    
    if (matches && Array.isArray(matches)) {
      matches.forEach(match => {
        // Check home participant
        if (match.homeParticipant?._id) {
          const homePlayer = playerPool.find(p => p._id === match.homeParticipant._id);
          if (homePlayer?.teamMemberships) {
            const membership = homePlayer.teamMemberships.find((tm: any) => {
              const tmEventId = typeof tm.eventId === 'string' ? tm.eventId : tm.eventId?._id;
              const fixtureEventId = typeof fixture.eventId === 'string' ? fixture.eventId : fixture.eventId._id;
              return tmEventId === fixtureEventId;
            });
            
            if (membership) {
              const teamId = typeof membership.teamId === 'string' ? membership.teamId : membership.teamId?._id;
              if (teamId === participantTeamId) {
                teamPlayersInMatches.add(match.homeParticipant._id);
              }
            }
          }
        }
        
        // Check away participant
        if (match.awayParticipant?._id) {
          const awayPlayer = playerPool.find(p => p._id === match.awayParticipant._id);
          if (awayPlayer?.teamMemberships) {
            const membership = awayPlayer.teamMemberships.find((tm: any) => {
              const tmEventId = typeof tm.eventId === 'string' ? tm.eventId : tm.eventId?._id;
              const fixtureEventId = typeof fixture.eventId === 'string' ? fixture.eventId : fixture.eventId._id;
              return tmEventId === fixtureEventId;
            });
            
            if (membership) {
              const teamId = typeof membership.teamId === 'string' ? membership.teamId : membership.teamId?._id;
              if (teamId === participantTeamId) {
                teamPlayersInMatches.add(match.awayParticipant._id);
              }
            }
          }
        }
        
        // Also check partners
        if (match.homePartner?._id) teamPlayersInMatches.add(match.homePartner._id);
        if (match.awayPartner?._id) teamPlayersInMatches.add(match.awayPartner._id);
      });
    }
    
    // Don't exclude the current partner being edited
    if (selectedMatch) {
      if (side === 'home' && selectedMatch.homePartner?._id) {
        teamPlayersInMatches.delete(selectedMatch.homePartner._id);
      } else if (side === 'away' && selectedMatch.awayPartner?._id) {
        teamPlayersInMatches.delete(selectedMatch.awayPartner._id);
      }
    }
    
    console.log('Team players already in matches:', Array.from(teamPlayersInMatches));
    
    // Filter to get available partners
    const availablePartners = teamPlayers.filter(p => {
      // Skip the participant themselves
      if (p._id === participantId) {
        console.log(`Skipping ${p.name} - same as participant`);
        return false;
      }
      
      // Skip if already in a match
      if (teamPlayersInMatches.has(p._id)) {
        console.log(`Skipping ${p.name} - already in a match in this fixture`);
        return false;
      }
      
      console.log(`Including ${p.name} as available partner`);
      return true;
    });
    
    console.log('Final available partners:', availablePartners.map(p => ({ name: p.name, _id: p._id })));
    console.log('=== END PARTNER DEBUG ===');
    return availablePartners;
  };

  const handleRandomize = async () => {
    if (!fixture) return;
    
    const confirmMessage = 'Are you sure you want to randomize the bracket? This will regenerate all matches with new random pairings.';
    if (!confirm(confirmMessage)) return;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture._id}/randomize`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success) {
        alert('Bracket randomized successfully!');
        fetchFixtureDetails(); // Refresh data
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to randomize bracket');
    }
  };
  
  const handleSaveWinners = async () => {
    if (!fixture) return;
    
    setIsSavingWinners(true);
    try {
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture._id}/winners`,
        {
          first: winners.first,
          second: winners.second,
          third: winners.third
        },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        alert('Winners saved successfully!');
        fetchFixtureDetails(); // Refresh data
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save winners');
    } finally {
      setIsSavingWinners(false);
    }
  };

  // Helper function to get team name for a player
  const getPlayerTeamName = (participant: any) => {
    if (!participant || !participant.teamMemberships || fixture?.participantType !== 'player') {
      return null;
    }
    
    // Find the team membership for this event
    const membership = participant.teamMemberships.find((tm: any) => 
      tm.eventId === fixture.eventId._id
    );
    
    if (membership && membership.teamId) {
      // Look up team name from our teamMap
      return teamMap.get(membership.teamId) || null;
    }
    
    return null;
  };

  const renderKnockoutBracket = () => {
    const rounds = Math.max(...matches.map(m => m.round));
    const roundMatches: { [key: number]: Match[] } = {};
    
    for (let i = 1; i <= rounds; i++) {
      roundMatches[i] = matches.filter(m => m.round === i).sort((a, b) => a.matchNumber - b.matchNumber);
    }
    
    // Debug logging for odd number scenarios
    if (participants.length % 2 === 1) {
      console.log('Odd number of participants:', participants.length);
      console.log('Round 1 matches:', roundMatches[1]?.length);
      console.log('Round 2 matches:', roundMatches[2]?.length);
      console.log('Match details:', matches.map(m => ({
        id: m._id,
        round: m.round,
        matchNumber: m.matchNumber,
        nextMatchId: m.nextMatchId,
        previousMatchIds: m.previousMatchIds,
        homeParticipant: m.homeParticipant?.name || m.homeParticipant?.displayName || 'BYE',
        awayParticipant: m.awayParticipant?.name || m.awayParticipant?.displayName || 'BYE'
      })));
    }

    const matchHeight = fixture?.participantType === 'player' ? (isDoubles ? 170 : 150) : 125;
    const matchWidth = isDoubles ? 350 : 300;
    const roundGap = 120;
    const matchVerticalGap = 30;

    // Calculate total height needed
    const totalHeight = Math.pow(2, rounds - 1) * (matchHeight + matchVerticalGap);

    // Calculate positions working backwards from the final
    const matchPositions: { [key: string]: number } = {};
    
    // Start with the final round (centered)
    if (roundMatches[rounds]) {
      roundMatches[rounds].forEach((match, idx) => {
        matchPositions[match._id] = totalHeight / 2;
      });
    }
    
    // Work backwards through rounds
    for (let round = rounds - 1; round >= 1; round--) {
      const currentRoundMatches = roundMatches[round] || [];
      const nextRoundMatches = roundMatches[round + 1] || [];
      
      currentRoundMatches.forEach((match, matchIndex) => {
        // Find which match in the next round this feeds into
        const nextMatch = nextRoundMatches.find(nm => 
          match.nextMatchId && (nm._id === match.nextMatchId || nm._id.toString() === match.nextMatchId.toString())
        );
        
        if (nextMatch && matchPositions[nextMatch._id] !== undefined) {
          // Special handling for odd number of participants
          if (round === 1 && participants.length % 2 === 1) {
            // For odd numbers, the single round 1 match should align with where it feeds into round 2
            // Check if the next match already has a participant (bye player)
            const hasHomeParticipant = nextMatch.homeParticipant != null;
            const hasAwayParticipant = nextMatch.awayParticipant != null;
            
            console.log('Round 1 match positioning:', {
              matchId: match._id,
              nextMatchId: nextMatch._id,
              hasHomeParticipant,
              hasAwayParticipant,
              homeParticipant: nextMatch.homeParticipant?.name || nextMatch.homeParticipant?.displayName || 'None',
              awayParticipant: nextMatch.awayParticipant?.name || nextMatch.awayParticipant?.displayName || 'None'
            });
            
            if (hasHomeParticipant && !hasAwayParticipant) {
              // Bye player is in home position, so this match feeds to away position
              const offset = (matchHeight + matchVerticalGap) / 2;
              matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
              console.log('Positioning round 1 match to BOTTOM (away position)');
            } else if (!hasHomeParticipant && hasAwayParticipant) {
              // Bye player is in away position, so this match feeds to home position
              const offset = -(matchHeight + matchVerticalGap) / 2;
              matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
              console.log('Positioning round 1 match to TOP (home position)');
            } else {
              // Check previousMatchIds for position
              const nextMatchPreviousIds = nextMatch.previousMatchIds || [];
              const feedingPosition = nextMatchPreviousIds.findIndex(id => 
                id && (id === match._id || id.toString() === match._id.toString())
              );
              
              if (feedingPosition === 0) {
                // This match feeds to home position (top)
                const offset = -(matchHeight + matchVerticalGap) / 2;
                matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
              } else if (feedingPosition === 1) {
                // This match feeds to away position (bottom)
                const offset = (matchHeight + matchVerticalGap) / 2;
                matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
              } else {
                // Default: align with next match
                matchPositions[match._id] = matchPositions[nextMatch._id];
              }
            }
          } else {
            // Standard logic for other rounds
            const feedingMatches = currentRoundMatches.filter(m => 
              m.nextMatchId && (m.nextMatchId === nextMatch._id || m.nextMatchId.toString() === nextMatch._id.toString())
            );
            
            if (feedingMatches.length === 1) {
              // Single match feeding in - align it with the next match
              matchPositions[match._id] = matchPositions[nextMatch._id];
            } else if (feedingMatches.length === 2) {
              // Two matches feeding in - position them above and below
              const feedingIndex = feedingMatches.findIndex(m => m._id === match._id);
              const offset = (feedingIndex === 0 ? -1 : 1) * (matchHeight + matchVerticalGap) / 2;
              matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
            } else {
              // Multiple matches - distribute evenly
              const spacing = totalHeight / currentRoundMatches.length;
              matchPositions[match._id] = (matchIndex + 0.5) * spacing;
            }
          }
        } else {
          // No next match found - distribute evenly
          const spacing = totalHeight / currentRoundMatches.length;
          matchPositions[match._id] = (matchIndex + 0.5) * spacing;
        }
      });
    }

    return (
      <div 
        className="overflow-x-auto pb-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 print-bracket" 
        id="knockout-bracket"
      >
        <div className="relative print-bracket-container" style={{ minHeight: `${totalHeight + 100}px` }}>
          {Object.entries(roundMatches).map(([round, roundMatchList], roundIndex) => {
            const roundNumber = parseInt(round);
            const matchesInThisRound = roundMatchList.length;
            
            return (
              <div key={round} className="absolute" style={{ left: `${roundIndex * (matchWidth + roundGap)}px` }}>
                <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">
                  {roundNumber === rounds ? 'Final' : 
                   roundNumber === rounds - 1 && rounds > 1 ? 'Semi-Finals' :
                   roundNumber === rounds - 2 && rounds > 2 ? 'Quarter-Finals' :
                   `Round ${round}`}
                </h3>
                
                {roundMatchList.map((match, matchIndex) => {
                  const centerY = matchPositions[match._id] || ((matchIndex + 0.5) * totalHeight / matchesInThisRound);
                  const topPosition = centerY - matchHeight / 2;
                  
                  const isFinalMatch = roundNumber === rounds;
                  const isChampion = isFinalMatch && match.status === 'completed' && match.winner;
                  
                  return (
                    <div key={match._id} className="absolute" style={{ top: `${topPosition + 40}px`, width: `${matchWidth}px` }}>
                      {/* Winner badge for final match */}
                      {isChampion && (
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>
                          </svg>
                          <span>Champion</span>
                        </div>
                      )}
                      {/* Connecting lines for non-final rounds */}
                      {console.log('Line check:', { roundNumber, rounds, hasNextMatchId: !!match.nextMatchId, matchNumber: match.matchNumber })}
                      
                      {/* Draw lines for all non-final matches */}
                      {roundNumber < rounds && (
                        <>
                          {/* Draw all lines from this match */}
                          {(() => {
                            console.log('Inside line drawing function for match', match.matchNumber);
                            
                            // Calculate which match in next round this feeds into
                            const nextRoundMatches = roundMatches[roundNumber + 1] || [];
                            
                            // In a knockout tournament, matches feed into the next round based on position
                            // Match 0,1 -> Match 0 in next round
                            // Match 2,3 -> Match 1 in next round, etc.
                            const nextMatchIndex = Math.floor(matchIndex / 2);
                            const nextMatch = nextRoundMatches[nextMatchIndex];
                            
                            if (!nextMatch) {
                              console.log(`No next match found for match ${match.matchNumber} (looking for index ${nextMatchIndex} in next round)`);
                              return null;
                            }
                            
                            // Calculate positions
                            const currentY = centerY;
                            const nextY = matchPositions[nextMatch._id];
                            
                            if (nextY === undefined) {
                              console.log(`No position found for next match ${nextMatch._id}`);
                              return null;
                            }
                            
                            // Check if another match connects to the same next match
                            // In knockout, the sibling is the other match in the pair (odd/even index)
                            const siblingIndex = matchIndex % 2 === 0 ? matchIndex + 1 : matchIndex - 1;
                            const siblingMatch = roundMatchList[siblingIndex];
                            
                            const elements = [];
                            
                            console.log(`Drawing lines for match ${match.matchNumber}:`, {
                              currentY,
                              nextY,
                              matchWidth,
                              roundGap,
                              matchHeight,
                              hasNextMatch: !!nextMatch,
                              hasSibling: !!siblingMatch
                            });
                            
                            // Always draw horizontal line from current match
                            elements.push(
                              <div
                                key="h-line"
                                className="absolute transition-colors duration-300 print-line"
                                style={{
                                  left: `${matchWidth}px`,
                                  top: `${matchHeight / 2 - 1}px`,
                                  width: `${roundGap / 2}px`,
                                  height: '2px',
                                  backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                  zIndex: 1
                                }}
                              />
                            );
                            
                            // Add connection dot
                            elements.push(
                              <div
                                key="dot"
                                className="absolute transition-all duration-300"
                                style={{
                                  left: `${matchWidth - 3}px`,
                                  top: `${matchHeight / 2 - 3}px`,
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: match.winner ? '#10b981' : '#d1d5db',
                                  border: match.winner ? '2px solid #ecfdf5' : '2px solid white',
                                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                  zIndex: 15
                                }}
                              />
                            );
                            
                            if (siblingMatch) {
                              // Two matches feeding into one - both draw their vertical lines
                              const siblingY = matchPositions[siblingMatch._id];
                              const topY = Math.min(currentY, siblingY);
                              const bottomY = Math.max(currentY, siblingY);
                              const midY = (topY + bottomY) / 2;
                              const isTopMatch = currentY < siblingY;
                              
                              console.log(`Drawing vertical line for ${isTopMatch ? 'top' : 'bottom'} match:`, {
                                matchNumber: match.matchNumber,
                                currentY,
                                siblingY,
                                midY,
                                topY,
                                bottomY,
                                verticalLineHeight: isTopMatch ? midY - currentY : currentY - midY,
                                matchHeight
                              });
                              
                              // Every match draws its vertical line to the midpoint
                              if (isTopMatch) {
                                // Top match: line goes down
                                elements.push(
                                  <div
                                    key="v-line"
                                    className="absolute transition-colors duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 1}px`,
                                      top: `${matchHeight / 2}px`,
                                      width: '2px',
                                      height: `${midY - currentY}px`,
                                      backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                      borderRadius: '0 0 2px 2px',
                                      zIndex: 1
                                    }}
                                  />
                                );
                              } else {
                                // Bottom match: line goes up
                                elements.push(
                                  <div
                                    key="v-line"
                                    className="absolute transition-colors duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 1}px`,
                                      top: `${midY - currentY + matchHeight / 2}px`,
                                      width: '2px',
                                      height: `${currentY - midY}px`,
                                      backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                      borderRadius: '2px 2px 0 0',
                                      zIndex: 1
                                    }}
                                  />
                                );
                              }
                              
                              // Only the top match draws the horizontal line and junction dot
                              if (isTopMatch) {
                                // Horizontal line from junction to next match
                                elements.push(
                                  <div
                                    key="h-line-2"
                                    className="absolute transition-colors duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2}px`,
                                      top: `${matchHeight / 2 + (midY - currentY) - 1}px`,
                                      width: `${roundGap / 2}px`,
                                      height: '2px',
                                      backgroundColor: (match.winner || siblingMatch.winner) ? '#10b981' : '#9ca3af',
                                      zIndex: 1
                                    }}
                                  />
                                );
                                
                                // Junction dot
                                elements.push(
                                  <div
                                    key="junction-dot"
                                    className="absolute transition-all duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 2}px`,
                                      top: `${matchHeight / 2 + (midY - currentY) - 2}px`,
                                      width: '4px',
                                      height: '4px',
                                      borderRadius: '50%',
                                      backgroundColor: (match.winner || siblingMatch.winner) ? '#10b981' : '#d1d5db',
                                      boxShadow: '0 0 0 2px white, 0 1px 2px rgba(0, 0, 0, 0.1)',
                                      zIndex: 15
                                    }}
                                  />
                                );
                              }
                            } else {
                              // Single match - check if vertical adjustment needed
                              const yDiff = nextY - currentY;
                              
                              if (Math.abs(yDiff) > 5) {
                                // Need vertical adjustment
                                elements.push(
                                  <div
                                    key="v-line"
                                    className="absolute transition-colors duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 1}px`,
                                      top: yDiff > 0 ? `${matchHeight / 2}px` : `${matchHeight / 2 + yDiff}px`,
                                      width: '2px',
                                      height: `${Math.abs(yDiff)}px`,
                                      backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                      borderRadius: yDiff > 0 ? '0 0 2px 2px' : '2px 2px 0 0',
                                      zIndex: 1
                                    }}
                                  />
                                );
                                
                                // Extended horizontal line at destination height
                                elements.push(
                                  <div
                                    key="h-line-end"
                                    className="absolute transition-colors duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2}px`,
                                      top: `${matchHeight / 2 + yDiff - 1}px`,
                                      width: `${roundGap / 2}px`,
                                      height: '2px',
                                      backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                      zIndex: 1
                                    }}
                                  />
                                );
                                
                                // Add corner dot for L-shaped connection
                                elements.push(
                                  <div
                                    key="corner-dot"
                                    className="absolute transition-all duration-300"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 2}px`,
                                      top: `${matchHeight / 2 + yDiff - 2}px`,
                                      width: '4px',
                                      height: '4px',
                                      borderRadius: '50%',
                                      backgroundColor: match.winner ? '#10b981' : '#d1d5db',
                                      boxShadow: '0 0 0 2px white, 0 1px 2px rgba(0, 0, 0, 0.1)',
                                      zIndex: 15
                                    }}
                                  />
                                );
                              }
                            }
                            
                            console.log(`Returning ${elements.length} elements for match ${match.matchNumber}`);
                            return <>{elements}</>;
                          })()}
                        </>
                      )}
                      {/* Match card */}
                      {(() => {
                        const isByeMatch = (match.homeParticipant && !match.awayParticipant) || (!match.homeParticipant && match.awayParticipant);
                        return (
                          <div
                            onClick={() => handleMatchClick(match)}
                            className={`relative bg-white border rounded-lg p-3 shadow-md transition-all print-match ${
                              canManageFixtures && match.status !== 'walkover'
                                ? 'cursor-pointer hover:shadow-xl hover:border-indigo-400 hover:scale-[1.02]' 
                                : ''
                            } ${
                              isChampion ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-white shadow-xl print-champion' :
                              match.status === 'completed' ? 'border-green-300 bg-gradient-to-br from-green-50 to-white print-winner' : 'border-gray-300'
                            }`}
                            style={{ height: `${matchHeight}px`, zIndex: 20 }}
                          >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-600">Match {match.matchNumber}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(match.status)}`}>
                            {match.status === 'walkover' ? 'Bye' : 
                             (match.status === 'scheduled' && ((match.homeParticipant && !match.awayParticipant) || (!match.homeParticipant && match.awayParticipant))) ? 'Bye Match' :
                             match.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className={`flex justify-between items-center px-2 py-1 rounded ${
                            match.winner && match.homeParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-300' 
                              : 'hover:bg-gray-50'
                          }`}>
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-sm font-medium text-gray-900" title={match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}>
                                  {match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}
                                </span>
                                {isDoubles && match.homeParticipant && (
                                  <>
                                    {match.homePartner ? (
                                      <>
                                        <span className="text-sm text-gray-600">&</span>
                                        <span className="text-sm font-medium text-gray-900" title={match.homePartner?.name || match.homePartner?.displayName}>
                                          {match.homePartner?.name || match.homePartner?.displayName}
                                        </span>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          console.log('Add partner clicked:', match);
                                          handleMatchClick(match);
                                        }}
                                        className="ml-1 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded font-medium transition-colors"
                                        title="Add partner"
                                      >
                                        + Add Partner
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                              {fixture?.participantType === 'player' && getPlayerTeamName(match.homeParticipant) && (
                                <span className="text-xs text-gray-500 italic">{getPlayerTeamName(match.homeParticipant)}</span>
                              )}
                            </div>
                            {match.homeScore !== undefined && (
                              <span className="text-sm font-bold text-gray-900 ml-2">{match.homeScore}</span>
                            )}
                          </div>
                          
                          <div className="border-t border-gray-100"></div>
                          
                          <div className={`flex justify-between items-center px-2 py-1 rounded ${
                            match.winner && match.awayParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-300' 
                              : 'hover:bg-gray-50'
                          }`}>
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-sm font-medium text-gray-900" title={match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}>
                                  {match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}
                                </span>
                                {isDoubles && match.awayParticipant && (
                                  <>
                                    {match.awayPartner ? (
                                      <>
                                        <span className="text-sm text-gray-600">&</span>
                                        <span className="text-sm font-medium text-gray-900" title={match.awayPartner?.name || match.awayPartner?.displayName}>
                                          {match.awayPartner?.name || match.awayPartner?.displayName}
                                        </span>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          console.log('Add partner clicked:', match);
                                          handleMatchClick(match);
                                        }}
                                        className="ml-1 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded font-medium transition-colors"
                                        title="Add partner"
                                      >
                                        + Add Partner
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                              {fixture?.participantType === 'player' && getPlayerTeamName(match.awayParticipant) && (
                                <span className="text-xs text-gray-500 italic">{getPlayerTeamName(match.awayParticipant)}</span>
                              )}
                            </div>
                            {match.awayScore !== undefined && (
                              <span className="text-sm font-bold text-gray-900 ml-2">{match.awayScore}</span>
                            )}
                          </div>
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRoundRobinMatches = () => {
    const rounds = Math.max(...matches.map(m => m.round));
    
    return (
      <div className="space-y-6">
        {Array.from({ length: rounds }, (_, i) => i + 1).map(round => (
          <div key={round}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Round {round}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches
                .filter(m => m.round === round)
                .map((match) => (
                  <div
                    key={match._id}
                    onClick={() => handleMatchClick(match)}
                    className={`bg-white border rounded-lg p-4 ${
                      canManageFixtures ? 'cursor-pointer hover:shadow-md' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Match {match.matchNumber}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(match.status)}`}>
                        {match.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {match.homeParticipant?.name || match.homeParticipant?.displayName}
                        </span>
                        {match.homeScore !== undefined && (
                          <span className="text-lg font-bold text-gray-900">{match.homeScore}</span>
                        )}
                      </div>
                      
                      <div className="text-center text-sm font-medium text-gray-600">vs</div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {match.awayParticipant?.name || match.awayParticipant?.displayName}
                        </span>
                        {match.awayScore !== undefined && (
                          <span className="text-lg font-bold text-gray-900">{match.awayScore}</span>
                        )}
                      </div>
                    </div>
                    
                    {match.scheduledDate && (
                      <p className="text-sm text-gray-700 mt-3">
                        {formatDate(match.scheduledDate)}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!fixture) return <div>Fixture not found</div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 10mm !important;
          }
          
          /* Force exact colors */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Hide elements */
          .print-hide,
          header,
          nav,
          button,
          .fixed {
            display: none !important;
          }
          
          /* Reset body */
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Layout */
          .min-h-screen {
            min-height: auto !important;
            background: white !important;
          }
          
          .max-w-7xl {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Show print header */
          .print-header {
            display: block !important;
            text-align: center !important;
            margin-bottom: 20px !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 10px !important;
          }
          
          .print-header h1 {
            font-size: 24px !important;
            color: #000 !important;
            margin-bottom: 8px !important;
          }
          
          .print-header p {
            font-size: 14px !important;
            color: #000 !important;
            margin: 4px 0 !important;
          }
          
          /* Tournament bracket */
          #knockout-bracket {
            overflow: visible !important;
            background: white !important;
            padding: 10px !important;
            width: 100% !important;
            transform: scale(0.85) !important;
            transform-origin: top left !important;
          }
          
          /* Match cards */
          #knockout-bracket .bg-white {
            border: 1px solid #000 !important;
            background: white !important;
            box-shadow: none !important;
          }
          
          /* Winner highlighting */
          #knockout-bracket .bg-green-100 {
            background-color: #e0e0e0 !important;
            border: 2px solid #000 !important;
          }
          
          /* Champion card */
          #knockout-bracket .border-yellow-400 {
            border: 3px solid #000 !important;
            background: #f0f0f0 !important;
          }
          
          /* Connection lines - force black */
          #knockout-bracket div[style*="backgroundColor: rgb(16, 185, 129)"],
          #knockout-bracket div[style*="background-color: rgb(16, 185, 129)"] {
            background-color: #000 !important;
          }
          
          #knockout-bracket div[style*="backgroundColor: rgb(156, 163, 175)"],
          #knockout-bracket div[style*="background-color: rgb(156, 163, 175)"] {
            background-color: #666 !important;
          }
          
          /* All text black */
          #knockout-bracket * {
            color: #000 !important;
          }
          
          /* Hide interactive elements */
          .hover\\:shadow-xl,
          .hover\\:scale-\\[1\\.02\\],
          .transition-all,
          .cursor-pointer {
            cursor: default !important;
          }
          
          /* Remove all decorative styles */
          .shadow,
          .shadow-md,
          .shadow-lg,
          .shadow-xl {
            box-shadow: none !important;
          }
          
          .rounded,
          .rounded-md,
          .rounded-lg {
            border-radius: 0 !important;
          }
          
          /* For large tournaments */
          @media (min-width: 250mm) {
            #knockout-bracket {
              transform: scale(0.7) !important;
            }
          }
        }
      ` }} />
    <div className="min-h-screen bg-gray-100">
      <div className="print-hide">
        <Header />
      </div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6 print-hide">
            <Link href="/fixtures" className="text-indigo-600 hover:text-indigo-900 mb-2 inline-block">
              ← Back to Fixtures
            </Link>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{fixture.name}</h1>
                {fixture.description && (
                  <p className="text-gray-600 mt-1">{fixture.description}</p>
                )}
              </div>
              <div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  fixture.format === 'knockout' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {fixture.format === 'knockout' ? 'Knockout' : 'Round Robin'}
                </span>
              </div>
            </div>
          </div>

          {/* Fixture Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6 print-hide">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Fixture Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Event</p>
                <p className="font-medium text-gray-900">{fixture.eventId.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Sport/Game</p>
                <p className="font-medium text-gray-900">
                  {fixture.sportGameId.title} ({fixture.sportGameId.type})
                  {fixture.sportGameId.isDoubles && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                      Doubles
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Participants</p>
                <p className="font-medium text-gray-900">{participants?.length || 0} {fixture.participantType === 'team' ? 'Teams' : 'Players'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Start Date</p>
                <p className="font-medium text-gray-900">{formatDate(fixture.startDate)}</p>
              </div>
              {fixture.endDate && (
                <div>
                  <p className="text-sm font-medium text-gray-700">End Date</p>
                  <p className="font-medium text-gray-900">{formatDate(fixture.endDate)}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700">Created By</p>
                <p className="font-medium text-gray-900">{fixture.createdBy.name}</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white shadow rounded-lg p-6 mb-6 print-hide">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Participants</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {participants?.map((participant) => (
                <div key={participant._id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-900 font-medium">{participant.name || participant.displayName}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Winners Section - Only for knockout tournaments */}
          {fixture?.format === 'knockout' && hasReachedSemiFinals() && (
            <div className="bg-white shadow rounded-lg p-6 mb-6 print-hide">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Winners</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1st Place */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="inline-flex items-center">
                      <span className="text-2xl mr-2">🥇</span>
                      1st Place
                    </span>
                  </label>
                  <select
                    value={winners.first}
                    onChange={(e) => setWinners(prev => ({ ...prev, first: e.target.value }))}
                    disabled={!(user?.role === 'super_admin' || user?.role === 'admin')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select winner</option>
                    {participants?.map((participant) => (
                      <option key={participant._id} value={participant._id}>
                        {participant.name || participant.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 2nd Place */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="inline-flex items-center">
                      <span className="text-2xl mr-2">🥈</span>
                      2nd Place
                    </span>
                  </label>
                  <select
                    value={winners.second}
                    onChange={(e) => setWinners(prev => ({ ...prev, second: e.target.value }))}
                    disabled={!(user?.role === 'super_admin' || user?.role === 'admin')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select runner-up</option>
                    {participants?.filter(p => p._id !== winners.first).map((participant) => (
                      <option key={participant._id} value={participant._id}>
                        {participant.name || participant.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 3rd Place */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="inline-flex items-center">
                      <span className="text-2xl mr-2">🥉</span>
                      3rd Place
                    </span>
                  </label>
                  <select
                    value={winners.third}
                    onChange={(e) => setWinners(prev => ({ ...prev, third: e.target.value }))}
                    disabled={!(user?.role === 'super_admin' || user?.role === 'admin')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select 3rd place</option>
                    {participants?.filter(p => p._id !== winners.first && p._id !== winners.second).map((participant) => (
                      <option key={participant._id} value={participant._id}>
                        {participant.name || participant.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Save button - only for admin/super admin */}
              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveWinners}
                    disabled={isSavingWinners || !winners.first || !winners.second}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingWinners ? 'Saving...' : 'Save Winners'}
                  </button>
                </div>
              )}
              
              {/* Info message for non-admins */}
              {!(user?.role === 'super_admin' || user?.role === 'admin') && (
                <p className="mt-4 text-sm text-gray-500">
                  Winners can only be edited by administrators.
                </p>
              )}
            </div>
          )}

          {/* Matches/Bracket */}
          <div className="bg-white shadow rounded-lg p-6">
            {/* Print header - only visible during print */}
            <div className="print-header" style={{ display: 'none' }}>
              <h1 className="text-2xl font-bold text-gray-900 text-center">{fixture.name}</h1>
              <p className="text-lg text-gray-700 text-center mt-2">
                {fixture.eventId.name} - {fixture.sportGameId.title}
              </p>
              <p className="text-sm text-gray-600 text-center mt-1">
                {formatDate(fixture.startDate)}
              </p>
            </div>
            
            <div className="flex justify-between items-center mb-4 print-hide">
              <h2 className="text-lg font-medium text-gray-900">
                {fixture.format === 'knockout' ? 'Tournament Bracket' : 'Matches'}
              </h2>
              <div className="flex items-center space-x-4">
                {/* Randomize button for super admin on knockout fixtures with teams */}
                {isSuperAdmin && fixture.format === 'knockout' && fixture.participantType === 'team' && !hasPlayedMatches && (
                  <button
                    onClick={handleRandomize}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center space-x-2 print:hidden"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Randomize Bracket</span>
                  </button>
                )}
                {/* Edit Fixture button for super admin on player knockout fixtures */}
                {isSuperAdmin && fixture.format === 'knockout' && fixture.participantType === 'player' && (
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`px-4 py-2 ${isEditMode ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-md flex items-center space-x-2 print:hidden transition-colors`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isEditMode ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      )}
                    </svg>
                    <span>{isEditMode ? 'Cancel Edit' : 'Edit Fixture'}</span>
                  </button>
                )}
                {/* Print button for knockout fixtures */}
                {fixture.format === 'knockout' && (
                  <button
                    onClick={() => {
                      // Add print class to body
                      document.body.classList.add('printing-bracket');
                      
                      // Force a small delay to ensure styles are applied
                      setTimeout(() => {
                        window.print();
                        
                        // Remove print class after printing
                        setTimeout(() => {
                          document.body.classList.remove('printing-bracket');
                        }, 500);
                      }, 100);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2 print:hidden"
                    title="Print tournament bracket"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" 
                      />
                    </svg>
                    <span>Print</span>
                  </button>
                )}
                {fixture.format === 'knockout' && (
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-1"></div>
                      <span className="text-gray-600">Winner</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded mr-1"></div>
                      <span className="text-gray-600">Pending</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1">
                        <line x1="0" y1="8" x2="16" y2="8" stroke="#10b981" strokeWidth="2" />
                      </svg>
                      <span className="text-gray-600">Winner Path</span>
                    </div>
                  </div>
                )}
                {fixture.format === 'roundrobin' && (
                  <Link
                    href={`/fixtures/${fixture._id}/standings`}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    View Standings →
                  </Link>
                )}
              </div>
            </div>
            
            {fixture.format === 'knockout' ? (
              <div className="relative">
                {!isEditMode && (
                  <div className="absolute top-0 right-0 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded print:hidden">
                    Scroll horizontally to view all rounds →
                  </div>
                )}
                {isEditMode ? (
                  <EditableKnockoutBracket
                    matches={matches}
                    participants={participants}
                    onMatchUpdate={handleMatchParticipantUpdate}
                    fixture={fixture}
                    teamMap={teamMap}
                    getPlayerTeamName={getPlayerTeamName}
                  />
                ) : (
                  renderKnockoutBracket()
                )}
              </div>
            ) : renderRoundRobinMatches()}
          </div>
        </div>
      </div>

      {/* Update Match Modal */}
      {showUpdateModal && selectedMatch && (() => {
        // Define isByeMatch for the modal
        const isByeMatch = (selectedMatch.homeParticipant && !selectedMatch.awayParticipant) || 
                          (!selectedMatch.homeParticipant && selectedMatch.awayParticipant);
        
        return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 print:hidden p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Update Match</h3>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-4">
              {/* Special message for bye matches */}
              {isByeMatch && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    This is a bye match. Click "Update Match" to advance {selectedMatch.homeParticipant?.name || selectedMatch.awayParticipant?.name} to the next round.
                  </p>
                </div>
              )}
              
              {!isByeMatch && (
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setUpdateForm({ ...updateForm, status: newStatus });
                    
                    // Auto-calculate winner when status is set to completed
                    if (newStatus === 'completed' && hasMultipleSets && updateForm.sets.length > 0) {
                      const { homeSetsWon, awaySetsWon } = calculateWinnerFromSets(updateForm.sets);
                      if (homeSetsWon > awaySetsWon && selectedMatch.homeParticipant) {
                        setUpdateForm(prev => ({ ...prev, status: newStatus, winner: selectedMatch.homeParticipant._id }));
                      } else if (awaySetsWon > homeSetsWon && selectedMatch.awayParticipant) {
                        setUpdateForm(prev => ({ ...prev, status: newStatus, winner: selectedMatch.awayParticipant._id }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              )}
              
              {/* Partner Selection for Doubles */}
              {!isByeMatch && isDoubles && fixture?.participantType === 'player' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      {selectedMatch.homeParticipant?.name || 'Home'} Partner
                    </label>
                    <select
                      value={updateForm.homePartner}
                      onChange={(e) => setUpdateForm({ ...updateForm, homePartner: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    >
                      <option value="">Select Partner</option>
                      {participants && participants.length > 0 ? (
                        getAvailablePartners(selectedMatch.homeParticipant?._id, 'home').length > 0 ? (
                          getAvailablePartners(selectedMatch.homeParticipant?._id, 'home')
                            .map(p => (
                              <option key={p._id} value={p._id}>
                                {p.name || p.displayName}
                              </option>
                            ))
                        ) : (
                          <option disabled>No available partners</option>
                        )
                      ) : (
                        <option disabled>Loading participants...</option>
                      )}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      {selectedMatch.awayParticipant?.name || 'Away'} Partner
                    </label>
                    <select
                      value={updateForm.awayPartner}
                      onChange={(e) => setUpdateForm({ ...updateForm, awayPartner: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    >
                      <option value="">Select Partner</option>
                      {participants && participants.length > 0 ? (
                        getAvailablePartners(selectedMatch.awayParticipant?._id, 'away').length > 0 ? (
                          getAvailablePartners(selectedMatch.awayParticipant?._id, 'away')
                            .map(p => (
                              <option key={p._id} value={p._id}>
                                {p.name || p.displayName}
                              </option>
                            ))
                        ) : (
                          <option disabled>No available partners</option>
                        )
                      ) : (
                        <option disabled>Loading participants...</option>
                      )}
                    </select>
                  </div>
                </div>
              )}
              
              {/* Set-wise scores for activities with multiple sets */}
              {!isByeMatch && hasMultipleSets && updateForm.sets.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Set Scores</label>
                  {/* Team/Player names header */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div></div>
                    <div className="text-xs font-medium text-gray-600 text-center">
                      {selectedMatch.homeParticipant?.name || 'Home'}
                    </div>
                    <div className="text-xs font-medium text-gray-600 text-center">
                      {selectedMatch.awayParticipant?.name || 'Away'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {updateForm.sets.map((set, index) => {
                      const homeWon = set.homeScore > set.awayScore;
                      const awayWon = set.awayScore > set.homeScore;
                      
                      return (
                        <div key={set.setNumber} className="grid grid-cols-3 gap-2 items-center">
                          <div className="text-sm font-medium text-gray-700 text-center">
                            Set {set.setNumber}
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={set.homeScore}
                              onChange={(e) => {
                                const newSets = [...updateForm.sets];
                                newSets[index] = { ...set, homeScore: parseInt(e.target.value) || 0 };
                                setUpdateForm({ ...updateForm, sets: newSets });
                                
                                // Auto-calculate winner if status is completed
                                if (updateForm.status === 'completed') {
                                  const { homeSetsWon, awaySetsWon } = calculateWinnerFromSets(newSets);
                                  if (homeSetsWon > awaySetsWon && selectedMatch.homeParticipant) {
                                    setUpdateForm(prev => ({ ...prev, sets: newSets, winner: selectedMatch.homeParticipant._id }));
                                  } else if (awaySetsWon > homeSetsWon && selectedMatch.awayParticipant) {
                                    setUpdateForm(prev => ({ ...prev, sets: newSets, winner: selectedMatch.awayParticipant._id }));
                                  } else {
                                    setUpdateForm(prev => ({ ...prev, sets: newSets, winner: '' }));
                                  }
                                }
                              }}
                              className={`w-full px-2 py-1 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 text-center ${
                                homeWon ? 'border-green-500 bg-green-50' : 'border-gray-300'
                              }`}
                            />
                            {homeWon && (
                              <div className="absolute -right-1 -top-1 w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={set.awayScore}
                              onChange={(e) => {
                                const newSets = [...updateForm.sets];
                                newSets[index] = { ...set, awayScore: parseInt(e.target.value) || 0 };
                                setUpdateForm({ ...updateForm, sets: newSets });
                                
                                // Auto-calculate winner if status is completed
                                if (updateForm.status === 'completed') {
                                  const { homeSetsWon, awaySetsWon } = calculateWinnerFromSets(newSets);
                                  if (homeSetsWon > awaySetsWon && selectedMatch.homeParticipant) {
                                    setUpdateForm(prev => ({ ...prev, sets: newSets, winner: selectedMatch.homeParticipant._id }));
                                  } else if (awaySetsWon > homeSetsWon && selectedMatch.awayParticipant) {
                                    setUpdateForm(prev => ({ ...prev, sets: newSets, winner: selectedMatch.awayParticipant._id }));
                                  } else {
                                    setUpdateForm(prev => ({ ...prev, sets: newSets, winner: '' }));
                                  }
                                }
                              }}
                              className={`w-full px-2 py-1 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 text-center ${
                                awayWon ? 'border-green-500 bg-green-50' : 'border-gray-300'
                              }`}
                            />
                            {awayWon && (
                              <div className="absolute -right-1 -top-1 w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const { homeSetsWon, awaySetsWon } = calculateWinnerFromSets(updateForm.sets);
                    return (
                      <div className="mt-2 text-sm font-medium text-center">
                        <span className={homeSetsWon > awaySetsWon ? 'text-green-600' : 'text-gray-600'}>
                          {selectedMatch.homeParticipant?.name || 'Home'}: {homeSetsWon}
                        </span>
                        <span className="mx-2 text-gray-400">-</span>
                        <span className={awaySetsWon > homeSetsWon ? 'text-green-600' : 'text-gray-600'}>
                          {selectedMatch.awayParticipant?.name || 'Away'}: {awaySetsWon}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Winner Selection for Sets or Score input for regular matches */}
              {!isByeMatch && hasMultipleSets ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Match Winner</label>
                  <div className="space-y-2">
                    {selectedMatch.homeParticipant && (
                      <label className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="winner"
                          value={selectedMatch.homeParticipant._id}
                          checked={updateForm.winner === selectedMatch.homeParticipant._id}
                          onChange={(e) => setUpdateForm({ ...updateForm, winner: e.target.value })}
                          disabled={user?.role !== 'super_admin' && user?.role !== 'admin'}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {selectedMatch.homeParticipant.name || selectedMatch.homeParticipant.displayName}
                        </span>
                        {(() => {
                          const { homeSetsWon } = calculateWinnerFromSets(updateForm.sets);
                          return homeSetsWon > 0 && (
                            <span className="text-xs text-gray-500">({homeSetsWon} sets won)</span>
                          );
                        })()}
                      </label>
                    )}
                    {selectedMatch.awayParticipant && (
                      <label className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="winner"
                          value={selectedMatch.awayParticipant._id}
                          checked={updateForm.winner === selectedMatch.awayParticipant._id}
                          onChange={(e) => setUpdateForm({ ...updateForm, winner: e.target.value })}
                          disabled={user?.role !== 'super_admin' && user?.role !== 'admin'}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {selectedMatch.awayParticipant.name || selectedMatch.awayParticipant.displayName}
                        </span>
                        {(() => {
                          const { awaySetsWon } = calculateWinnerFromSets(updateForm.sets);
                          return awaySetsWon > 0 && (
                            <span className="text-xs text-gray-500">({awaySetsWon} sets won)</span>
                          );
                        })()}
                      </label>
                    )}
                  </div>
                  {user?.role !== 'super_admin' && user?.role !== 'admin' && (
                    <p className="mt-2 text-xs text-gray-500">
                      Only Super Admins and Admins can manually override the match winner.
                    </p>
                  )}
                </div>
              ) : !isByeMatch ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      {selectedMatch.homeParticipant?.name || 'Home'} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={updateForm.homeScore}
                      onChange={(e) => setUpdateForm({ ...updateForm, homeScore: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      {selectedMatch.awayParticipant?.name || 'Away'} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={updateForm.awayScore}
                      onChange={(e) => setUpdateForm({ ...updateForm, awayScore: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>
                </div>
              ) : null}
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
                <textarea
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMatch}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Update Match
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
    </>
  );
}

export default function FixtureDetailPage({ params }: { params: Promise<Params> }) {
  return (
    <AuthGuard>
      <FixtureDetailContent params={params} />
    </AuthGuard>
  );
}