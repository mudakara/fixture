'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import axios from 'axios';

interface Match {
  _id: string;
  fixtureId: string;
  round: number;
  matchNumber: number;
  homeParticipant?: any;
  awayParticipant?: any;
  homeScore?: number;
  awayScore?: number;
  winner?: any;
  status: string;
  nextMatchId?: string;
  previousMatchIds?: string[];
}

interface Participant {
  _id: string;
  name: string;
  email?: string;
  displayName?: string;
}

interface Props {
  matches: Match[];
  participants: Participant[];
  onMatchUpdate: (matchId: string, updates: any) => Promise<void>;
  fixture: any;
  teamMap: Map<string, string>;
  getPlayerTeamName: (participant: any) => string | null;
}

function DraggableParticipant({ participant, matchId, position, teamName }: { 
  participant: any; 
  matchId: string; 
  position: 'home' | 'away';
  teamName: string | null;
}) {
  const id = `${matchId}-${position}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { participant, matchId, position } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  if (!participant) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-10 px-2 py-1 bg-gray-100 border-2 border-dashed border-gray-300 rounded text-sm text-gray-500"
      >
        Drop player here
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col justify-center px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 active:cursor-grabbing min-h-[2.5rem]"
    >
      <span className="text-sm font-medium text-gray-900">
        {participant.name || participant.displayName}
      </span>
      {teamName && (
        <span className="text-xs text-gray-500">
          {teamName}
        </span>
      )}
    </div>
  );
}

export default function EditableKnockoutBracket({
  matches,
  participants,
  onMatchUpdate,
  fixture,
  teamMap,
  getPlayerTeamName,
}: Props) {
  const [localMatches, setLocalMatches] = useState<Match[]>(matches);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);

  useEffect(() => {
    setLocalMatches(matches);
  }, [matches]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveData(null);
      return;
    }

    const activeData = active.data.current;
    const overId = over.id as string;
    
    if (!activeData) {
      setActiveId(null);
      setActiveData(null);
      return;
    }
    
    // Parse the over ID to get match and position
    const [targetMatchId, targetPosition] = overId.split('-');
    
    // Find the source and target matches
    const sourceMatch = localMatches.find(m => m._id === activeData.matchId);
    const targetMatch = localMatches.find(m => m._id === targetMatchId);
    
    if (!sourceMatch || !targetMatch) {
      setActiveId(null);
      setActiveData(null);
      return;
    }

    // Don't allow dropping on the same position
    if (activeData.matchId === targetMatchId && activeData.position === targetPosition) {
      setActiveId(null);
      setActiveData(null);
      return;
    }

    // Prepare the update
    const updates: any = {};
    
    // Get the participant being moved
    const movingParticipant = activeData.position === 'home' 
      ? sourceMatch.homeParticipant 
      : sourceMatch.awayParticipant;

    // Get the participant at the target position (if any)
    const targetParticipant = targetPosition === 'home'
      ? targetMatch.homeParticipant
      : targetMatch.awayParticipant;

    // Update the target match
    if (targetPosition === 'home') {
      updates.homeParticipant = movingParticipant?._id || null;
    } else {
      updates.awayParticipant = movingParticipant?._id || null;
    }

    // If swapping (there's a participant at the target), update the source match
    if (targetParticipant && activeData.matchId !== targetMatchId) {
      const sourceUpdates: any = {};
      if (activeData.position === 'home') {
        sourceUpdates.homeParticipant = targetParticipant._id;
      } else {
        sourceUpdates.awayParticipant = targetParticipant._id;
      }
      
      // Update source match
      await onMatchUpdate(sourceMatch._id, sourceUpdates);
    } else if (activeData.matchId !== targetMatchId) {
      // Clear the source position if not swapping
      const sourceUpdates: any = {};
      if (activeData.position === 'home') {
        sourceUpdates.homeParticipant = null;
      } else {
        sourceUpdates.awayParticipant = null;
      }
      
      // Update source match
      await onMatchUpdate(sourceMatch._id, sourceUpdates);
    }

    // Update target match
    await onMatchUpdate(targetMatch._id, updates);
    
    setActiveId(null);
    setActiveData(null);
  };

  // Group matches by round
  const rounds = Math.max(...localMatches.map(m => m.round));
  const roundMatches: { [key: number]: Match[] } = {};
  
  for (let i = 1; i <= rounds; i++) {
    roundMatches[i] = localMatches.filter(m => m.round === i).sort((a, b) => a.matchNumber - b.matchNumber);
  }

  const matchHeight = 140;
  const matchWidth = 300;
  const roundGap = 120;
  const matchVerticalGap = 30;
  const totalHeight = Math.pow(2, rounds - 1) * (matchHeight + matchVerticalGap);

  // Calculate match positions
  const matchPositions: { [key: string]: number } = {};
  
  // Position final match
  if (roundMatches[rounds]) {
    roundMatches[rounds].forEach((match) => {
      matchPositions[match._id] = totalHeight / 2;
    });
  }
  
  // Position other rounds
  for (let round = rounds - 1; round >= 1; round--) {
    const currentRoundMatches = roundMatches[round] || [];
    const nextRoundMatches = roundMatches[round + 1] || [];
    
    currentRoundMatches.forEach((match, matchIndex) => {
      const nextMatch = nextRoundMatches.find(nm => 
        match.nextMatchId && (nm._id === match.nextMatchId || nm._id.toString() === match.nextMatchId.toString())
      );
      
      if (nextMatch && matchPositions[nextMatch._id] !== undefined) {
        const feedingMatches = currentRoundMatches.filter(m => 
          m.nextMatchId && (m.nextMatchId === nextMatch._id || m.nextMatchId.toString() === nextMatch._id.toString())
        );
        
        if (feedingMatches.length === 2) {
          const feedingIndex = feedingMatches.findIndex(m => m._id === match._id);
          const offset = (feedingIndex === 0 ? -1 : 1) * (matchHeight + matchVerticalGap) / 2;
          matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
        } else {
          matchPositions[match._id] = matchPositions[nextMatch._id];
        }
      } else {
        const spacing = totalHeight / currentRoundMatches.length;
        matchPositions[match._id] = (matchIndex + 0.5) * spacing;
      }
    });
  }

  // Get all droppable IDs
  const droppableIds = localMatches.flatMap(match => [
    `${match._id}-home`,
    `${match._id}-away`
  ]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border-2 border-orange-200">
        <div className="mb-4 flex items-center space-x-2 text-orange-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Edit Mode: Drag players to rearrange matches</span>
        </div>
        
        <div className="relative" style={{ minHeight: `${totalHeight + 100}px` }}>
          <SortableContext items={droppableIds} strategy={verticalListSortingStrategy}>
            {Object.entries(roundMatches).map(([round, roundMatchList], roundIndex) => {
              const roundNumber = parseInt(round);
              
              return (
                <div key={round} className="absolute" style={{ left: `${roundIndex * (matchWidth + roundGap)}px` }}>
                  <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">
                    {roundNumber === rounds ? 'Final' : 
                     roundNumber === rounds - 1 && rounds > 1 ? 'Semi-Finals' :
                     roundNumber === rounds - 2 && rounds > 2 ? 'Quarter-Finals' :
                     `Round ${round}`}
                  </h3>
                  
                  {roundMatchList.map((match) => {
                    const centerY = matchPositions[match._id] || 0;
                    const topPosition = centerY - matchHeight / 2;
                    const isByeMatch = (match.homeParticipant && !match.awayParticipant) || (!match.homeParticipant && match.awayParticipant);
                    
                    return (
                      <div key={match._id} className="absolute" style={{ top: `${topPosition + 40}px`, width: `${matchWidth}px` }}>
                        <div
                          className={`relative bg-white border-2 ${isByeMatch ? 'border-gray-300' : 'border-orange-300'} rounded-lg p-3 shadow-md`}
                          style={{ height: `${matchHeight}px` }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-gray-600">Match {match.matchNumber}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              match.status === 'completed' ? 'bg-green-100 text-green-800' :
                              isByeMatch ? 'bg-gray-100 text-gray-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {isByeMatch ? 'Bye Match' : 'Editable'}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {/* Home participant */}
                            <DraggableParticipant 
                              participant={match.homeParticipant}
                              matchId={match._id}
                              position="home"
                              teamName={match.homeParticipant ? getPlayerTeamName(match.homeParticipant) : null}
                            />
                            
                            <div className="text-center text-xs text-gray-500">vs</div>
                            
                            {/* Away participant */}
                            <DraggableParticipant 
                              participant={match.awayParticipant}
                              matchId={match._id}
                              position="away"
                              teamName={match.awayParticipant ? getPlayerTeamName(match.awayParticipant) : null}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </SortableContext>
        </div>
      </div>
      
      <DragOverlay>
        {activeId && activeData ? (
          <div className="bg-white border-2 border-indigo-500 rounded px-3 py-2 shadow-lg">
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {activeData.participant?.name || activeData.participant?.displayName || 'Empty'}
              </span>
              {activeData.participant && getPlayerTeamName(activeData.participant) && (
                <span className="text-xs text-gray-500">
                  {getPlayerTeamName(activeData.participant)}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}