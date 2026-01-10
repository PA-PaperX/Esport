// State management module
mod types;

pub use types::*;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Main application state
pub struct AppState {
    pub match_state: MatchState,
    pub lower_third: LowerThirdState,
    pub bracket: Option<Bracket>,
    pub templates: Vec<Template>,
    pub fonts: FontState,
    data_dir: PathBuf,
}

impl AppState {
    /// Load state from files or create defaults
    pub fn load_or_default() -> Self {
        let data_dir = get_data_dir();
        std::fs::create_dir_all(&data_dir).ok();

        let match_state =
            Self::load_json(&data_dir.join("state.json")).unwrap_or_else(|| MatchState::default());

        let lower_third = Self::load_json(&data_dir.join("lower-third-data.json"))
            .unwrap_or_else(|| LowerThirdState::default());

        let bracket = Self::load_json(&data_dir.join("bracket-data.json"));

        let templates =
            Self::load_json(&data_dir.join("templates.json")).unwrap_or_else(|| Vec::new());

        let fonts = Self::load_json(&data_dir.join("font-settings.json"))
            .unwrap_or_else(|| FontState::default());

        Self {
            match_state,
            lower_third,
            bracket,
            templates,
            fonts,
            data_dir,
        }
    }

    fn load_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Option<T> {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
    }

    fn save_json<T: Serialize>(path: &PathBuf, data: &T) {
        if let Ok(json) = serde_json::to_string_pretty(data) {
            std::fs::write(path, json).ok();
        }
    }

    pub fn save(&self) {
        Self::save_json(&self.data_dir.join("state.json"), &self.match_state);
    }

    pub fn save_lower_third(&self) {
        Self::save_json(
            &self.data_dir.join("lower-third-data.json"),
            &self.lower_third,
        );
    }

    pub fn save_bracket(&self) {
        Self::save_json(&self.data_dir.join("bracket-data.json"), &self.bracket);
    }

    pub fn save_templates(&self) {
        Self::save_json(&self.data_dir.join("templates.json"), &self.templates);
    }

    pub fn save_fonts(&self) {
        Self::save_json(&self.data_dir.join("font-settings.json"), &self.fonts);
    }

    /// Create a new bracket
    pub fn create_bracket(
        &mut self,
        name: &str,
        bracket_type: &str,
        team_names: &[String],
        team_data: Option<&[serde_json::Value]>,
    ) -> &Bracket {
        let mut teams: Vec<BracketTeam> = team_names
            .iter()
            .enumerate()
            .map(|(i, name)| {
                let mut team = BracketTeam {
                    name: name.clone(),
                    color: if i % 2 == 0 {
                        "#007AFF".to_string()
                    } else {
                        "#FF453A".to_string()
                    },
                    logo: None,
                };

                // Copy team data if provided
                if let Some(data) = team_data {
                    if let Some(td) = data.get(i) {
                        if let Some(color) = td.get("color").and_then(|v| v.as_str()) {
                            team.color = color.to_string();
                        }
                        if let Some(logo) = td.get("logo").and_then(|v| v.as_str()) {
                            team.logo = Some(logo.to_string());
                        }
                    }
                }

                team
            })
            .collect();

        // Pad to power of 2
        let mut n = 2;
        while n < teams.len() {
            n *= 2;
        }
        while teams.len() < n {
            teams.push(BracketTeam {
                name: "BYE".to_string(),
                color: "#888888".to_string(),
                logo: None,
            });
        }

        // Create matches
        let mut matches = Vec::new();
        let num_rounds = (n as f64).log2() as u32;
        let mut match_idx = 0;

        for round in 1..=num_rounds {
            let matches_in_round = n / (2_usize.pow(round));
            for _ in 0..matches_in_round {
                let match_id = format!("match_r{}_{}", round, match_idx);

                let (team_a, team_b) = if round == 1 {
                    let idx_a = match_idx * 2;
                    let idx_b = match_idx * 2 + 1;
                    (
                        Some(teams.get(idx_a).cloned().unwrap_or_default()),
                        Some(teams.get(idx_b).cloned().unwrap_or_default()),
                    )
                } else {
                    (None, None) // Will be filled when previous round completes
                };

                matches.push(BracketMatch {
                    id: match_id,
                    round: round as i32,
                    round_name: None,
                    team_a,
                    team_b,
                    score_a: 0,
                    score_b: 0,
                    winner: None,
                    next_match_id: None,
                });

                match_idx += 1;
            }
        }

        self.bracket = Some(Bracket {
            name: name.to_string(),
            bracket_type: bracket_type.to_string(),
            teams,
            matches,
            created_at: chrono::Utc::now().to_rfc3339(),
        });

        self.bracket.as_ref().unwrap()
    }
}

/// Get data directory (AppData on Windows)
fn get_data_dir() -> PathBuf {
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("EsportControlPanel")
    } else {
        PathBuf::from("data")
    }
}
