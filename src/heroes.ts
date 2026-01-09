// ==========================================
// ROV Heroes Database (125 Heroes)
// ==========================================

export interface Hero {
  id: number;
  name: string;
}

export const HEROES: Hero[] = [
  // 1-20
  { id: 1, name: "Valhein" },
  { id: 2, name: "Zanis" },
  { id: 3, name: "Yorn" },
  { id: 4, name: "Thane" },
  { id: 5, name: "Krixi" },
  { id: 6, name: "Ormarr" },
  { id: 7, name: "Zephys" },
  { id: 8, name: "Lu Bu" },
  { id: 9, name: "Alice" },
  { id: 10, name: "Mganga" },
  { id: 11, name: "Gildur" },
  { id: 12, name: "Butterfly" },
  { id: 13, name: "Taara" },
  { id: 14, name: "Toro" },
  { id: 15, name: "Mina" },
  { id: 16, name: "Veera" },
  { id: 17, name: "Kahlii" },
  { id: 18, name: "Azzen'Ka" },
  { id: 19, name: "Chaugnar" },
  { id: 20, name: "Omega" },

  // 21-40
  { id: 21, name: "Violet" },
  { id: 22, name: "Diao Chan" },
  { id: 23, name: "Nakroth" },
  { id: 24, name: "Grakk" },
  { id: 25, name: "Fennik" },
  { id: 26, name: "Aleister" },
  { id: 27, name: "Lumburr" },
  { id: 28, name: "Payna" },
  { id: 29, name: "Natalya" },
  { id: 30, name: "Cresht" },
  { id: 31, name: "Jinna" },
  { id: 32, name: "Maloch" },
  { id: 33, name: "Ilumia" },
  { id: 34, name: "WuKong" },
  { id: 35, name: "Kriknak" },
  { id: 36, name: "Mortos" },
  { id: 37, name: "Batman" },
  { id: 38, name: "Slimz" },
  { id: 39, name: "Preyta" },
  { id: 40, name: "Skud" },

  // 41-60
  { id: 41, name: "Airi" },
  { id: 42, name: "Ignis" },
  { id: 43, name: "Zuka" },
  { id: 44, name: "Raz" },
  { id: 45, name: "Murad" },
  { id: 46, name: "Zill" },
  { id: 47, name: "Lauriel" },
  { id: 48, name: "The Joker" },
  { id: 49, name: "Arduin" },
  { id: 50, name: "Astrid" },
  { id: 51, name: "Tel'Annas" },
  { id: 52, name: "Superman" },
  { id: 53, name: "Wonder Woman" },
  { id: 54, name: "Xeniel" },
  { id: 55, name: "Ryoma" },
  { id: 56, name: "Moren" },
  { id: 57, name: "TeeMee" },
  { id: 58, name: "Lindis" },
  { id: 59, name: "Omen" },
  { id: 60, name: "Tulen" },

  // 61-80
  { id: 61, name: "Liliana" },
  { id: 62, name: "Max" },
  { id: 63, name: "Kil'Groth" },
  { id: 64, name: "Wisp" },
  { id: 65, name: "The Flash" },
  { id: 66, name: "Arum" },
  { id: 67, name: "Rourke" },
  { id: 68, name: "Marja" },
  { id: 69, name: "Baldum" },
  { id: 70, name: "Roxie" },
  { id: 71, name: "Annette" },
  { id: 72, name: "Amily" },
  { id: 73, name: "Y'bneth" },
  { id: 74, name: "Elsu" },
  { id: 75, name: "Riktor" },
  { id: 76, name: "Wiro" },
  { id: 77, name: "Quillen" },
  { id: 78, name: "Sephera" },
  { id: 79, name: "Florentino" },
  { id: 80, name: "Veres" },

  // 81-100
  { id: 81, name: "D'Arcy" },
  { id: 82, name: "Hayate" },
  { id: 83, name: "Capheny" },
  { id: 84, name: "Errol" },
  { id: 85, name: "Yena" },
  { id: 86, name: "Enzo" },
  { id: 87, name: "Zip" },
  { id: 88, name: "Qi" },
  { id: 89, name: "Celica" },
  { id: 90, name: "Volkath" },
  { id: 91, name: "Krizzix" },
  { id: 92, name: "Eland'orr" },
  { id: 93, name: "Ishar" },
  { id: 94, name: "Dirak" },
  { id: 95, name: "Keera" },
  { id: 96, name: "Ata" },
  { id: 97, name: "Paine" },
  { id: 98, name: "Laville" },
  { id: 99, name: "Rouie" },
  { id: 100, name: "Zata" },

  // 101-125
  { id: 101, name: "Allain" },
  { id: 102, name: "Thorne" },
  { id: 103, name: "Sinestrea" },
  { id: 104, name: "Dextra" },
  { id: 105, name: "Lorion" },
  { id: 106, name: "Bright" },
  { id: 107, name: "Aoi" },
  { id: 108, name: "Iggy" },
  { id: 109, name: "Tachi" },
  { id: 110, name: "Aya" },
  { id: 111, name: "Yue" },
  { id: 112, name: "Yan" },
  { id: 113, name: "Teeri" },
  { id: 114, name: "Bonnie" },
  { id: 115, name: "Bijan" },
  { id: 116, name: "Ming" },
  { id: 117, name: "Erin" },
  { id: 118, name: "Charlotte" },
  { id: 119, name: "Dolia" },
  { id: 120, name: "Biron" },
  { id: 121, name: "Bolt Baron" },
  { id: 122, name: "Billow" },
  { id: 123, name: "Heino" },
  { id: 124, name: "Goverra" },
  { id: 125, name: "Edras" },
];

// Search heroes by name
export function searchHeroes(query: string): Hero[] {
  if (!query.trim()) return HEROES;
  const lowerQuery = query.toLowerCase();
  return HEROES.filter((hero) => hero.name.toLowerCase().includes(lowerQuery));
}

// Get hero by name
export function getHeroByName(name: string): Hero | undefined {
  return HEROES.find((hero) => hero.name === name);
}
