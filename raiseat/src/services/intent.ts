import type { FoodPlanningIntent, Cuisine } from '../types';
import { INGREDIENTS } from '../data/ingredients';
import { ROUTES } from '../data/travel';

/** Extra aliases mapping everyday words → ingredient ids. */
const ALIASES: Record<string, string> = {
  chicken: 'chicken-whole', ayam: 'chicken-whole', 'chicken breast': 'chicken-breast',
  egg: 'egg', eggs: 'egg', telur: 'egg',
  rice: 'rice', beras: 'rice', nasi: 'rice',
  prawn: 'prawn', prawns: 'prawn', udang: 'prawn', shrimp: 'prawn',
  fish: 'fish-mackerel', ikan: 'fish-mackerel',
  beef: 'beef', daging: 'beef',
  onion: 'onion', onions: 'onion', 'bawang': 'onion',
  garlic: 'garlic', ginger: 'ginger', halia: 'ginger',
  tomato: 'tomato', tomatoes: 'tomato',
  carrot: 'carrot', carrots: 'carrot',
  potato: 'potato', potatoes: 'potato',
  spinach: 'spinach', bayam: 'spinach',
  kangkung: 'kangkung', cabbage: 'cabbage', kubis: 'cabbage',
  tofu: 'tofu', tauhu: 'tofu', tempeh: 'tempeh', tempe: 'tempeh',
  noodles: 'yellow-noodles', mee: 'yellow-noodles', bihun: 'rice-vermicelli',
  'coconut milk': 'coconut-milk', santan: 'coconut-milk',
  bread: 'bread', roti: 'bread',
  'soy sauce': 'soy-sauce', kicap: 'sweet-soy',
  chili: 'chili-red', chilli: 'chili-red', cili: 'chili-red',
  lime: 'lime', limau: 'calamansi',
};

const CUISINE_WORDS: [RegExp, Cuisine][] = [
  [/kelantan/i, 'Kelantan'], [/terengganu/i, 'Terengganu'], [/sabah/i, 'Sabah'],
  [/sarawak|kuching/i, 'Sarawak'], [/penang/i, 'Penang'], [/peranakan|nyonya/i, 'Peranakan'],
  [/chinese/i, 'Chinese'], [/indian|mamak/i, 'Indian'], [/thai|tom\s*yam/i, 'Thai'],
  [/western/i, 'Western'], [/malay|kampung/i, 'Malay'],
];

export function parseIntent(raw: string): FoodPlanningIntent {
  const text = raw.toLowerCase();
  const intent: FoodPlanningIntent = { ingredients: [], raw };

  // Budget: "RM30", "rm 25.50", "30 ringgit"
  const budget = text.match(/rm\s*(\d+(?:\.\d+)?)/) ?? text.match(/(\d+(?:\.\d+)?)\s*ringgit/);
  if (budget) intent.budget = parseFloat(budget[1]);

  // Servings: "5 people", "feed 6", "6 pax", "4 orang", "for 8"
  const servings =
    text.match(/(\d+)\s*(?:people|pax|persons?|orang)/) ??
    text.match(/feed\s*(\d+)/) ??
    text.match(/for\s+(\d+)(?!\s*(?:min|hour|hr|day|rm|ringgit))/);
  if (servings) intent.servings = parseInt(servings[1], 10);

  // Time: "30 min", "1 hour", "quick"
  const mins = text.match(/(\d+)\s*min/);
  const hours = text.match(/(\d+)\s*(?:hour|hr|jam)/);
  if (mins) intent.maxMinutes = parseInt(mins[1], 10);
  else if (hours) intent.maxMinutes = parseInt(hours[1], 10) * 60;
  else if (/\b(quick|fast|cepat)\b/.test(text)) intent.maxMinutes = 30;

  // Expiring
  if (/expir|use.*(soon|first)|going bad|before.*bad/.test(text)) intent.expiring = true;

  // Route: match known route cities
  for (const r of ROUTES) {
    const from = r.from.split(',')[0].toLowerCase();
    const to = r.to.split(',')[0].toLowerCase();
    const fromAlias = from.includes('kuala lumpur') ? '(kl|kuala lumpur)' : from;
    const toAlias = to.includes('george town') ? '(penang|george town)' : to.includes('kota bharu') ? '(kelantan|kota bharu)' : to;
    if (new RegExp(`${fromAlias}.{0,20}(to|→|-|ke)\\s*.{0,10}${toAlias}`).test(text)) {
      intent.routeQuery = r.id;
      break;
    }
  }
  if (!intent.routeQuery && /road trip|trip|travel|jalan/.test(text) && /penang/.test(text)) intent.routeQuery = 'kl-penang';

  // Cuisine
  for (const [re, cuisine] of CUISINE_WORDS) {
    if (re.test(text)) { intent.cuisine = cuisine; break; }
  }

  // Ingredients: aliases first (longest match wins), then full names
  const found = new Set<string>();
  const aliasKeys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  let scan = text;
  for (const key of aliasKeys) {
    const re = new RegExp(`\\b${key}\\b`);
    if (re.test(scan)) {
      found.add(ALIASES[key]);
      scan = scan.replace(re, ' ');
    }
  }
  for (const ing of INGREDIENTS) {
    if (scan.includes(ing.name.toLowerCase())) found.add(ing.id);
    else if (ing.nameMs && scan.includes(ing.nameMs.toLowerCase())) found.add(ing.id);
  }
  intent.ingredients = [...found];

  return intent;
}

/** One-line human summary of what we understood. */
export function describeIntent(i: FoodPlanningIntent): string[] {
  const parts: string[] = [];
  if (i.ingredients.length) parts.push(`${i.ingredients.length} ingredient${i.ingredients.length > 1 ? 's' : ''} noted`);
  if (i.budget != null) parts.push(`budget RM${i.budget}`);
  if (i.servings != null) parts.push(`${i.servings} people`);
  if (i.maxMinutes != null) parts.push(`≤ ${i.maxMinutes} min`);
  if (i.cuisine) parts.push(`${i.cuisine} style`);
  if (i.expiring) parts.push('use expiring items');
  if (i.routeQuery) parts.push('road trip detected');
  return parts;
}
