// ---------------------------------------------------------------------------
// EPL DEFAULT SEED ROSTER (2023-24 Premier League squads).
//
// Real players, one honest purpose: the game must be PLAYABLE on a fresh
// deployment with no licensed data provider configured. Every row inserted
// from here carries source: 'seed' -- the catalog states its provenance on
// every row and the room UI says it in words ("SEED data — real licensed
// data arrives when a provider is connected"). Never presented as live data.
//
// Prices are a flat per-position seed economy set by the SEED, not by form.
// ---------------------------------------------------------------------------

const SEED_PRICE = { GK: 40, DEF: 45, MID: 55, FWD: 65 };

const ROSTERS = {
  Arsenal: [
    ['Ramsdale', 'GK'], ['Raya', 'GK'], ['White', 'DEF'], ['Saliba', 'DEF'],
    ['Gabriel', 'DEF'], ['Zinchenko', 'DEF'], ['Odegaard', 'MID'], ['Rice', 'MID'],
    ['Havertz', 'MID'], ['Saka', 'FWD'], ['Martinelli', 'FWD'], ['Jesus', 'FWD']
  ],
  'Aston Villa': [
    ['Emiliano Martinez', 'GK'], ['Olsen', 'GK'], ['Cash', 'DEF'], ['Konsa', 'DEF'],
    ['Diego Carlos', 'DEF'], ['Digne', 'DEF'], ['Douglas Luiz', 'MID'], ['McGinn', 'MID'],
    ['Ramsey', 'MID'], ['Bailey', 'FWD'], ['Watkins', 'FWD'], ['Duran', 'FWD']
  ],
  Bournemouth: [
    ['Neto', 'GK'], ['Travers', 'GK'], ['Aarons', 'DEF'], ['Senesi', 'DEF'],
    ['Kerkez', 'DEF'], ['Adam Smith', 'DEF'], ['Cook', 'MID'], ['Christie', 'MID'],
    ['Billing', 'MID'], ['Solanke', 'FWD'], ['Tavernier', 'FWD'], ['Semenyo', 'FWD']
  ],
  Brentford: [
    ['Flekken', 'GK'], ['Strakosha', 'GK'], ['Hickey', 'DEF'], ['Pinnock', 'DEF'],
    ['Mee', 'DEF'], ['Reguilon', 'DEF'], ['Janelt', 'MID'], ['Noergaard', 'MID'],
    ['Jensen', 'MID'], ['Wissa', 'FWD'], ['Mbeumo', 'FWD'], ['Toney', 'FWD']
  ],
  Brighton: [
    ['Verbruggen', 'GK'], ['Steele', 'GK'], ['van Hecke', 'DEF'], ['Dunk', 'DEF'],
    ['Webster', 'DEF'], ['Estupinan', 'DEF'], ['Gross', 'MID'], ['Gilmour', 'MID'],
    ['Milner', 'MID'], ['Mitoma', 'FWD'], ['Welbeck', 'FWD'], ['Joao Pedro', 'FWD']
  ],
  Burnley: [
    ['Trafford', 'GK'], ['Muric', 'GK'], ["O'Shea", 'DEF'], ['Beyer', 'DEF'],
    ['Esteve', 'DEF'], ['Charlie Taylor', 'DEF'], ['Brownhill', 'MID'], ['Berge', 'MID'],
    ['Zaroury', 'MID'], ['Lyle Foster', 'FWD'], ['Amdouni', 'FWD'], ['Jay Rodriguez', 'FWD']
  ],
  Chelsea: [
    ['Robert Sanchez', 'GK'], ['Petrovic', 'GK'], ['Reece James', 'DEF'], ['Thiago Silva', 'DEF'],
    ['Colwill', 'DEF'], ['Cucurella', 'DEF'], ['Enzo Fernandez', 'MID'], ['Caicedo', 'MID'],
    ['Gallagher', 'MID'], ['Palmer', 'FWD'], ['Nicolas Jackson', 'FWD'], ['Sterling', 'FWD']
  ],
  'Crystal Palace': [
    ['Johnstone', 'GK'], ['Dean Henderson', 'GK'], ['Clyne', 'DEF'], ['Andersen', 'DEF'],
    ['Guehi', 'DEF'], ['Mitchell', 'DEF'], ['Lerma', 'MID'], ['Doucoure', 'MID'],
    ['Eze', 'MID'], ['Olise', 'FWD'], ['Mateta', 'FWD'], ['Edouard', 'FWD']
  ],
  Everton: [
    ['Pickford', 'GK'], ['Tarkowski', 'DEF'], ['Keane', 'DEF'], ['Branthwaite', 'DEF'],
    ['Mykolenko', 'DEF'], ['Ashley Young', 'DEF'], ['Gueye', 'MID'], ['Garner', 'MID'],
    ['Abdoulaye Doucoure', 'MID'], ['McNeil', 'MID'], ['Harrison', 'MID'],
    ['Calvert-Lewin', 'FWD'], ['Beto', 'FWD']
  ],
  Fulham: [
    ['Leno', 'GK'], ['Diop', 'DEF'], ['Bassey', 'DEF'], ['Antonee Robinson', 'DEF'],
    ['Castagne', 'DEF'], ['Palhinha', 'MID'], ['Reed', 'MID'], ['Cairney', 'MID'],
    ['Iwobi', 'MID'], ['Raul Jimenez', 'FWD'], ['Muniz', 'FWD'], ['Adama Traore', 'FWD']
  ],
  Liverpool: [
    ['Alisson', 'GK'], ['Kelleher', 'GK'], ['Alexander-Arnold', 'DEF'], ['Van Dijk', 'DEF'],
    ['Konate', 'DEF'], ['Robertson', 'DEF'], ['Mac Allister', 'MID'], ['Szoboszlai', 'MID'],
    ['Gravenberch', 'MID'], ['Salah', 'FWD'], ['Nunez', 'FWD'], ['Diogo Jota', 'FWD']
  ],
  'Luton Town': [
    ['Kaminski', 'GK'], ['Iversen', 'GK'], ['Lockyer', 'DEF'], ['Mads Andersen', 'DEF'],
    ["Amari'i Bell", 'DEF'], ['Reece Burke', 'DEF'], ['Osho', 'DEF'], ['Barkley', 'MID'],
    ['Nakamba', 'MID'], ['Cauley Woodrow', 'FWD'], ['Adebayo', 'FWD'], ['Chong', 'FWD']
  ],
  'Manchester City': [
    ['Ederson', 'GK'], ['Ortega', 'GK'], ['Walker', 'DEF'], ['Ruben Dias', 'DEF'],
    ['Akanji', 'DEF'], ['Gvardiol', 'DEF'], ['Rodri', 'MID'], ['De Bruyne', 'MID'],
    ['Foden', 'MID'], ['Haaland', 'FWD'], ['Julian Alvarez', 'FWD'], ['Doku', 'FWD']
  ],
  'Manchester United': [
    ['Onana', 'GK'], ['Bayindir', 'GK'], ['Dalot', 'DEF'], ['Varane', 'DEF'],
    ['Lisandro Martinez', 'DEF'], ['Luke Shaw', 'DEF'], ['Casemiro', 'MID'], ['Bruno Fernandes', 'MID'],
    ['Mainoo', 'MID'], ['Rashford', 'FWD'], ['Hojlund', 'FWD'], ['Garnacho', 'FWD']
  ],
  'Newcastle United': [
    ['Pope', 'GK'], ['Dubravka', 'GK'], ['Trippier', 'DEF'], ['Botman', 'DEF'],
    ['Schar', 'DEF'], ['Burn', 'DEF'], ['Bruno Guimaraes', 'MID'], ['Joelinton', 'MID'],
    ['Longstaff', 'MID'], ['Isak', 'FWD'], ['Gordon', 'FWD'], ['Callum Wilson', 'FWD']
  ],
  'Nottingham Forest': [
    ['Vlachodimos', 'GK'], ['Turner', 'GK'], ['Niakhate', 'DEF'], ['Felipe', 'DEF'],
    ['Murillo', 'DEF'], ['Aina', 'DEF'], ['Yates', 'MID'], ['Gibbs-White', 'MID'],
    ['Danilo', 'MID'], ['Elanga', 'FWD'], ['Awoniyi', 'FWD'], ['Chris Wood', 'FWD']
  ],
  'Sheffield United': [
    ['Foderingham', 'GK'], ['Grbic', 'GK'], ['Ahmedhodzic', 'DEF'], ['Jack Robinson', 'DEF'],
    ['Trusty', 'DEF'], ['Basham', 'DEF'], ['Norrington-Davies', 'DEF'], ['Hamer', 'MID'],
    ['Vinicius Souza', 'MID'], ['McAtee', 'MID'], ['McBurnie', 'FWD'], ['Archer', 'FWD']
  ],
  'Tottenham Hotspur': [
    ['Vicario', 'GK'], ['Forster', 'GK'], ['Romero', 'DEF'], ['Van de Ven', 'DEF'],
    ['Udogie', 'DEF'], ['Porro', 'DEF'], ['Bissouma', 'MID'], ['Pape Sarr', 'MID'],
    ['Maddison', 'MID'], ['Son', 'FWD'], ['Richarlison', 'FWD'], ['Kulusevski', 'FWD']
  ],
  'West Ham United': [
    ['Areola', 'GK'], ['Fabianski', 'GK'], ['Zouma', 'DEF'], ['Aguerd', 'DEF'],
    ['Emerson', 'DEF'], ['Coufal', 'DEF'], ['Soucek', 'MID'], ['Ward-Prowse', 'MID'],
    ['Paqueta', 'MID'], ['Bowen', 'FWD'], ['Antonio', 'FWD'], ['Kudus', 'FWD']
  ],
  'Wolverhampton Wanderers': [
    ['Jose Sa', 'GK'], ['Bentley', 'GK'], ['Kilman', 'DEF'], ['Dawson', 'DEF'],
    ['Toti', 'DEF'], ['Semedo', 'DEF'], ['Lemina', 'MID'], ['Tommy Doyle', 'MID'],
    ['Sarabia', 'MID'], ['Hwang Hee-chan', 'FWD'], ['Pedro Neto', 'FWD'], ['Cunha', 'FWD']
  ]
};

/** The default seed rows in catalog-insert shape (name, club, position, price). */
export function defaultSeedRows() {
  const rows = [];
  for (const [club, squad] of Object.entries(ROSTERS)) {
    for (const [name, position] of squad) {
      rows.push({ name, club, position, price: SEED_PRICE[position] });
    }
  }
  return rows;
}
