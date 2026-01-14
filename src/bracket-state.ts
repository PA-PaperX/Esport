// ==========================================
// Bracket State Manager - Tournament Bracket System
// ==========================================

const BRACKET_DB_FILE = "data/bracket.json";

// ==========================================
// 1. Data Schemas
// ==========================================

export type BracketType = "single" | "double";

export interface BracketTeam {
  id: string; // e.g., "team_1"
  name: string; // Team name
  logo?: string; // Logo path
  seed?: number; // Seed number (for sorting)
}

export interface BracketMatch {
  id: string; // e.g., "match_qf_1"
  round: number; // Round number (1 = Quarterfinals, 2 = Semifinals, etc.)
  roundName: string; // "Quarterfinal 1", "Semifinal 1", "Grand Final"
  position: number; // Position in round (1, 2, 3, 4 for QF)
  teamA: BracketTeam | null;
  teamB: BracketTeam | null;
  scoreA: number;
  scoreB: number;
  winner: "A" | "B" | null;
  isBye: boolean; // Auto-win if opponent is null
  nextMatchId: string | null; // ID of next match winner goes to
  nextSlot: "A" | "B" | null; // Slot in next match
  // Double elimination fields
  bracket?: "winners" | "losers" | "grand"; // Which bracket this match belongs to
  loserNextMatchId?: string | null; // ID of match loser goes to (for double elim)
  loserNextSlot?: "A" | "B" | null; // Slot in losers bracket
}

export interface BracketState {
  id: string;
  name: string; // Tournament name
  type: BracketType;
  teams: BracketTeam[];
  matches: BracketMatch[];
  rounds: number; // Total rounds
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 2. Bracket Manager Class
// ==========================================

export class BracketManager {
  private state: BracketState | null = null;

  constructor() {
    this.loadFromDisk();
  }

  // Load bracket from disk
  private async loadFromDisk() {
    try {
      const file = Bun.file(BRACKET_DB_FILE);
      if (await file.exists()) {
        this.state = await file.json();
        console.log("📊 Bracket loaded from disk");
      }
    } catch (e) {
      console.log("⚠️ No existing bracket found");
    }
  }

  // Save bracket to disk
  private async saveToDisk() {
    if (this.state) {
      this.state.updatedAt = new Date().toISOString();
      await Bun.write(BRACKET_DB_FILE, JSON.stringify(this.state, null, 2));
      console.log("💾 Bracket saved to disk");
    }
  }

  // Get current state
  public getState(): BracketState | null {
    return this.state;
  }

  // Create new bracket
  public createBracket(
    name: string,
    type: BracketType,
    teamNames: string[],
    teamData?: Array<{ name: string; logo?: string; color?: string }>,
  ): BracketState {
    // If teamData provided, use it to populate logos
    const teamDataMap = new Map<string, { logo?: string; color?: string }>();
    if (teamData) {
      teamData.forEach((t) =>
        teamDataMap.set(t.name, { logo: t.logo, color: t.color }),
      );
    }

    const teams: BracketTeam[] = teamNames.map((teamName, index) => {
      const data = teamDataMap.get(teamName);
      return {
        id: `team_${index + 1}`,
        name: teamName,
        logo: data?.logo || "",
        seed: index + 1,
      };
    });

    // Calculate rounds needed
    const numTeams = teams.length;
    const rounds = Math.ceil(Math.log2(numTeams));
    const bracketSize = Math.pow(2, rounds); // Next power of 2

    // Double Elimination: Only accept 4, 8, 16 teams
    if (type === "double") {
      const validTeamCounts = [4, 8, 16];
      if (!validTeamCounts.includes(numTeams)) {
        throw new Error(`Double Elimination requires exactly 4, 8, or 16 teams. Got ${numTeams} teams.`);
      }
    }

    // Generate matches based on bracket type
    const matches = type === "double"
      ? this.generateDoubleEliminationMatches(teams, rounds, bracketSize)
      : this.generateMatches(teams, rounds, bracketSize);

    this.state = {
      id: `bracket_${Date.now()}`,
      name,
      type,
      teams,
      matches,
      rounds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveToDisk();
    return this.state;
  }

  // Generate bracket structure
  private generateMatches(
    teams: BracketTeam[],
    rounds: number,
    bracketSize: number,
  ): BracketMatch[] {
    const matches: BracketMatch[] = [];
    const firstRoundMatches = bracketSize / 2;

    // Round names based on number of matches
    const getRoundName = (
      round: number,
      totalRounds: number,
      position: number,
    ): string => {
      const matchesInRound = Math.pow(2, totalRounds - round);
      if (matchesInRound === 1) return "Grand Final";
      if (matchesInRound === 2) return `Semifinal ${position}`;
      if (matchesInRound === 4) return `Quarterfinal ${position}`;
      return `Round ${round} Match ${position}`;
    };

    // Create all matches for each round
    for (let round = 1; round <= rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round);

      for (let pos = 1; pos <= matchesInRound; pos++) {
        const matchId = `match_r${round}_${pos}`;

        // Calculate next match
        let nextMatchId: string | null = null;
        let nextSlot: "A" | "B" | null = null;

        if (round < rounds) {
          const nextPos = Math.ceil(pos / 2);
          nextMatchId = `match_r${round + 1}_${nextPos}`;
          nextSlot = pos % 2 === 1 ? "A" : "B";
        }

        const match: BracketMatch = {
          id: matchId,
          round,
          roundName: getRoundName(round, rounds, pos),
          position: pos,
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          winner: null,
          isBye: false,
          nextMatchId,
          nextSlot,
        };

        matches.push(match);
      }
    }

    // Seed teams into first round with proper bracket seeding
    const seedOrder = this.generateSeedOrder(firstRoundMatches * 2);

    for (let i = 0; i < seedOrder.length; i++) {
      const seedPosition = seedOrder[i] - 1; // 0-indexed
      const matchIndex = Math.floor(i / 2);
      const slot = i % 2 === 0 ? "A" : "B";

      if (seedPosition < teams.length) {
        const team = teams[seedPosition];
        if (slot === "A") {
          matches[matchIndex].teamA = team;
        } else {
          matches[matchIndex].teamB = team;
        }
      }
    }

    // Handle byes for first round
    for (let i = 0; i < firstRoundMatches; i++) {
      const match = matches[i];
      if (match.teamA && !match.teamB) {
        // Team A gets a bye
        match.isBye = true;
        match.winner = "A";
        // Advance to next round
        this.advanceWinner(matches, match, match.teamA);
      } else if (!match.teamA && match.teamB) {
        // Team B gets a bye
        match.isBye = true;
        match.winner = "B";
        this.advanceWinner(matches, match, match.teamB);
      } else if (!match.teamA && !match.teamB) {
        // No teams, skip this match
        match.isBye = true;
      }
    }

    return matches;
  }

  // Generate Double Elimination bracket structure (Ranking Bracket style)
  // Winners only face winners, Losers only face losers
  // Results in clear 1st, 2nd, 3rd, 4th place rankings
  private generateDoubleEliminationMatches(
    teams: BracketTeam[],
    rounds: number,
    bracketSize: number,
  ): BracketMatch[] {
    const matches: BracketMatch[] = [];
    const firstRoundMatches = bracketSize / 2;

    // ========================================
    // WINNERS BRACKET
    // ========================================
    const getWinnersRoundName = (
      round: number,
      totalRounds: number,
      position: number,
    ): string => {
      const matchesInRound = Math.pow(2, totalRounds - round);
      if (matchesInRound === 1) return "Winners Final";
      if (matchesInRound === 2) return `Winners Semifinal ${position}`;
      if (matchesInRound === 4) return `Winners Quarterfinal ${position}`;
      return `Winners R${round} M${position}`;
    };

    // Create Winners bracket matches
    for (let round = 1; round <= rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round);

      for (let pos = 1; pos <= matchesInRound; pos++) {
        const matchId = `w_r${round}_${pos}`;

        let nextMatchId: string | null = null;
        let nextSlot: "A" | "B" | null = null;
        let loserNextMatchId: string | null = null;
        let loserNextSlot: "A" | "B" | null = null;

        if (round < rounds) {
          const nextPos = Math.ceil(pos / 2);
          nextMatchId = `w_r${round + 1}_${nextPos}`;
          nextSlot = pos % 2 === 1 ? "A" : "B";

          // Loser goes to corresponding losers bracket round
          // Losers bracket has same structure
          const loserPos = Math.ceil(pos / 2);
          loserNextMatchId = `l_r${round}_${loserPos}`;
          loserNextSlot = pos % 2 === 1 ? "A" : "B";
        }

        const match: BracketMatch = {
          id: matchId,
          round,
          roundName: getWinnersRoundName(round, rounds, pos),
          position: pos,
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          winner: null,
          isBye: false,
          nextMatchId,
          nextSlot,
          bracket: "winners",
          loserNextMatchId,
          loserNextSlot,
        };

        matches.push(match);
      }
    }

    // ========================================
    // LOSERS BRACKET (Ranking Bracket)
    // ========================================
    const getLosersRoundName = (
      round: number,
      totalRounds: number,
      position: number,
    ): string => {
      const matchesInRound = Math.pow(2, totalRounds - round);
      if (matchesInRound === 1) return "Losers Final";
      if (matchesInRound === 2) return `Losers Semifinal ${position}`;
      return `Losers R${round} M${position}`;
    };

    // Losers bracket has rounds - 1 rounds (no need for first round losses)
    for (let round = 1; round < rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round - 1);

      for (let pos = 1; pos <= matchesInRound; pos++) {
        const matchId = `l_r${round}_${pos}`;

        let nextMatchId: string | null = null;
        let nextSlot: "A" | "B" | null = null;

        if (round < rounds - 1) {
          const nextPos = Math.ceil(pos / 2);
          nextMatchId = `l_r${round + 1}_${nextPos}`;
          nextSlot = pos % 2 === 1 ? "A" : "B";
        }

        const match: BracketMatch = {
          id: matchId,
          round,
          roundName: getLosersRoundName(round, rounds - 1, pos),
          position: pos,
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          winner: null,
          isBye: false,
          nextMatchId,
          nextSlot,
          bracket: "losers",
        };

        matches.push(match);
      }
    }

    // ========================================
    // SEED TEAMS INTO WINNERS BRACKET
    // ========================================
    const seedOrder = this.generateSeedOrder(firstRoundMatches * 2);
    const winnersR1 = matches.filter((m) => m.bracket === "winners" && m.round === 1);

    for (let i = 0; i < seedOrder.length; i++) {
      const seedPosition = seedOrder[i] - 1;
      const matchIndex = Math.floor(i / 2);
      const slot = i % 2 === 0 ? "A" : "B";

      if (seedPosition < teams.length && matchIndex < winnersR1.length) {
        const team = teams[seedPosition];
        if (slot === "A") {
          winnersR1[matchIndex].teamA = team;
        } else {
          winnersR1[matchIndex].teamB = team;
        }
      }
    }

    // Handle byes for first round (winners bracket only)
    for (const match of winnersR1) {
      if (match.teamA && !match.teamB) {
        match.isBye = true;
        match.winner = "A";
        this.advanceWinnerDouble(matches, match, match.teamA);
      } else if (!match.teamA && match.teamB) {
        match.isBye = true;
        match.winner = "B";
        this.advanceWinnerDouble(matches, match, match.teamB);
      } else if (!match.teamA && !match.teamB) {
        match.isBye = true;
      }
    }

    return matches;
  }

  // Advance winner in double elimination (also sends loser to losers bracket)
  private advanceWinnerDouble(
    matches: BracketMatch[],
    currentMatch: BracketMatch,
    winner: BracketTeam,
  ) {
    // Advance winner
    if (currentMatch.nextMatchId && currentMatch.nextSlot) {
      const nextMatch = matches.find((m) => m.id === currentMatch.nextMatchId);
      if (nextMatch) {
        if (currentMatch.nextSlot === "A") {
          nextMatch.teamA = winner;
        } else {
          nextMatch.teamB = winner;
        }
      }
    }

    // Send loser to losers bracket (only for winners bracket matches)
    if (currentMatch.bracket === "winners" && currentMatch.loserNextMatchId && currentMatch.loserNextSlot && !currentMatch.isBye) {
      const loser = currentMatch.winner === "A" ? currentMatch.teamB : currentMatch.teamA;
      if (loser) {
        const loserMatch = matches.find((m) => m.id === currentMatch.loserNextMatchId);
        if (loserMatch) {
          if (currentMatch.loserNextSlot === "A") {
            loserMatch.teamA = loser;
          } else {
            loserMatch.teamB = loser;
          }
        }
      }
    }
  }

  // Generate proper bracket seeding order
  // MODIFIED: User wants sequential pairing (1 vs 2, 3 vs 4) instead of standard 1 vs 8
  private generateSeedOrder(size: number): number[] {
    // Return sequential array [1, 2, 3, 4, ..., size]
    return Array.from({ length: size }, (_, i) => i + 1);
  }

  // Advance winner to next match
  private advanceWinner(
    matches: BracketMatch[],
    currentMatch: BracketMatch,
    winner: BracketTeam,
  ) {
    if (!currentMatch.nextMatchId || !currentMatch.nextSlot) return;

    const nextMatch = matches.find((m) => m.id === currentMatch.nextMatchId);
    if (!nextMatch) return;

    if (currentMatch.nextSlot === "A") {
      nextMatch.teamA = winner;
    } else {
      nextMatch.teamB = winner;
    }

    // Check if next match is now a bye
    if (
      (nextMatch.teamA && !nextMatch.teamB) ||
      (!nextMatch.teamA && nextMatch.teamB)
    ) {
      // Check if other match feeding this one is done
      const otherFeedingMatches = matches.filter(
        (m) => m.nextMatchId === nextMatch.id && m.id !== currentMatch.id,
      );

      const allDone = otherFeedingMatches.every(
        (m) => m.winner !== null || m.isBye,
      );

      if (allDone && otherFeedingMatches.length > 0) {
        // Not a bye, waiting for other match
      } else if (otherFeedingMatches.length === 0) {
        // Could be a bye situation
      }
    }
  }

  // Update match result
  public updateMatch(
    matchId: string,
    data: { scoreA?: number; scoreB?: number; winner?: "A" | "B" | null },
  ): BracketMatch | null {
    if (!this.state) return null;

    const match = this.state.matches.find((m) => m.id === matchId);
    if (!match) return null;

    // Update scores
    if (data.scoreA !== undefined) match.scoreA = data.scoreA;
    if (data.scoreB !== undefined) match.scoreB = data.scoreB;

    // Set winner and advance
    if (data.winner !== undefined && data.winner !== match.winner) {
      match.winner = data.winner;

      if (data.winner) {
        const winnerTeam = data.winner === "A" ? match.teamA : match.teamB;
        if (winnerTeam) {
          // Use appropriate advance function based on bracket type
          if (this.state.type === "double") {
            this.advanceWinnerDouble(this.state.matches, match, winnerTeam);
          } else {
            this.advanceWinner(this.state.matches, match, winnerTeam);
          }
        }
      }
    }

    this.saveToDisk();
    return match;
  }

  // Set match winner by tick (simpler API)
  public setMatchWinner(
    matchId: string,
    winner: "A" | "B",
  ): BracketMatch | null {
    return this.updateMatch(matchId, { winner });
  }

  // Reset bracket
  public resetBracket(): void {
    this.state = null;
    // Remove file
    Bun.write(BRACKET_DB_FILE, "null");
    console.log("🗑️ Bracket reset");
  }

  // Update match round title
  public updateRoundTitle(
    matchId: string,
    roundName: string,
  ): BracketMatch | null {
    if (!this.state) return null;

    const match = this.state.matches.find((m) => m.id === matchId);
    if (!match) return null;

    match.roundName = roundName;
    this.saveToDisk();
    return match;
  }

  // Add team to bracket
  public addTeam(name: string): BracketTeam | null {
    if (!this.state) return null;

    const newTeam: BracketTeam = {
      id: `team_${Date.now()}`,
      name,
      seed: this.state.teams.length + 1,
    };

    this.state.teams.push(newTeam);
    this.saveToDisk();
    return newTeam;
  }

  // Update team in bracket
  public updateTeam(
    teamId: string,
    data: Partial<BracketTeam>,
  ): BracketTeam | null {
    if (!this.state) return null;

    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team) return null;

    Object.assign(team, data);

    // Also update in matches
    for (const match of this.state.matches) {
      if (match.teamA?.id === teamId) {
        Object.assign(match.teamA, data);
      }
      if (match.teamB?.id === teamId) {
        Object.assign(match.teamB, data);
      }
    }

    this.saveToDisk();
    return team;
  }
}

// Singleton export
export const bracketManager = new BracketManager();
