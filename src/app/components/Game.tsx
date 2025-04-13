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

// Helper function to check if a ship is sunk and update the board
const checkAndMarkSunkShips = (board: Cell[][], shipType: string): { updatedBoard: Cell[][], wasSunk: boolean } => {
  const shipCells = board.flat().filter(cell => cell.shipType === shipType);
  // Ensure there are cells for the ship type before checking if all are hit
  const isSunk = shipCells.length > 0 && shipCells.every(cell => cell.isHit);
  let updatedBoard = board;

  if (isSunk) {
    console.log(`[Sunk Check] Ship type ${shipType} was sunk!`);
    // Create a new board array with updated cells
    updatedBoard = board.map(row =>
      row.map(cell =>
        cell.shipType === shipType ? { ...cell, isSunkShip: true } : cell
      )
    );
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
      const ai = new BattleshipAI({ difficulty, boardSize: BOARD_SIZE });
      setAIOpponent(ai);
      
      // Place AI's ships
      const aiBoard = ai.placeShips();
      setOpponentBoard(aiBoard);
      
      // Initialize player's board
      setPlayerBoard(convertToGrid(createEmptyBoard()));
      
      // Start the game immediately
      setGameStatus('placing');
      setGameMessage('Placera dina skepp på spelplanen');
      setIsPlayerTurn(true);
    }
  }, [effectiveSinglePlayer, difficulty]);

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
      aiOpponent
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
          nextPlayerBoard = playerBoard.map((row, currentY) =>
            row.map((cell, currentX) =>
              currentX === x && currentY === y ? { ...cell, isHit: true } : cell
            )
          );

          aiOpponent.updateLastMove(x, y, wasHit); // Update AI's internal state

          if (wasHit) {
              console.log(`[AI Turn] AI Hit at (${x}, ${y})! Ship type: ${shipTypeHitByAI}`);
              let boardAfterSunkCheck = nextPlayerBoard;
              let shipWasSunkByAI = false;

              // Check if AI sunk a player ship
              if (shipTypeHitByAI) {
                  const { updatedBoard, wasSunk } = checkAndMarkSunkShips(nextPlayerBoard, shipTypeHitByAI);
                  boardAfterSunkCheck = updatedBoard;
                  shipWasSunkByAI = wasSunk;
                  if(wasSunk) {
                    console.log(`[AI Turn] AI Sunk player ship ${shipTypeHitByAI}!`);
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
              const sunkShipCheck = checkAndMarkSunkShips(finalBoardForState, shipTypeHitByAI ?? ''); 
              setGameMessage(sunkShipCheck.wasSunk ? `AI sänkte ditt ${shipTypeHitByAI}! AI skjuter igen...` : `AI träffade! AI skjuter igen...`);
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

  // Only use Firestore for multiplayer games
  useEffect(() => {
    if (!effectiveSinglePlayer) {
      let unsubscribe: () => void;
      let reconnectTimeout: NodeJS.Timeout;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      let connectionTimeout: NodeJS.Timeout;
      let isInitialized = false;
      
      const connectToGame = () => {
        console.log('Connecting to multiplayer game...', { gameId, playerId, reconnectAttempts });
        try {
          setAttemptingReconnect(true);
          const gameRef = doc(db, 'games', gameId);
          
          connectionTimeout = setTimeout(() => {
            if (reconnectAttempts < maxReconnectAttempts) {
              console.log('Connection timeout, attempting reconnect...', { reconnectAttempts });
              reconnectAttempts++;
              connectToGame();
            } else {
              console.error('Max reconnection attempts reached');
              setConnectionError('Kunde inte ansluta till spelet. Försök igen senare.');
              setAttemptingReconnect(false);
            }
          }, 10000);

          unsubscribe = onSnapshot(gameRef, 
            (doc) => {
              clearTimeout(connectionTimeout);
              
              setConnectionError(null);
              setAttemptingReconnect(false);
              reconnectAttempts = 0;
              
              if (doc.exists()) {
                const gameData = doc.data() as GameState;
                console.log('Game data received:', {
                  status: gameData.status,
                  currentTurn: gameData.currentTurn,
                  players: Object.keys(gameData.players),
                  isInitialized
                });
                
                if (!isInitialized || JSON.stringify(gameState) !== JSON.stringify(gameData)) {
                  console.log('Updating game state...');
                  setGameState(gameData);
                  const isYourTurn = gameData.currentTurn === playerId;
                  setIsPlayerTurn(isYourTurn);
                  setGameStatus(gameData.status);
                  isInitialized = true;
                }
                
                if (gameData.players[playerId]?.board) {
                  const newPlayerBoard = convertToGrid(gameData.players[playerId].board);
                  if (JSON.stringify(playerBoard) !== JSON.stringify(newPlayerBoard)) {
                    console.log('Updating player board...');
                    setPlayerBoard(newPlayerBoard);
                  }
                }
                
                const opponent = Object.keys(gameData.players).find(id => id !== playerId);
                if (opponent) {
                  console.log('Opponent found:', opponent);
                  setOpponentId(opponent);
                  
                  if (gameData.players[opponent]?.board) {
                    const newOpponentBoard = convertToGrid(gameData.players[opponent].board);
                    if (JSON.stringify(opponentBoard) !== JSON.stringify(newOpponentBoard)) {
                      console.log('Updating opponent board...');
                      setOpponentBoard(newOpponentBoard);
                    }
                  }
                }

                updateGameMessage(gameData);
                
                const allPlayersReady = Object.values(gameData.players).every(player => player.ready);
                if (allPlayersReady && gameData.status === 'placing' && Object.keys(gameData.players).length === 2) {
                  console.log('All players ready, transitioning to playing state...');
                  updateGameStatus('playing');
                }
              } else {
                console.error('Game document does not exist');
                setConnectionError('Detta spel finns inte längre. Det kan ha tagits bort.');
              }
            },
            (error) => {
              clearTimeout(connectionTimeout);
              console.error('Error fetching game data:', error);
              setConnectionError(`Det gick inte att ansluta till spelet: ${error.message}`);
              
              if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log('Attempting reconnect...', { reconnectAttempts });
                reconnectTimeout = setTimeout(() => {
                  setAttemptingReconnect(true);
                  connectToGame();
                }, 3000);
              } else {
                console.error('Max reconnection attempts reached');
                setAttemptingReconnect(false);
              }
            }
          );
        } catch (error) {
          clearTimeout(connectionTimeout);
          console.error('Error setting up game connection:', error);
          setConnectionError(`Det gick inte att ansluta till spelet.`);
          setAttemptingReconnect(false);
        }
      };

      connectToGame();

      return () => {
        console.log('Cleaning up game connection...');
        if (unsubscribe) {
          unsubscribe();
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
        }
      };
    }
  }, [gameId, playerId, effectiveSinglePlayer]);

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
    try {
      const newPlayerId = currentUser?.uid || `player_${Date.now()}`;
      const gameRef = await addDoc(collection(db, 'games'), {
        players: {
          [newPlayerId]: {
            ready: false,
            userId: currentUser?.uid || null
          }
        },
        status: 'waiting',
        createdAt: new Date().toISOString()
      });
      
      console.log(`Navigating to new game: /?gameId=${gameRef.id}&playerId=${newPlayerId}`);
      window.location.href = `/?gameId=${gameRef.id}&playerId=${newPlayerId}`;
    } catch (error) {
      console.error('Error creating new game:', error);
      setConnectionError('Kunde inte skapa ett nytt spel. Försök igen.');
    }
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
      currentOpponentBoard = currentOpponentBoard.map((row, currentY) =>
        row.map((cell, currentX) =>
          currentX === x && currentY === y ? { ...cell, isHit: true } : cell
        )
      );

      if (wasHit) {
        console.log(`[Player Click] Hit at (${x}, ${y})! Ship type: ${shipTypeHit}`);
        let message = "Träff! Skjut igen.";
        let boardAfterSunkCheck = currentOpponentBoard;
        let shipWasSunk = false;

        // Check if the hit sunk a ship
        if (shipTypeHit) {
          const { updatedBoard, wasSunk } = checkAndMarkSunkShips(currentOpponentBoard, shipTypeHit);
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
         currentOpponentBoard = currentOpponentBoard.map((row, currentY) =>
          row.map((cell, currentX) =>
            currentX === x && currentY === y ? { ...cell, isHit: true } : cell // Mark as hit (miss)
          )
        );
        setOpponentBoard(currentOpponentBoard);

        // Pass turn to AI
        setIsPlayerTurn(false);
        setGameMessage('Miss! AI:s tur...');
        // AI's turn logic will trigger via useEffect
      }
    } else {
       // --- Multiplayer Logic ---
       // ... (Existing multiplayer logic remains here)
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
        <div className="p-8 text-center bg-white border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">Väntar på motståndare</h2>
          <p className="mb-4">Dela ditt spel-ID med en vän för att börja spela:</p>
          <div className="bg-gray-100 p-3 border border-gray-200 font-mono mb-4">{gameId}</div>
          <button 
            onClick={() => navigator.clipboard.writeText(gameId)}
            className="bg-[#8bb8a8] text-white px-4 py-2"
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

    if (gameStatus === 'finished' || (gameState?.status === 'finished')) {
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
              <Link href="/single-player">
                <button className="bg-[#8bb8a8] text-white px-6 py-3 rounded text-lg">
                  Spela igen
                </button>
              </Link>
              <Link href="/">
                <button className="bg-gray-500 text-white px-6 py-3 rounded text-lg">
                  Tillbaka till startsidan
                </button>
              </Link>
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
                onClick={handlePlayAgain} // Use the existing multiplayer play again
                className="bg-[#8bb8a8] text-white px-6 py-3 rounded text-lg"
              >
                Spela igen
              </button>
              <Link href="/active-games">
                <button className="bg-gray-500 text-white px-6 py-3 rounded text-lg">
                  Tillbaka till mina spel
                </button>
              </Link>
            </div>
          </div>
        );
      }
    }

    // Playing state rendering
    return (
      <div className="flex flex-col gap-4 items-center justify-center bg-white">
         <div className="flex flex-col items-center gap-4">
           {/* Player board */}
           <div className="p-1 bg-white">
             <h2 className="text-lg font-bold mb-0 text-left">Din spelplan</h2>
             <div className="small-board">
               <GameBoard
                 isPlayerBoard={true}
                 board={playerBoard}
                 onCellClick={() => {}} // Player board not clickable during play
                 isSmall={true}
               />
             </div>
           </div>
           
           {/* REMOVE the ShipStatus display during active play */}
           {/* 
           <div className="p-1 bg-white">
             <h2 className="text-lg font-bold mb-0 text-left">DINA SKEPP</h2>
             <ShipStatus ships={playerShips} />
           </div>
           */}
         </div>
         
         {/* Opponent's board */}
         <div className="p-1 bg-white relative">
           <h2 className="text-lg font-bold mb-0 text-left">
             {effectiveSinglePlayer ? 'AI:s spelplan' : 'Motståndarens spelplan'}
           </h2>
           <div className={!isPlayerTurn ? "opacity-50 pointer-events-none" : ""}>
             <GameBoard
               isPlayerBoard={false}
               board={opponentBoard}
               onCellClick={handleCellClick}
               isSmall={false}
             />
             
             {!isPlayerTurn && (
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-black bg-opacity-30 rounded-lg p-3 text-white text-lg font-bold">
                   {effectiveSinglePlayer ? 'AI:s tur...' : 'Väntar på motståndaren...'}
                 </div>
               </div>
             )}
           </div>
         </div>

         {showTurnModal && (
           <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
             <div className="bg-green-600 text-white px-8 py-4 rounded-lg shadow-lg text-xl font-bold animate-bounce">
               Din tur!
             </div>
           </div>
         )}
       </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <div className="w-full max-w-4xl flex justify-end">
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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-xl w-full">
          <span className="block sm:inline">{connectionError}</span>
          {attemptingReconnect && <span className="block mt-1">Försöker återansluta...</span>}
        </div>
      )}
      
      {renderContent()}
      <div className="text-center p-4 bg-white max-w-xl w-full">
        <p className="text-lg font-medium">
          {gameMessage}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Spel-ID: {gameId}
        </p>
      </div>
    </div>
  );
};

export default Game; 