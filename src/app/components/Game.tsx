'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc, onSnapshot, setDoc, addDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../firebase/AuthContext';
import { updateGameStats } from '../../firebase/auth';
import GameBoard from './GameBoard';
import ShipPlacement from './ShipPlacement';
import { Cell, GameState, Ship } from '../../utils/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection } from 'firebase/firestore';
import { BattleshipAI, Difficulty } from '../../utils/ai';

interface GameProps {
  gameId: string;
  playerId: string;
  isSinglePlayer?: boolean;
  difficulty?: Difficulty;
}

const BOARD_SIZE = 10;

const createEmptyBoard = () => {
  const board: Cell[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      board.push({
        x,
        y,
        isHit: false,
        hasShip: false,
      });
    }
  }
  return board;
};

const convertToGrid = (board: Cell[]): Cell[][] => {
  const grid: Cell[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  board.forEach(cell => {
    grid[cell.y][cell.x] = cell;
  });
  return grid;
};

type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

const markCellAsHit = (board: Cell[][], x: number, y: number): Cell[][] => {
  return board.map((row, currentY) =>
    row.map((cell, currentX) =>
      currentX === x && currentY === y ? { ...cell, isHit: true } : cell
    )
  );
};

const applySunkStatus = (board: Cell[][], shipType: ShipType): Cell[][] => {
  return board.map(row =>
    row.map(cell =>
      cell.shipType === shipType ? { ...cell, isSunkShip: true } : cell
    )
  );
};

// Helper function to check if a ship is sunk and update the board
const checkAndMarkSunkShips = (board: Cell[][], shipType: ShipType): { updatedBoard: Cell[][], wasSunk: boolean } => {
  const shipCells = board.flat().filter(cell => cell.shipType === shipType);
  const isSunk = shipCells.length > 0 && shipCells.every(cell => cell.isHit);
  let updatedBoard = board;

  if (isSunk) {
    console.log(`[Sunk Check] Ship type ${shipType} was sunk!`);
    updatedBoard = applySunkStatus(board, shipType);
  }

  return { updatedBoard, wasSunk: isSunk };
};

// Helper function to check if all ships of the opponent/player are sunk
const checkWinCondition = (board: Cell[][]): boolean => {
  const allShipCells = board.flat().filter(cell => cell.hasShip);
  // Ensure there are ships on the board before checking
  return allShipCells.length > 0 && allShipCells.every(cell => cell.isHit);
};

const Game: React.FC<GameProps> = ({ gameId, playerId, isSinglePlayer = false, difficulty = 'medium' }) => {
  // Auto-detect single player mode from gameId
  const isAIGame = gameId.startsWith('ai_');
  const effectiveSinglePlayer = isSinglePlayer || isAIGame;
  
  const { currentUser } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'placing' | 'playing' | 'finished'>('waiting');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(false);
  const [showTurnModal, setShowTurnModal] = useState<boolean>(false);
  const [turnMessage, setTurnMessage] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [attemptingReconnect, setAttemptingReconnect] = useState<boolean>(false);
  const [playerBoard, setPlayerBoard] = useState<Cell[][]>(convertToGrid(createEmptyBoard()));
  const [opponentBoard, setOpponentBoard] = useState<Cell[][]>(convertToGrid(createEmptyBoard()));
  const [gameMessage, setGameMessage] = useState<string>('Ansluter till spelet...');
  const [aiOpponent, setAIOpponent] = useState<BattleshipAI | null>(null);
  const [aiIsProcessing, setAiIsProcessing] = useState<boolean>(false);
  const router = useRouter();

  // Track remaining ships for both players
  const [playerShips, setPlayerShips] = useState({
    carrier: { size: 5, name: 'Air craft carrier', sunk: false },
    battleship: { size: 4, name: 'Battleship', sunk: false },
    cruiser: { size: 3, name: 'Cruiser', sunk: false },
    submarine: { size: 3, name: 'Submarine', sunk: false },
    destroyer: { size: 2, name: 'Destroyer', sunk: false }
  });
  
  const [opponentShips, setOpponentShips] = useState({
    carrier: { size: 5, name: 'Air craft carrier', sunk: false },
    battleship: { size: 4, name: 'Battleship', sunk: false },
    cruiser: { size: 3, name: 'Cruiser', sunk: false },
    submarine: { size: 3, name: 'Submarine', sunk: false },
    destroyer: { size: 2, name: 'Destroyer', sunk: false }
  });

  // Log detected game type
  useEffect(() => {
    if (effectiveSinglePlayer) {
      console.log('Single player game detected:', { gameId, isAIGame, isSinglePlayer });
    } else {
      console.log('Multiplayer game detected:', { gameId });
    }
  }, [gameId, isAIGame, isSinglePlayer, effectiveSinglePlayer]);

  // Initialize single player game
  useEffect(() => {
    if (effectiveSinglePlayer) {
      console.log('Initializing single player game...');
      try {
        const ai = new BattleshipAI({ difficulty, boardSize: BOARD_SIZE });
        setAIOpponent(ai);
        
        // Place AI's ships
        console.log('Placing AI ships...');
        const aiBoard = ai.placeShips();
        
        // Verifiera att AI:n kunde placera alla skepp genom att räkna antalet skepp
        const shipCellCount = aiBoard.flat().filter(cell => cell.hasShip).length;
        console.log(`AI placed ships: ${shipCellCount} cells have ships`);
        
        if (shipCellCount < 17) { // 5+4+3+3+2 = 17 celler som ska ha skepp
          console.warn('AI could not place all ships properly, some may be missing!');
        }
        
        setOpponentBoard(aiBoard);
        
        // Initialize player's board
        setPlayerBoard(convertToGrid(createEmptyBoard()));
        
        // Start the game immediately
        setGameStatus('placing');
        setGameMessage('Placera dina skepp på spelplanen');
        setIsPlayerTurn(true);
      } catch (error) {
        console.error('Error initializing AI game:', error);
        
        // Om det uppstår ett fel, återgå till single-player sidan
        if (typeof window !== 'undefined') {
          // Visa ett felmeddelande till användaren
          alert('Ett fel uppstod vid initiering av spelet. Försök igen eller välj en annan svårighetsgrad.');
          
          // Navigera tillbaka till single-player sidan
          router.push('/single-player');
        }
      }
    }
  }, [effectiveSinglePlayer, difficulty, router]);

  // Handle AI's turn in single player mode
  useEffect(() => {
    console.log('[AI Effect Check]', { 
      effectiveSinglePlayer, 
      gameStatus, 
      isPlayerTurn, 
      aiIsProcessing, 
      aiOpponentExists: !!aiOpponent 
    });

    if (
      effectiveSinglePlayer && 
      gameStatus === 'playing' && 
      !isPlayerTurn && 
      !aiIsProcessing && 
      aiOpponent &&
      playerBoard.flat().some(cell => cell.hasShip)
    ) {
      console.log('[AI Effect Triggered] Setting aiIsProcessing to true');
      setAiIsProcessing(true);
      
      // Single timeout to handle the delay and processing
      const timeoutId = setTimeout(() => {
        let moveSuccessful = false;
        let calculatedMove: {x: number, y: number} | null = null;
        let nextPlayerBoard: Cell[][] | null = null;
        let playerShipsSunk = false;
        let shipTypeHitByAI: string | undefined = undefined; // Variable to capture ship type

        try {
          console.log('[AI Turn] Calculating move...');
          calculatedMove = aiOpponent.makeMove(playerBoard);
          console.log('[AI Turn] Move calculated:', calculatedMove);

          const { x, y } = calculatedMove!;
          const targetCell = playerBoard[y]?.[x];
          if (!targetCell) {
              throw new Error(`Invalid cell coordinates calculated by AI: ${JSON.stringify(calculatedMove)}`);
          }

          const wasHit = targetCell.hasShip;
          shipTypeHitByAI = targetCell.shipType; // Capture ship type here

          // Create the next board state based on the hit
          nextPlayerBoard = markCellAsHit(playerBoard, x, y);

          aiOpponent.updateLastMove(x, y, wasHit); // Update AI's internal state

          if (wasHit) {
              console.log(`[AI Turn] AI Hit at (${x}, ${y})! Ship type: ${shipTypeHitByAI}`);
              let boardAfterSunkCheck = nextPlayerBoard;
              let shipWasSunkByAI = false;

              // Check if AI sunk a player ship
              if (shipTypeHitByAI) {
                  const { updatedBoard, wasSunk } = checkAndMarkSunkShips(nextPlayerBoard, shipTypeHitByAI as ShipType);
                  boardAfterSunkCheck = updatedBoard;
                  shipWasSunkByAI = wasSunk;
                  if(wasSunk) {
                    console.log(`[AI Turn] AI Sunk player ship ${shipTypeHitByAI}!`);
                    // Use the new method to mark ship as sunk and reset targeting
                    aiOpponent.markShipAsSunk(shipTypeHitByAI);
                  }
              }

              // Check if AI won
              playerShipsSunk = checkWinCondition(boardAfterSunkCheck); // Use helper function
              console.log('[AI Turn] All player ships sunk check result:', playerShipsSunk);

              // Set the board state reflecting the hit/sunk status *before* deciding next turn
              nextPlayerBoard = boardAfterSunkCheck;

              // If AI won, mark successful, otherwise need to determine if AI gets another turn
              if (!playerShipsSunk) {
                  console.log("[AI Turn] AI Hit, AI gets another turn.");
              }
              moveSuccessful = true; // Mark move as successful (hit or win)

          } else {
              // --- AI Miss Logic ---
              console.log(`[AI Turn] AI Miss at (${x}, ${y})`);
              moveSuccessful = true; // Mark move as successful (miss)
              playerShipsSunk = false; // Ensure this is false for miss
          }

        } catch (error) { 
            console.error('[AI Turn] Error during AI move execution:', error);
            setTimeout(() => {
              setIsPlayerTurn(true); 
              setGameMessage('Ett fel inträffade under AI:ns tur. Din tur igen.');
              setAiIsProcessing(false); 
            }, 0);
        }

        // Only schedule state updates if the move calculation was successful
        if (moveSuccessful && nextPlayerBoard) {
          const finalBoardForState = nextPlayerBoard; 
          const moveCoords = calculatedMove!; 
          const wasShip = playerBoard[moveCoords.y][moveCoords.x]?.hasShip ?? false; 

          setTimeout(() => {
            console.log('[AI Turn] Updating state after delay...');
            
            if (playerShipsSunk) {
              console.log('[AI Turn] Setting state for AI win.');
              // Ensure the final winning hit is reflected before setting status
              setPlayerBoard(finalBoardForState); 
              setGameStatus('finished');
              setGameMessage('AI vann spelet!');
              // No need to set turn or processing state
            } else if (wasShip) { 
              // ... (AI extra turn logic) ...
              setPlayerBoard(finalBoardForState); 
              setIsPlayerTurn(false); 
              const sunkShipCheck = checkAndMarkSunkShips(finalBoardForState, shipTypeHitByAI as ShipType);
              if (sunkShipCheck.wasSunk && shipTypeHitByAI) {
                aiOpponent.markShipAsSunk(shipTypeHitByAI); // Mark ship as sunk and reset targeting
                setGameMessage(`AI sänkte ditt ${shipTypeHitByAI}! AI skjuter igen...`);
              } else {
                setGameMessage(`AI träffade! AI skjuter igen...`);
              }
              setAiIsProcessing(false); 
            } else { 
              // ... (AI miss logic) ...
              setPlayerBoard(finalBoardForState); 
              setIsPlayerTurn(true); 
              setGameMessage('AI missade. Din tur!');
              setAiIsProcessing(false);
            }
          }, 0);
        }

      }, 1500);
      
      return () => {
        console.log('[AI Effect Cleanup] Clearing timeout ID:', timeoutId);
        clearTimeout(timeoutId);
      };
    } else if (aiIsProcessing) {
        console.log('[AI Effect Check] Conditions not met, but AI is processing.');
    } else {
        console.log('[AI Effect Check] Conditions not met for AI turn.');
    }
  }, [effectiveSinglePlayer, gameStatus, isPlayerTurn, playerBoard, aiOpponent]);

  // Only use Firestore for multiplayer games
  useEffect(() => {
    if (!effectiveSinglePlayer) {
      const initializeGame = async () => {
        console.log('Initializing multiplayer game...', { gameId, playerId });
        try {
          const gameRef = doc(db, 'games', gameId);
          const gameDoc = await getDoc(gameRef);
          
          if (!gameDoc.exists()) {
            console.log('Game does not exist, creating new game...');
            await setDoc(gameRef, {
              players: {
                [playerId]: {
                  board: createEmptyBoard(),
                  ready: false,
                  userId: currentUser?.uid || null
                }
              },
              status: 'waiting',
              currentTurn: playerId,
              createdAt: new Date().toISOString()
            });
            console.log('New game created successfully');
          } else {
            const gameData = gameDoc.data() as GameState;
            console.log('Existing game found:', { 
              status: gameData.status,
              players: Object.keys(gameData.players),
              currentTurn: gameData.currentTurn
            });
            
            if (!gameData.players[playerId]) {
              console.log('Player not in game, adding player...');
              await updateDoc(gameRef, {
                [`players.${playerId}`]: {
                  board: createEmptyBoard(),
                  ready: false,
                  userId: currentUser?.uid || null
                }
              });
              console.log('Player added successfully');
            }
            
            if (gameData.status === 'waiting' && Object.keys(gameData.players).length === 2) {
              if (!gameData.players[playerId]?.ready) {
                console.log('Transitioning from waiting to placing state...');
                await updateDoc(gameRef, {
                  status: 'placing',
                  [`players.${playerId}.ready`]: false
                });
                console.log('State transition completed');
              }
            }
          }
        } catch (error) {
          console.error('Error initializing game:', error);
          setConnectionError('Det gick inte att initiera spelet. Försök igen.');
        }
      };

      initializeGame();
    }
  }, [gameId, playerId, currentUser?.uid, effectiveSinglePlayer]);

  // Listen for game state updates when in multiplayer mode
  useEffect(() => {
    if (effectiveSinglePlayer || !gameId) return;
    
    console.log(`[Multiplayer] Setting up game listener for game ${gameId}`);
    
    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(
      gameRef,
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as GameState;
          console.log(`[Multiplayer] Game state updated:`, data);
          
          // Update overall game state
          setGameState(data);
          
          // Handle game status changes
          if (data.status === 'playing' && gameStatus !== 'playing') {
            setGameStatus('playing');
            // Message only shown if not already playing
            setGameMessage(
              data.currentTurn === playerId 
                ? 'Din tur att skjuta!' 
                : 'Motståndarens tur.'
            );
          } else if (data.status === 'finished' && gameStatus !== 'finished') {
            setGameStatus('finished');
            const playerWon = data.winner === playerId;
            setGameMessage(playerWon ? 'Grattis, du vann spelet!' : 'Du förlorade spelet.');
          } else if (data.status === 'placing') {
            // Check if both players are ready to transition to playing state
            if (data.players && Object.keys(data.players).length === 2) {
              const allPlayersReady = Object.values(data.players).every(player => player.ready);
              
              if (allPlayersReady) {
                console.log('[Multiplayer] All players ready, transitioning to playing state');
                // Randomly determine who goes first
                const playerIds = Object.keys(data.players);
                const firstPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
                
                // Update game status in Firestore
                const gameRef = doc(db, 'games', gameId);
                await updateDoc(gameRef, {
                  status: 'playing',
                  currentTurn: firstPlayerId
                });
                
                console.log(`[Multiplayer] Game started, ${firstPlayerId} goes first`);
              }
            }
          }
          
          // Handle turn changes
          if (data.currentTurn) {
            const isItPlayerTurn = data.currentTurn === playerId;
            setIsPlayerTurn(isItPlayerTurn);
            
            // Only update message if the turn changed
            if (isPlayerTurn !== isItPlayerTurn && data.status === 'playing') {
              setGameMessage(isItPlayerTurn ? 'Din tur att skjuta!' : 'Motståndarens tur.');
            }
          }
          
          // Check if the opponent is set and initialize if needed
          if (data.players && Object.keys(data.players).length === 2) {
            const opponentKey = Object.keys(data.players).find(key => key !== playerId);
            if (opponentKey && opponentKey !== opponentId) {
              console.log(`[Multiplayer] Setting opponent ID: ${opponentKey}`);
              setOpponentId(opponentKey);
            }
            
            // Update player boards
            if (playerId && data.players[playerId]) {
              // Handle updates to player's own board (when opponent fires)
              const newPlayerBoardFlat = data.players[playerId].board;
              const newPlayerBoard = convertToGrid(newPlayerBoardFlat);
              
              // Check if the board has changed - opponent likely fired
              const anyNewHits = newPlayerBoardFlat.some((cell, idx) => {
                const oldCell = playerBoard.flat()[idx];
                return cell.isHit && (!oldCell || !oldCell.isHit);
              });
              
              if (anyNewHits) {
                console.log(`[Multiplayer] Opponent fired at player's board`);
                setPlayerBoard(newPlayerBoard);
                
                // Find the most recent hit to show in message
                const newHit = newPlayerBoardFlat.find((cell, idx) => {
                  const oldCell = playerBoard.flat()[idx];
                  return cell.isHit && (!oldCell || !oldCell.isHit);
                });
                
                if (newHit) {
                  // Determine if it was a hit or miss
                  if (newHit.hasShip) {
                    // Check if a ship was sunk
                    if (newHit.isSunkShip) {
                      const shipType = newHit.shipType;
                      setGameMessage(`Motståndaren sänkte din ${shipType || 'skepp'}!`);
                    } else {
                      setGameMessage('Motståndaren träffade!');
                    }
                  } else {
                    setGameMessage('Motståndaren missade!');
                  }
                }
              }
            }
            
            // Update opponent's board if available
            if (opponentKey && data.players[opponentKey]) {
              // Only update the opponent board when it's the player's turn to see it
              // This prevents overwriting local hit markers when it's not player's turn
              if (data.currentTurn === playerId || data.status === 'finished') {
                const newOpponentBoardFlat = data.players[opponentKey].board;
                const newOpponentBoard = convertToGrid(newOpponentBoardFlat);
                setOpponentBoard(newOpponentBoard);
              }
            }
          }
          
          setConnectionError('');
        } else {
          console.error('Game document does not exist');
          setConnectionError('Spelet kunde inte hittas.');
        }
      },
      (error) => {
        console.error('Error listening to game updates:', error);
        setConnectionError('Förlorade anslutningen till spelet. Försöker återansluta...');
        
        // Attempt to reconnect
        setTimeout(() => {
          console.log('Attempting to reconnect to game...');
          setConnectionError('Försöker återansluta...');
          // The listener will automatically try to reconnect
        }, 3000);
      }
    );
    
    return () => {
      console.log('[Multiplayer] Unsubscribing from game listener');
      unsubscribe();
    };
  }, [gameId, playerId, gameStatus, effectiveSinglePlayer, opponentId, isPlayerTurn, playerBoard]);

  const updateGameMessage = (gameData: GameState) => {
    if (gameData.status === 'waiting') {
      setGameMessage('Väntar på motståndare...');
    } else if (gameData.status === 'placing') {
      if (gameData.players[playerId]?.ready) {
        setGameMessage('Väntar på att motståndaren placerar sina skepp...');
      } else {
        setGameMessage('Placera dina skepp på spelplanen');
      }
    } else if (gameData.status === 'playing') {
      if (gameData.currentTurn === playerId) {
        setGameMessage('Din tur! Skjut mot motståndarens spelplan.');
      } else {
        setGameMessage('Motståndarens tur. Vänta medan de skjuter...');
      }
    } else if (gameData.status === 'finished') {
      setGameMessage('');
    }
  };

  const updateGameStatus = async (status: 'waiting' | 'placing' | 'playing' | 'finished') => {
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        status: status
      });
    } catch (error) {
      console.error('Error updating game status:', error);
    }
  };

  const handlePlayAgain = async () => {
    router.push('/lobby');
  };

  const handleFinishPlacement = (finalPlayerBoard: Cell[][]) => {
    console.log('[Game] Placement finished. Received board:', finalPlayerBoard);
    
    if (effectiveSinglePlayer) {
      console.log('[Game] Starting single player game after ship placement');
      // Set the player board state FIRST
      setPlayerBoard(finalPlayerBoard);
      
      // Set game state directly - remove setTimeout wrapper
      setGameStatus('playing');
      setIsPlayerTurn(true);
      setGameMessage('Din tur! Skjut mot AI:s spelplan.');
      console.log('[Game] Player board state updated, game status set to playing.');

    } else {
      // Multiplayer logic (if needed, currently handled by setPlayerReady in ShipPlacement)
      console.log('[Game] Multiplayer placement finished. Board state should be updated via Firestore.');
      // Optionally update local state immediately for responsiveness?
      // setPlayerBoard(finalPlayerBoard);
    }
  };

  const handleCellClick = async (x: number, y: number) => {
    if (effectiveSinglePlayer) {
      // --- Player's Turn Logic ---
      if (!isPlayerTurn || gameStatus !== 'playing') return;
      if (opponentBoard[y][x].isHit) return; // Prevent clicking already hit cells

      console.log(`[Player Click] Firing at (${x}, ${y})`);
      let currentOpponentBoard = [...opponentBoard]; // Work with a mutable copy for this turn's logic
      const targetCell = currentOpponentBoard[y][x];
      const wasHit = targetCell.hasShip;
      const shipTypeHit = targetCell.shipType; // Get the type of the ship hit

      // Mark the cell as hit
      currentOpponentBoard = markCellAsHit(currentOpponentBoard, x, y);

      if (wasHit) {
        console.log(`[Player Click] Hit at (${x}, ${y})! Ship type: ${shipTypeHit}`);
        let message = "Träff! Skjut igen.";
        let boardAfterSunkCheck = currentOpponentBoard;
        let shipWasSunk = false;

        // Check if the hit sunk a ship
        if (shipTypeHit) {
          const { updatedBoard, wasSunk } = checkAndMarkSunkShips(currentOpponentBoard, shipTypeHit as ShipType);
          boardAfterSunkCheck = updatedBoard;
          shipWasSunk = wasSunk;
          if (wasSunk) {
            // Use shipTypeHit which is guaranteed to be a string here
            message = `Sänkt ${shipTypeHit}! Skjut igen.`; 
            console.log(`[Player Click] Ship ${shipTypeHit} sunk!`);
          }
        }

        // Update opponent board state immediately with hit/sunk status
        setOpponentBoard(boardAfterSunkCheck);

        // Check for win condition
        const playerWon = checkWinCondition(boardAfterSunkCheck);
        if (playerWon) {
          console.log("[Player Click] Player wins!");
          setGameStatus('finished');
          setGameMessage('Grattis, du vann spelet!');
          setIsPlayerTurn(false); // Game over, player doesn't get another turn
        } else {
          // Hit, but game not won - Player gets another turn
          console.log("[Player Click] Hit, player gets another turn.");
          setIsPlayerTurn(true); // Remain player's turn
          setGameMessage(message);
        }
      } else {
        // --- Miss Logic ---
        console.log(`[Player Click] Miss at (${x}, ${y})`);
        // Update board with miss
         currentOpponentBoard = markCellAsHit(currentOpponentBoard, x, y);
        setOpponentBoard(currentOpponentBoard);

        // Pass turn to AI
        setIsPlayerTurn(false);
        setGameMessage('Miss! AI:s tur...');
        // AI's turn logic will trigger via useEffect
      }
    } else {
      // --- Multiplayer Logic ---
      if (!gameState || !opponentId || !isPlayerTurn || gameState.status !== 'playing') return;
      if (opponentBoard[y][x].isHit) return; // Prevent clicking already hit cells

      try {
        console.log(`[Multiplayer] Player ${playerId} firing at (${x}, ${y})`);
        
        // Get opponent's board from Firestore
        const opponentBoardFlat = gameState.players[opponentId].board;
        const targetCellIndex = opponentBoardFlat.findIndex(cell => cell.x === x && cell.y === y);
        
        if (targetCellIndex === -1) {
          console.error('Target cell not found in opponent board');
          return;
        }
        
        // Check if the cell was hit
        const wasHit = opponentBoardFlat[targetCellIndex].hasShip;
        const shipTypeHit = opponentBoardFlat[targetCellIndex].shipType;
        
        // Mark cell as hit in Firestore
        const updatedOpponentBoardFlat = [...opponentBoardFlat];
        updatedOpponentBoardFlat[targetCellIndex] = { 
          ...updatedOpponentBoardFlat[targetCellIndex], 
          isHit: true 
        };
        
        // Update to a grid representation for local state
        const updatedOpponentBoard = convertToGrid(updatedOpponentBoardFlat);
        
        // Update Firestore with the new board state
        const gameRef = doc(db, 'games', gameId);
        
        if (wasHit) {
          console.log(`[Multiplayer] Hit at (${x}, ${y})! Ship type: ${shipTypeHit}`);
          
          // Check if all cells of this ship are now hit (ship is sunk)
          let shipIsSunk = false;
          if (shipTypeHit) {
            const shipCells = updatedOpponentBoardFlat.filter(cell => cell.shipType === shipTypeHit);
            shipIsSunk = shipCells.length > 0 && shipCells.every(cell => cell.isHit);
            
            // Mark ship cells as sunk in Firestore if the ship is sunk
            if (shipIsSunk) {
              console.log(`[Multiplayer] Ship ${shipTypeHit} sunk!`);
              updatedOpponentBoardFlat.forEach((cell, idx) => {
                if (cell.shipType === shipTypeHit) {
                  updatedOpponentBoardFlat[idx] = { ...cell, isSunkShip: true };
                }
              });
            }
          }
          
          // Check for win condition
          const allShipCells = updatedOpponentBoardFlat.filter(cell => cell.hasShip);
          const playerWon = allShipCells.length > 0 && allShipCells.every(cell => cell.isHit);
          
          if (playerWon) {
            console.log(`[Multiplayer] Player ${playerId} wins!`);
            
            // Update Firestore with win condition
            await updateDoc(gameRef, {
              [`players.${opponentId}.board`]: updatedOpponentBoardFlat,
              status: 'finished',
              winner: playerId
            });
            
            // Update local state
            setOpponentBoard(updatedOpponentBoard);
            setGameStatus('finished');
            setGameMessage('Grattis, du vann spelet!');
            
          } else {
            // Hit but no win - player gets another turn
            console.log(`[Multiplayer] Player ${playerId} gets another turn after hit`);
            
            await updateDoc(gameRef, {
              [`players.${opponentId}.board`]: updatedOpponentBoardFlat,
              currentTurn: playerId // Keep turn with current player
            });
            
            // Update local state
            setOpponentBoard(updatedOpponentBoard);
            setIsPlayerTurn(true);
            setGameMessage(shipIsSunk ? `Sänkt ${shipTypeHit}! Skjut igen.` : 'Träff! Skjut igen.');
          }
          
        } else {
          // Miss - switch turn to opponent
          console.log(`[Multiplayer] Miss at (${x}, ${y}), switching turn to opponent`);
          
          await updateDoc(gameRef, {
            [`players.${opponentId}.board`]: updatedOpponentBoardFlat,
            currentTurn: opponentId // Switch turn to opponent
          });
          
          // Update local state
          setOpponentBoard(updatedOpponentBoard);
          setIsPlayerTurn(false);
          setGameMessage('Miss! Motståndarens tur.');
        }
        
      } catch (error) {
        console.error('Error processing multiplayer turn:', error);
        setConnectionError('Ett fel uppstod. Försök igen.');
      }
    }
  };

  useEffect(() => {
    if (!opponentId || !gameState) return;
    
    const opponentBoardFlat = gameState.players[opponentId]?.board || [];
    
    const shipTypes = ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'];
    const updatedOpponentShips = { ...opponentShips };
    
    for (const shipType of shipTypes) {
      const shipCells = opponentBoardFlat.filter(cell => cell.shipType === shipType);
      if (shipCells.length > 0) {
        const isShipSunk = shipCells.every(cell => cell.isHit);
        updatedOpponentShips[shipType].sunk = isShipSunk;
      }
    }
    
    setOpponentShips(updatedOpponentShips);
  }, [opponentBoard, opponentId, gameState]);

  const renderContent = () => {
    if (gameState?.status === 'waiting' && !effectiveSinglePlayer) {
      return (
        <div className="p-8 text-center bg-white">
          <h2 className="text-2xl font-bold mb-4">Väntar på motståndare</h2>
          <p className="mb-4">Dela ditt spel-ID med en vän för att börja spela:</p>
          <div className="bg-gray-100 p-3 font-mono mb-4">{gameId}</div>
          <button 
            onClick={() => navigator.clipboard.writeText(gameId)}
            className="bg-[#8bb8a8] text-white px-4 py-2 rounded"
          >
            Kopiera ID
          </button>
        </div>
      );
    }

    if (effectiveSinglePlayer && gameStatus === 'placing') {
      return (
        <ShipPlacement 
          gameId={gameId} 
          playerId={playerId} 
          board={playerBoard}
          onFinishPlacement={handleFinishPlacement}
        />
      );
    }

    if (!effectiveSinglePlayer && gameState?.status === 'placing' && !gameState.players[playerId]?.ready) {
      return (
        <ShipPlacement 
          gameId={gameId} 
          playerId={playerId} 
          board={playerBoard}
          onFinishPlacement={handleFinishPlacement}
        />
      );
    }

    const isGameFinished = gameStatus === 'finished' || gameState?.status === 'finished';
    if (isGameFinished) {
      // Finished state - Handle Single Player
      if (effectiveSinglePlayer && gameStatus === 'finished') {
        // Determine winner based on the final game message
        const playerWon = gameMessage === 'Grattis, du vann spelet!'; 
        // Add logging to verify state at render time
        console.log('[Render Finished SP] gameMessage:', gameMessage, 'playerWon:', playerWon);
        return (
          <div className="p-8 text-center bg-white">
            <h2 className="text-3xl font-bold mb-6">
              {playerWon ? 'Du vann!' : 'AI vann spelet!'} 
            </h2>
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="p-1 bg-white">
                <h2 className="text-lg font-bold mb-0 text-left">Din spelplan</h2>
                <div className="small-board">
                  <GameBoard
                    isPlayerBoard={true}
                    board={playerBoard}
                    onCellClick={() => {}}
                    isSmall={true}
                  />
                </div>
              </div>
              <div className="p-1 bg-white">
                <h2 className="text-lg font-bold mb-0 text-left">AI:s spelplan</h2>
                <div className="small-board">
                  <GameBoard
                    isPlayerBoard={false}
                    board={opponentBoard}
                    onCellClick={() => {}} // Disable clicks on finished board
                    isSmall={true}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <button 
                onClick={handlePlayAgain}
                className="bg-[#8bb8a8] text-white px-6 py-3 rounded text-lg hover:bg-[#7aa798] transition-colors"
              >
                Spela igen
              </button>
            </div>
          </div>
        );
      }

      // Finished state - Handle Multiplayer
      if (!effectiveSinglePlayer && gameState?.status === 'finished') {
        // Safely access gameState here as we know it's multiplayer
        return (
          <div className="p-8 text-center bg-white">
            <h2 className="text-3xl font-bold mb-6">
              {gameState.winner === playerId ? 'Du vann!' : 'Du förlorade!'} 
            </h2>
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="p-1 bg-white">
                <h2 className="text-lg font-bold mb-0 text-left">Din spelplan</h2>
                <div className="small-board">
                  <GameBoard
                    isPlayerBoard={true}
                    board={playerBoard}
                    onCellClick={() => {}}
                    isSmall={true}
                  />
                </div>
              </div>
              <div className="p-1 bg-white">
                <h2 className="text-lg font-bold mb-0 text-left">Motståndarens spelplan</h2>
                <div className="small-board">
                  <GameBoard
                    isPlayerBoard={false}
                    board={opponentBoard}
                    onCellClick={() => {}}
                    isSmall={true}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <button 
                onClick={handlePlayAgain}
                className="bg-[#8bb8a8] text-white px-6 py-3 rounded text-lg hover:bg-[#7aa798] transition-colors"
              >
                Spela igen
              </button>
            </div>
          </div>
        );
      }
    }

    // Playing state rendering
    return (
      <div className="flex flex-col gap-4 items-center justify-center w-full">
        {/* Top row with player board and opponent info */}
        <div className="flex flex-row items-start justify-center w-full space-x-4">
          {/* Player board - smaller */}
          <div className="flex-shrink-0">
            <h2 className="text-sm font-bold mb-0 text-center">Din spelplan</h2>
            <div className="small-board bg-white p-1 rounded">
              <GameBoard
                isPlayerBoard={true}
                board={playerBoard}
                onCellClick={() => {}}
                isSmall={true}
              />
            </div>
          </div>
          
          {/* Opponent information */}
          <div className="flex-shrink-0 px-2 rounded">
            <h2 className="text-sm font-bold mb-5 text-center">
              {effectiveSinglePlayer ? 'Din motståndare' : 'Motståndare'}
            </h2>
            <div className="w-24 h-24 overflow-hidden rounded-full mb-2 ms-2">
              <img 
                src={effectiveSinglePlayer 
                  ? `/images/pirate-${difficulty}.jpg` 
                  : `/images/player-icon-1.jpg`} 
                alt="Opponent" 
                className="w-full h-full object-cover"
              />
            </div>
            <p className="font-bold text-center text-sm">
              {effectiveSinglePlayer 
                ? `AI (${difficulty === 'easy' ? 'Enkel' : difficulty === 'medium' ? 'Medel' : 'Svår'})` 
                : 'Motståndare'}
            </p>
            <div className="mt-2 text-center">
              <div className={`inline-block w-2 h-2 rounded-full ${isPlayerTurn ? 'bg-gray-300' : 'bg-green-500'} mr-1`}></div>
              <span className={`text-xs ${isPlayerTurn ? 'text-gray-500' : 'text-green-600 font-medium'}`}>
                {isPlayerTurn ? 'Väntar' : 'Spelar nu'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Opponent's board */}
        <div className="w-full bg-white p-2 rounded">
          <div className={!isPlayerTurn ? "opacity-50 pointer-events-none" : ""}>
            <GameBoard
              isPlayerBoard={false}
              board={opponentBoard}
              onCellClick={handleCellClick}
              isSmall={false}
            />
            
            {!isPlayerTurn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black bg-opacity-30 rounded-lg p-3 text-white text-lg font-bold z-[100]">
                  {effectiveSinglePlayer ? 'AI:s tur...' : 'Väntar på motståndaren...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {showTurnModal && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
            <div className="bg-green-600 text-white px-8 py-4 rounded-lg text-xl font-bold animate-bounce">
              Din tur!
            </div>
          </div>
        )}
      </div>
    );
  };

  const waitingMessageContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    backgroundColor: 'white',
    margin: '1rem auto',
    maxWidth: '500px',
  };

  const gameIdDisplayStyle = {
    padding: '0.5rem',
    backgroundColor: '#f5f5f5',
    marginBottom: '1rem',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  };

  const copyButtonStyle = {
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    padding: '0.25rem 0.5rem',
    marginLeft: '0.5rem',
    cursor: 'pointer',
  };

  const gameContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as 'column',
    padding: '1rem',
    maxWidth: '1200px',
    margin: '0 auto',
    gap: '1rem',
  };

  const boardsContainerStyle = {
    display: 'flex',
    flexDirection: 'row' as 'row',
    flexWrap: 'wrap' as 'wrap',
    gap: '1rem',
    justifyContent: 'center',
  };

  const playerBoardContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as 'column',
    backgroundColor: 'white',
    padding: '1rem',
    flex: '1',
    minWidth: '300px',
    maxWidth: '500px',
  };

  const turnIndicatorStyle = {
    padding: '0.5rem',
    backgroundColor: '#f5f5f5',
    marginBottom: '1rem',
    textAlign: 'center' as 'center',
  };

  const messageContainerStyle = {
    padding: '0.5rem',
    backgroundColor: '#f5f5f5',
    marginBottom: '1rem',
    textAlign: 'center' as 'center',
  };

  const chatContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0.5rem',
    maxHeight: '300px',
    overflowY: 'auto' as 'auto',
    padding: '0.5rem',
    backgroundColor: '#f5f5f5',
  };

  const messageStyle = {
    padding: '0.5rem',
    backgroundColor: 'white',
  };

  const chatInputContainerStyle = {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
  };

  const chatInputStyle = {
    flex: '1',
    padding: '0.5rem',
    border: 'none',
    backgroundColor: '#f5f5f5',
  };

  const sendButtonStyle = {
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
  };

  const leaveButtonStyle = {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    alignSelf: 'center',
    marginTop: '1rem',
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[400px] mx-auto px-2">
      <div className="w-full flex justify-end mb-4">
        <Link
          href="/active-games"
          className="text-gray-600 hover:text-gray-800 text-sm flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Tillbaka till mina spel
        </Link>
      </div>
      
      {connectionError && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded relative w-full mb-4">
          <span className="block sm:inline">{connectionError}</span>
          {attemptingReconnect && <span className="block mt-1">Försöker återansluta...</span>}
        </div>
      )}
      
      {renderContent()}
      <div className="text-center p-2 bg-white w-full mt-4">
        <p className="text-lg font-medium">
          {gameMessage}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Spel-ID: {gameId}
        </p>
      </div>
    </div>
  );
};

export default Game; 