use libfftt::joueur::Joueur;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize, Deserialize)]
struct PlayerResponse {
    success: bool,
    data: Option<PlayerData>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct PlayerData {
    licence: String,
    nom: String,
    prenom: String,
    points_init: f32,
    point: f32,
    _virtual: f32,
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() != 2 {
        eprintln!("Usage: {} <license_number>", args[0]);
        std::process::exit(1);
    }
    
    let license_number = &args[1];
    
    match fetch_player_info(license_number).await {
        Ok(response) => {
            println!("{}", serde_json::to_string(&response).unwrap());
        }
        Err(e) => {
            let error_response = PlayerResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to fetch player info: {}", e)),
            };
            println!("{}", serde_json::to_string(&error_response).unwrap());
            std::process::exit(1);
        }
    }
}

async fn fetch_player_info(license: &str) -> Result<PlayerResponse, Box<dyn std::error::Error>> {
    match Joueur::new(license).await {
        Ok(joueur) => {
            let player_data = PlayerData {
                licence: joueur.licence,
                nom: joueur.nom,
                prenom: joueur.prenom,
                points_init: joueur.points_init,
                point: joueur.point,
                _virtual: joueur._virtual,
            };
            
            Ok(PlayerResponse {
                success: true,
                data: Some(player_data),
                error: None,
            })
        }
        Err(e) => {
            Ok(PlayerResponse {
                success: false,
                data: None,
                error: Some(format!("Player not found or API error: {:?}", e)),
            })
        }
    }
}