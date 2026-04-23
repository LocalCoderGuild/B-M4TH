Project Master Plan: "Project Equation"
Real-Time Server-Authoritative Math Board Game

1. Project Overview
   Concept: A turn-based, 15x15 grid math equation board game (A-Math style) supporting multiplayer and single-player modes.

Key Differentiator: Frictionless onboarding via "Magic Links" (no user accounts required). Highly modular underlying engine designed to support future "Roguelike" elements (e.g., skill cards, custom rule modifiers, binary modes).

Architectural Paradigm: Server-Authoritative Client-Server Model. The server holds the ultimate truth of the game state, preventing any client-side manipulation or cheating.

Technology Stack:

Core Engine: Pure TypeScript (Strict Mode, Framework-Agnostic).

Backend: Bun + ElysiaJS (Native WebSockets) + In-Memory State (Map/Redis).

Frontend: React (Vite) + Zustand (State Management) + Tailwind CSS.

Phase 1: The Core Game Engine (Domain Logic & TDD)
The foundation. This phase involves zero web servers and zero UI. We build the "brain" as an isolated, testable TypeScript package.

Objectives:

Define strict TypeScript Interfaces for Domain Entities (Board, Tile, GameState, Token).

Implement the TurnManager to handle temporary tile placements and prevent overlapping.

Implement the BoardScanner (Bidirectional Raycasting) to detect newly formed intersecting lines of tiles.

Build the Lexer and Safe Evaluator to convert tile arrays (e.g., ['1', '0', '+', '5']) into abstract syntax trees for secure math validation without using eval().

Develop the Scoring System, accurately calculating base scores, Board Multipliers (3x Eq, 2x Piece), and the +40 Bingo Bonus.

Deliverable: A fully functioning game engine that can be played entirely via a Command Line Interface (CLI) or Test Suites.

Quality Gate: 100% Test Coverage (Jest/Vitest) on edge cases like digit concatenation (1 and 0 = 10), complex BODMAS/PEMDAS calculations, and endgame scoring adjustments.

Phase 2: The Server-Authoritative Backend (Network Layer)
Giving the brain a body. We wrap the Core Engine in a high-performance network layer to handle real-time multiplayer connections.

Objectives:

Initialize the Bun + ElysiaJS backend.

Implement the StateManager to handle Game Room creation and store session data in-memory.

Create the HTTP REST API /create-game to generate unique UUIDs for the Magic Links.

Establish the WebSocket (ws://) Pub/Sub infrastructure for players to join rooms, receive sync events (SYNC_STATE), and broadcast actions.

Integrate the Core Engine: The server receives an action (e.g., PLACE_TILES), feeds it to the Engine, and broadcasts the resultant state back to clients.

Implement the Server-Side Chess Clock: A background loop that enforces the 22-minute bank / 10-minute turn limit and automatically dispatches -10 point penalties.

Deliverable: A running WebSocket server that can manage multiple isolated game rooms concurrently.

Phase 3: The Client-Side Application (UI & State Sync)
The face of the application. Building a "dumb" frontend that acts strictly as a renderer for the Server's state and a remote control for player actions.

Objectives:

Initialize the React (Vite) project with Tailwind CSS.

Set up Zustand to hold and reactively update the Game State received from the ElysiaJS WebSocket.

Build the Grid UI: Render the 15x15 board and the player's 8-tile rack using standard CSS Grids/Flexbox.

Implement Basic Interaction: Use a simple "Click to select rack tile -> Click board cell to place" mechanism to establish core playability before introducing complex drag-and-drop.

Implement the Magic Link Routing: Read the gameId from the URL, automatically provision a playerId (stored in LocalStorage), and connect to the correct WebSocket channel.

Deliverable: A fully playable Minimum Viable Product (MVP) where two players can open links in separate browser tabs and play a complete match against each other.

Phase 4: Polish & Advanced UX (The "Juice")
Elevating the MVP to a professional-grade product.

Objectives:

Drag and Drop: Integrate @dnd-kit/core to replace the click-to-place system, adding smooth tile dragging, snapping, and visual feedback.

Optimistic UI: Update the frontend to instantly show placed tiles on the board before the server responds, hiding network latency from the user. (If the server rejects the move, snap the tiles back to the rack).

Animations & Feedback: Add CSS transitions for tile placements, toast notifications for invalid math equations, and visual highlights for the +40 Bingo.

Responsive Design: Ensure the 15x15 grid scales correctly on mobile and tablet screens.

Deliverable: A polished, consumer-ready web game with high-quality user experience.

Phase 5: Future-Proofing & Extensions (The Vision)
Leveraging the modular architecture built in Phase 1 to introduce radical new game modes without breaking the core.

Objectives:

Middleware Pipeline: Refactor the Game Engine's validation and scoring steps into an "Interceptor Pipeline."

Roguelike Mechanics: Introduce "Skill Cards" (e.g., classes that implement interceptScore to steal points, or interceptValidation to alter math rules).

Binary Mode: Inject a custom rule modifier that restricts the tile bag to 0, 1, and Bitwise operators (AND, OR, XOR).

Single Player / AI: Develop a basic heuristics-based bot that searches the board for valid equations to allow offline or solo play.

Deliverable: A dynamic, extensible game platform capable of rapid feature iteration
