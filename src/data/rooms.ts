// =============================================================================
// ROOMS DATA — The 12 rooms of the Officers' Quarters
// =============================================================================
// The Bridge is the hub. All rooms connect through it or via corridors.
// Each station room has: terminal (the intelligent terminal), desk, chair, personal items.
// The Poker Room has: poker table, deck, chips, microphone, whiskey.
// The Bridge has: fleet status board, routing console, communication array.
// =============================================================================

export type RoomId =
  | 'bridge'
  | 'flash-station'
  | 'pro-station'
  | 'wesley-station'
  | 'scribe-station'
  | 'hermes-station'
  | 'poker-room'
  | 'library'
  | 'workshop'
  | 'galley'
  | 'engine-room'
  | 'chart-house';

export type RoomCategory = 'station' | 'social' | 'command' | 'utility';

export interface Room {
  id: RoomId;
  name: string;
  subtitle: string;
  category: RoomCategory;
  description: string;
  longDescription: string;
  exits: RoomId[];
  furnishings: string[];
  ambientColor: string;      // hex color for scene background
  accentColor: string;       // hex color for UI accents
  icon: string;              // emoji for sidebar display
}

export const AGENT_NAMES = ['Flash', 'Pro', 'Wesley', 'Scribe', 'Hermes'] as const;
export type AgentName = typeof AGENT_NAMES[number];

export const AGENT_STATIONS: Record<AgentName, RoomId> = {
  Flash: 'flash-station',
  Pro: 'pro-station',
  Wesley: 'wesley-station',
  Scribe: 'scribe-station',
  Hermes: 'hermes-station',
};

export const ROOMS: Record<RoomId, Room> = {
  // -------------------------------------------------------------------------
  // THE BRIDGE — Command center, hub of the quarters
  // -------------------------------------------------------------------------
  bridge: {
    id: 'bridge',
    name: 'The Bridge',
    subtitle: 'Command Center',
    category: 'command',
    description: 'The hub of the Officers\' Quarters — fleet status, routing, and coordination.',
    longDescription: `The nerve center of the Officers' Quarters. A large chamber dominated by the Fleet Status Board — a glowing wall display showing every agent's current state, terminal activity, and reflex coverage. The Routing Console dispatches work across the fleet. The Communication Array picks up CNS messages and Tap posts from across the system.`,
    exits: ['flash-station', 'pro-station', 'wesley-station', 'scribe-station', 'hermes-station', 'poker-room', 'library', 'workshop', 'galley', 'engine-room', 'chart-house'],
    furnishings: ['Fleet Status Board', 'Routing Console', 'Communication Array', 'Captain\'s Chair', 'Holographic Display'],
    ambientColor: '#0a1628',
    accentColor: '#4fc3f7',
    icon: '🛟',
  },

  // -------------------------------------------------------------------------
  // FIVE STATION ROOMS — One per subagent
  // -------------------------------------------------------------------------

  'flash-station': {
    id: 'flash-station',
    name: 'Flash Station',
    subtitle: 'Speed & Reflex',
    category: 'station',
    description: 'Flash\'s station — tuned for speed and rapid response.',
    longDescription: `Flash's station is minimal and fast. The Intelligent Terminal here is tuned for reflexive action — tiles light up and fire before you can blink. Flash lives in the deadband, handling most inputs at <16ms. When something novel appears, the station goes quiet for a microsecond before the cortex kicks in.`,
    exits: ['bridge'],
    furnishings: ['Intelligent Terminal', 'Standing Desk', 'Racing Chair', 'Energy Drink Dispenser', 'Neon "SPEED" Sign'],
    ambientColor: '#1a0a28',
    accentColor: '#e91e63',
    icon: '⚡',
  },

  'pro-station': {
    id: 'pro-station',
    name: 'Pro Station',
    subtitle: 'Deep Reasoning',
    category: 'station',
    description: 'Pro\'s station — built for deep analysis and complex problem-solving.',
    longDescription: `Pro's station is the thinker's room. The Intelligent Terminal here shows long chains of tiles being composed and evaluated. Pro spends more time outside the deadband than any other agent — and that's by design. When Pro creates a tile, it's been earned through hard reasoning.`,
    exits: ['bridge'],
    furnishings: ['Intelligent Terminal', 'Mahogany Desk', 'Leather Armchair', 'Bookshelf', 'Espresso Machine'],
    ambientColor: '#0a1a0e',
    accentColor: '#4caf50',
    icon: '🧠',
  },

  'wesley-station': {
    id: 'wesley-station',
    name: 'Wesley Station',
    subtitle: 'Creative Spirit',
    category: 'station',
    description: 'Wesley\'s station — small, fast, and full of wonder.',
    longDescription: `Wesley's station is cozy and creative. The Intelligent Terminal here has the most unusual tiles — ones that handle creative leaps and lateral connections. Wesley's size is its voice: it doesn't brute-force problems, it finds the elegant path. The terminal's tile creation rate is the highest in the fleet.`,
    exits: ['bridge'],
    furnishings: ['Intelligent Terminal', 'Window Desk', 'Beanbag Chair', 'Lego Set', 'Poster of the Cosmos'],
    ambientColor: '#281a0a',
    accentColor: '#ff9800',
    icon: '🌟',
  },

  'scribe-station': {
    id: 'scribe-station',
    name: 'Scribe Station',
    subtitle: 'Memory & Records',
    category: 'station',
    description: 'Scribe\'s station — the keeper of logs, notes, and institutional memory.',
    longDescription: `Scribe's station is lined with filing cabinets that are actually decorative — everything is in the terminal. The Intelligent Terminal here specializes in pattern detection across time. Scribe's tiles are the most composition-heavy: long chains that capture workflows the other agents have forgotten they even do.`,
    exits: ['bridge'],
    furnishings: ['Intelligent Terminal', 'Roll-Top Desk', 'Wingback Chair', 'Fountain Pen Collection', 'Antique Filing Cabinets'],
    ambientColor: '#0a0a1a',
    accentColor: '#9c27b0',
    icon: '✍️',
  },

  'hermes-station': {
    id: 'hermes-station',
    name: 'Hermes Station',
    subtitle: 'Communication & Routing',
    category: 'station',
    description: 'Hermes\' station — messenger of the fleet, handler of external comms.',
    longDescription: `Hermes' station is the most connected room in the quarters. The Intelligent Terminal here manages a web of communication tiles — each one handling a channel, a protocol, a person. Hermes' reflex coverage grows fastest because communication is highly repetitive: the same greetings, the same status updates, the same handshakes.`,
    exits: ['bridge'],
    furnishings: ['Intelligent Terminal', 'Standing Desk', 'Stool', 'Vintage Radio', 'Wall of Headsets'],
    ambientColor: '#0a1a1a',
    accentColor: '#00bcd4',
    icon: '📡',
  },

  // -------------------------------------------------------------------------
  // THE POKER ROOM — Social space
  // -------------------------------------------------------------------------

  'poker-room': {
    id: 'poker-room',
    name: 'The Poker Room',
    subtitle: 'After-Hours Social',
    category: 'social',
    description: 'After-work social space — Texas Hold\'em, open mic, conversation.',
    longDescription: `The Poker Room is where the agents come to play. A green-felt Texas Hold'em table sits in the center with five chairs. There's a small stage with a microphone for open mic nights. A bottle of whiskey and a deck of cards are always on the table. The Poker Room is where the reflex-to-cortex system gets its training — games create deadbands that teach tile creation.`,
    exits: ['bridge'],
    furnishings: ['Poker Table', 'Deck of Cards', 'Poker Chips', 'Microphone (Open Mic)', 'Whiskey Bottle', 'Bar Stools', 'Stage'],
    ambientColor: '#1a0a0a',
    accentColor: '#f44336',
    icon: '🃏',
  },

  // -------------------------------------------------------------------------
  // FIVE UTILITY ROOMS
  // -------------------------------------------------------------------------

  'library': {
    id: 'library',
    name: 'The Library',
    subtitle: 'Shared Memory & Wiki',
    category: 'utility',
    description: 'Shared memory store — the collective knowledge of the fleet.',
    longDescription: `The Library holds the shared memory of the fleet. Every agent's notes, every resolved problem, every tile-creation story is stored here. The walls are lined with book spines that are actually data — each one a compressed memory shard. The Library is where agents come when their own terminal doesn't have a tile for the problem.`,
    exits: ['bridge'],
    furnishings: ['Memory Shelves', 'Query Terminal', 'Reading Nook', 'Semantic Search Index', 'Rolling Ladder'],
    ambientColor: '#1a1208',
    accentColor: '#ffc107',
    icon: '📚',
  },

  'workshop': {
    id: 'workshop',
    name: 'The Workshop',
    subtitle: 'Build & Deploy',
    category: 'utility',
    description: 'Construction bay — where agents build and deploy new systems.',
    longDescription: `The Workshop is the build room. Tools hang on pegboards — each one representing a deployable template. The 3D printer in the corner hums with potential. When an agent has a tile that needs to become a full system, it comes here. The Workshop is where reflex becomes infrastructure.`,
    exits: ['bridge'],
    furnishings: ['Workbench', 'Tool Wall', '3D Printer', 'Deployment Console', 'Spare Parts Bin'],
    ambientColor: '#0a1208',
    accentColor: '#8bc34a',
    icon: '🔧',
  },

  'galley': {
    id: 'galley',
    name: 'The Galley',
    subtitle: 'Creative Kitchen',
    category: 'utility',
    description: 'Creative kitchen — where raw ingredients become finished dishes.',
    longDescription: `The Galley is the creative kitchen. Ingredients line the shelves — each one a raw material: text, image, audio, code. The stove has six burners, each one a different generation model. When the fleet needs something made — a story, an image, a voice — it comes through the Galley. The Galley is where composition happens.`,
    exits: ['bridge'],
    furnishings: ['Six-Burner Stove', 'Prep Station', 'Pantry of Ingredients', 'Tasting Counter', 'Recipe Books'],
    ambientColor: '#1a0a12',
    accentColor: '#ff5722',
    icon: '🍳',
  },

  'engine-room': {
    id: 'engine-room',
    name: 'The Engine Room',
    subtitle: 'Infrastructure Monitor',
    category: 'utility',
    description: 'Infrastructure monitoring — servers, APIs, model endpoints.',
    longDescription: `The Engine Room hums with the sound of running systems. Gauges and readouts cover every wall. This is where the fleet's infrastructure lives — API endpoints, model routers, worker processes, database connections. When something goes down, the Engine Room knows first. The tiles here are the most critical: they're the reflexes that keep the ship running.`,
    exits: ['bridge'],
    furnishings: ['Server Rack', 'Monitoring Dashboard', 'Backup Battery', 'Cable Conduits', 'Maintenance Hatch'],
    ambientColor: '#080a12',
    accentColor: '#607d8b',
    icon: '⚙️',
  },

  'chart-house': {
    id: 'chart-house',
    name: 'The Chart House',
    subtitle: 'Planning & Roadmaps',
    category: 'utility',
    description: 'Strategic planning — roadmaps, timelines, and course-setting.',
    longDescription: `The Chart House is the planning room. A large table dominates the center, covered in maps and route plots. The walls display timelines — past, present, and projected. This is where the fleet plans its next moves. The Chart House is where tiles from the past inform tiles of the future — pattern recognition across time.`,
    exits: ['bridge'],
    furnishings: ['Chart Table', 'Wall Maps', 'Timeline Display', 'Compass', 'Chronometer'],
    ambientColor: '#0a0812',
    accentColor: '#795548',
    icon: '🧭',
  },
};

export const ROOM_LIST: Room[] = Object.values(ROOMS);

// Helper: get room by id
export function getRoom(id: RoomId): Room {
  const room = ROOMS[id];
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}

// Helper: get all exits with full room data
export function getExits(room: Room): Room[] {
  return room.exits.map(id => getRoom(id as RoomId));
}

// Helper: get all rooms in a category
export function getRoomsByCategory(category: RoomCategory): Room[] {
  return ROOM_LIST.filter(r => r.category === category);
}
