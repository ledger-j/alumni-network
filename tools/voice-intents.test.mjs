#!/usr/bin/env node
/* Jev intent gate: loads voice/intents.json + voice/responses.json and the pure matcher
   from js/uc-voice.js, then checks that sample utterances (en/nl/de) map to the expected
   action and slot, that unknown text does NOT match, and that every action is allow-listed
   and has a spoken confirmation in every language.  Usage: node tools/voice-intents.test.mjs */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url);
const intents = JSON.parse(readFileSync(new URL('voice/intents.json', root), 'utf8'));
const responses = JSON.parse(readFileSync(new URL('voice/responses.json', root), 'utf8'));
const { match, allowed } = require(fileURLToPath(new URL('js/uc-voice.js', root)));

let n = 0; const failed = [];
const check = (label, ok, detail) => { n++; if (!ok) failed.push(label + (detail ? '  [' + detail + ']' : '')); console.log((ok ? '  PASS ' : '  FAIL ') + label + (!ok && detail ? '  [' + detail + ']' : '')); };

const samples = [
  ['go to the map', 'go:map'], ['Show me the map!', 'go:map'], ['ga naar de kaart', 'go:map'], ['Zeige die Karte', 'go:map'],
  ['Öffne die Karte bitte', 'go:map'], ['please open my messages', 'open:messages'], ['open mijn berichten', 'open:messages'],
  ['Öffne meine Nachrichten', 'open:messages'], ['take me to the feed', 'go:feed'], ['ga naar de startpagina', 'go:feed'],
  ['open the network', 'go:network'], ['ga naar het netwerk', 'go:network'], ['Zeige mir das Netzwerk', 'go:network'],
  ['I need a mentor', 'go:mentoring'], ['ik zoek een mentor', 'go:mentoring'], ['Ich suche einen Mentor', 'go:mentoring'],
  ['show upcoming events', 'go:events'], ['ga naar de evenementen', 'go:events'], ['Zeige die Veranstaltungen', 'go:events'],
  ['open the case hub', 'go:pbl-hub'], ['open the job board', 'go:jobs'], ['ik zoek een baan', 'go:jobs'], ['Öffne die Jobbörse', 'go:jobs'],
  ['go to my profile', 'go:profile'], ['ga naar mijn profiel', 'go:profile'], ['what are my benefits', 'go:benefits'],
  ['change my cover photo', 'profile:change-cover'], ['verander mijn omslagfoto', 'profile:change-cover'], ['Ändere mein Titelbild', 'profile:change-cover'],
  ['update my profile picture', 'profile:change-photo'], ['wijzig mijn profielfoto', 'profile:change-photo'],
  ['help', 'help'], ['what can you do?', 'help'], ['Hilfe', 'help'], ['hey Jev', 'open:jev'],
  ['find alumni in Berlin', 'search:network', 'Berlin'], ['Can you find people working at Philips?', 'search:network', 'Philips'],
  ['zoek alumni in Rotterdam', 'search:network', 'Rotterdam'], ['Finde Alumni in München', 'search:network', 'München'],
  ['who works in private equity', 'search:network', 'private equity'],
];
console.log('== voice intents ==');
for (const [text, want, q] of samples) {
  const m = match(text, intents, 'en');
  check(`"${text}" -> ${want}${q ? ' q=' + q : ''}`, !!m && m.action === want && (!q || m.slots.q === q), m ? `${m.action} ${JSON.stringify(m.slots)}` : 'no match');
}
for (const text of ['what is the weather in Maastricht', 'tell me a joke', 'wie heeft de beste koffie', 'mapping is fun', '']) {
  check(`"${text}" does not match locally (goes to Jev)`, match(text, intents, 'en') === null);
}
const langs = intents.languages;
for (const it of intents.intents) {
  check(`intent ${it.id}: action ${it.action} is allow-listed`, intents.allowedActions.includes(it.action));
  check(`intent ${it.id}: patterns in ${langs.join('/')}`, langs.every((l) => (it.patterns[l] || []).length > 0));
  check(`intent ${it.id}: spoken line in ${langs.join('/')}`, langs.every((l) => responses.intents[it.id] && responses.intents[it.id][l]));
}
for (const k of ['fallback', 'error', 'not-supported', 'jev-off']) check(`system line ${k} in every language`, langs.every((l) => responses.system[k] && responses.system[k][l]));
// Jev (server) actions are filtered by the same allow-list
check('Jev action go:map is allowed', allowed('go:map', intents)?.action === 'go:map');
check('Jev action search:network:<q> carries q', allowed('search:network:Berlin', intents)?.slots.q === 'Berlin');
for (const bad of ['go:admin', 'eval:alert(1)', 'open:settings', 'profile:delete', 'javascript:alert(1)', null, 42]) {
  check(`Jev action ${JSON.stringify(bad)} is refused`, allowed(bad, intents) === null);
}
console.log(`checks: ${n}  failed: ${failed.length}`);
console.log('RESULT:', n > 0 && !failed.length ? 'PASS' : 'FAIL');
process.exit(n > 0 && !failed.length ? 0 : 1);
