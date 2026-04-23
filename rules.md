1. Game Overview & Components
   The Board: A 15x15 grid (225 squares in total) containing standard squares and Premium Multiplier squares.

The Tiles: A pool of 100 tiles consisting of numbers (0-9), mathematical operators (+, -, x, ÷, =), combined operators (+/-), and Blank tiles ( 0 - 20, +, -, x, ÷, = ). Each tile carries a specific point value.
{
"numbers": [
{ "value": 1, "num": 5, "face": 0 },
{ "value": 1, "num": 6, "face": 1 },
{ "value": 1, "num": 6, "face": 2 },
{ "value": 1, "num": 5, "face": 3 },
{ "value": 2, "num": 5, "face": 4 },
{ "value": 2, "num": 4, "face": 5 },
{ "value": 2, "num": 4, "face": 6 },
{ "value": 2, "num": 4, "face": 7 },
{ "value": 2, "num": 4, "face": 8 },
{ "value": 2, "num": 4, "face": 9 },
{ "value": 3, "num": 2, "face": 10 },
{ "value": 4, "num": 1, "face": 11 },
{ "value": 3, "num": 2, "face": 12 },
{ "value": 6, "num": 1, "face": 13 },
{ "value": 4, "num": 1, "face": 14 },
{ "value": 4, "num": 1, "face": 15 },
{ "value": 4, "num": 1, "face": 16 },
{ "value": 6, "num": 1, "face": 17 },
{ "value": 4, "num": 1, "face": 18 },
{ "value": 7, "num": 1, "face": 19 },
{ "value": 5, "num": 1, "face": 20 }
],
"operators": [
{ "symbol": "+", "value": 2, "num": 4 },
{ "symbol": "-", "value": 2, "num": 4 },
{ "symbol": "×", "value": 2, "num": 4 },
{ "symbol": "÷", "value": 1, "num": 4 },
{ "symbol": "+/-", "value": 1, "num": 5 },
{ "symbol": "=", "value": 1, "num": 11 },
{ "symbol": "BLANK", "value": 0, "num": 4 }
]
}

The Rack: Each player draws and maintains exactly 8 tiles on their rack at all times (until the tile bag is empty).

Objective: To accumulate the highest score by strategically placing tiles on the board to form mathematically correct equations.

2. Turn Actions
   On a player's turn, they must choose one of the following three actions:

Play (Place an Equation): Place one or more tiles on the board to form a valid, interconnected math equation.

Swap (Exchange Tiles): Exchange 1 to 8 tiles from the rack with new ones from the tile bag.

Constraint: A swap is not allowed if there are 5 or fewer tiles remaining in the bag.

Consequence: Swapping consumes the player's entire turn.

Pass: Choose to make no move and end the turn.

3. Rules of Play (Tile Placement & Validity)
   Validity: Every equation placed must be mathematically correct and must contain exactly one equals sign (=). Both sides of the equation must evaluate to the exact same value (e.g., 4+3\*2=10).

Order of Operations: Standard mathematical hierarchy (BODMAS/PEMDAS) applies. Multiplication and division are calculated before addition and subtraction.

Interconnectivity: Except for the very first move of the game, all new tiles played must connect to at least one existing tile on the board (sharing an edge).

Cross-Equations: If placing tiles forms new equations in the intersecting direction (both horizontally and vertically), all formed equations must be mathematically valid.

Digit Concatenation (Special Rule): Players can place single-digit number tiles adjacent to each other to form multi-digit numbers.

Example: Placing a 1 tile next to a 0 tile forms the number 10. This consumes 2 tiles from the player's rack.

4. The Scoring System
   The score for a turn is calculated by adding the values of all tiles in the formed equation(s), modified by Premium Squares and Bonuses.

Calculation Order:

Base Tile Values: Sum the points of the tiles used in the equation.

Premium Piece Multipliers: If a newly placed tile lands on a 3x Piece or 2x Piece square, multiply the individual tile's value before adding it to the sum.

Premium Equation Multipliers: If any newly placed tile lands on a 3x Equation or 2x Equation square, multiply the entire sum of the equation by that factor. (If multiple are covered, they compound).

Bingo Bonus: If a player successfully plays all 8 tiles from their rack in a single turn, a flat +40 points is added to their total score for that turn after all other multipliers are calculated.

Note: Premium squares only apply during the turn the tile is initially placed on them. They are not recounted in subsequent turns.

5. Time Control System (Chess Clock Rules)
   The game operates on a strict server-authoritative timer to ensure competitive pacing.

Total Bank Time: Each player has a total of 22 minutes for the entire game.

Turn Limit: A player may spend a maximum of 10 minutes per turn.

Overtime Penalty: There is no time increment added after a turn. If a player exceeds their allotted time (either Turn Limit or Bank Time), they suffer a penalty of -10 points per minute.

Rounding Rule: Any fraction of a minute exceeded rounds up. (e.g., Exceeding the time by 1 second results in a full 10-point penalty).

6. End of Game Conditions & Final Scoring
   The game immediately concludes when one of the following triggers occurs:

Trigger A: Empty Rack (Standard Victory)

Condition: The tile bag is completely empty, and one player successfully uses all their remaining tiles on their rack.

Final Adjustment: The opposing player reveals their remaining tiles. The total point value of the opponent's unplayed tiles is multiplied by 2 and added to the score of the player who finished first.

Trigger B: Game Stagnation (Deadlock)

Condition: The tile bag is empty (or no valid moves remain), and both players choose to Pass 3 consecutive times.

Final Adjustment: Both players reveal their remaining tiles. The sum of Player A's remaining tiles is multiplied by 2 and added to Player B's score. Conversely, the sum of Player B's remaining tiles is multiplied by 2 and added to Player A's score.

Determining the Winner: After all endgame adjustments are calculated, the player with the highest total score is declared the winner.
