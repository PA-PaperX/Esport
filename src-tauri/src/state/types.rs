// Data type definitions matching TypeScript interfaces
use serde::{Deserialize, Serialize};

// ==========================================
// Match State Types
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchState {
    #[serde(default = "default_match_id")]
    pub match_id: String,
    #[serde(default = "default_best_of")]
    pub best_of: i32,
    #[serde(default = "default_current_game")]
    pub current_game: i32,
    #[serde(default)]
    pub swapped: bool,
    #[serde(default)]
    pub linked_match_id: Option<String>,
    pub teams: Teams,
}

fn default_match_id() -> String {
    "match_001".to_string()
}
fn default_best_of() -> i32 {
    3
}
fn default_current_game() -> i32 {
    1
}

impl Default for MatchState {
    fn default() -> Self {
        Self {
            match_id: default_match_id(),
            best_of: default_best_of(),
            current_game: default_current_game(),
            swapped: false,
            linked_match_id: None,
            teams: Teams::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Teams {
    #[serde(rename = "A")]
    pub a: Team,
    #[serde(rename = "B")]
    pub b: Team,
}

impl Default for Teams {
    fn default() -> Self {
        Self {
            a: Team::default_team_a(),
            b: Team::default_team_b(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub name: String,
    #[serde(default)]
    pub short_name: String,
    pub color: String,
    #[serde(default)]
    pub logo: String,
    #[serde(default)]
    pub logo_fit: Option<String>,
    #[serde(default)]
    pub logo_version: Option<i64>,
    #[serde(default)]
    pub score: i32,
    #[serde(default = "default_players")]
    pub players: Vec<Player>,
}

fn default_players() -> Vec<Player> {
    (1..=5)
        .map(|slot| Player {
            slot,
            name: format!("Player {}", slot),
            real_name: None,
            hero: None,
            lane: None,
            is_captain: slot == 1,
        })
        .collect()
}

impl Team {
    pub fn default_team_a() -> Self {
        Self {
            name: "HOME TEAM".to_string(),
            short_name: "HOME".to_string(),
            color: "#007AFF".to_string(),
            logo: String::new(),
            logo_fit: None,
            logo_version: None,
            score: 0,
            players: default_players(),
        }
    }

    pub fn default_team_b() -> Self {
        Self {
            name: "AWAY TEAM".to_string(),
            short_name: "AWAY".to_string(),
            color: "#FF453A".to_string(),
            logo: String::new(),
            logo_fit: None,
            logo_version: None,
            score: 0,
            players: default_players(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub slot: usize,
    pub name: String,
    #[serde(default)]
    pub real_name: Option<String>,
    #[serde(default)]
    pub hero: Option<String>,
    #[serde(default)]
    pub lane: Option<String>,
    #[serde(default)]
    pub is_captain: bool,
}

// ==========================================
// Lower Third Types
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LowerThirdState {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_slots")]
    pub slots: Vec<LowerThirdSlot>,
}

fn default_true() -> bool {
    true
}

fn default_slots() -> Vec<LowerThirdSlot> {
    (1..=3)
        .map(|id| LowerThirdSlot {
            id,
            text: String::new(),
            logo_path: None,
            enabled: true,
        })
        .collect()
}

impl Default for LowerThirdState {
    fn default() -> Self {
        Self {
            enabled: true,
            title: "TOURNAMENT NAME".to_string(),
            slots: default_slots(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LowerThirdSlot {
    pub id: u32,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub logo_path: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

// ==========================================
// Bracket Types
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bracket {
    pub name: String,
    #[serde(rename = "type")]
    pub bracket_type: String,
    pub teams: Vec<BracketTeam>,
    pub matches: Vec<BracketMatch>,
    pub created_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BracketTeam {
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub logo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BracketMatch {
    pub id: String,
    pub round: i32,
    #[serde(default)]
    pub round_name: Option<String>,
    #[serde(default)]
    pub team_a: Option<BracketTeam>,
    #[serde(default)]
    pub team_b: Option<BracketTeam>,
    #[serde(default)]
    pub score_a: i32,
    #[serde(default)]
    pub score_b: i32,
    #[serde(default)]
    pub winner: Option<String>,
    #[serde(default)]
    pub next_match_id: Option<String>,
}

// ==========================================
// Template Types
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub logo: String,
    #[serde(default)]
    pub players: Vec<Player>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
}

// ==========================================
// Font Types
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontState {
    #[serde(default)]
    pub fonts: Vec<CustomFont>,
    #[serde(default)]
    pub assignments: FontAssignments,
}

impl Default for FontState {
    fn default() -> Self {
        Self {
            fonts: Vec::new(),
            assignments: FontAssignments::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFont {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub format: String,
    pub path: String,
    #[serde(default = "default_weight")]
    pub weight: String,
    #[serde(default = "default_style")]
    pub style: String,
    pub created_at: String,
}

fn default_weight() -> String {
    "400".to_string()
}
fn default_style() -> String {
    "normal".to_string()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontAssignments {
    #[serde(default)]
    pub lower_third_title: Option<String>,
    #[serde(default)]
    pub lower_third_slots: Option<String>,
    #[serde(default)]
    pub scoreboard_team_name: Option<String>,
    #[serde(default)]
    pub scoreboard_score: Option<String>,
    #[serde(default)]
    pub versus_team_name: Option<String>,
    #[serde(default)]
    pub bracket_team_name: Option<String>,
    #[serde(default)]
    pub transition_title: Option<String>,
}
