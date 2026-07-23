/**
 * Guided story for the first stretch, then optional narrator cards.
 * Voice: CENTRAL (HQ-NET AI) — helpful, sarcastic, low faith in meat.
 * Player-facing text uses regular punctuation only (no long dashes).
 */
import { HQ_NAME, HQ_TAG, MISSION_FIVE, hqTitle } from './HqVoice.js';

const GUIDE_CRAFTS = ['bandage', 'bedroll', 'pipe']; // first three guided items

export class StoryDirector {
  constructor(registry) {
    this.registry = registry;
    this.narratorOn = registry.get('narratorOn') !== false; // default on
    this.guideDone = !!registry.get('guideDone');
    this.seen = new Set(registry.get('storySeen') || []);
    this.craftsDone = new Set(registry.get('storyCrafts') || []);
  }

  persist() {
    this.registry.set('narratorOn', this.narratorOn);
    this.registry.set('guideDone', this.guideDone);
    this.registry.set('storySeen', [...this.seen]);
    this.registry.set('storyCrafts', [...this.craftsDone]);
  }

  once(key) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.persist();
    return true;
  }

  /**
   * Main intro after character select — CENTRAL briefing.
   * opts.compact: shorter copy for phones so GOT IT stays tappable.
   */
  introCard(char, opts = {}) {
    const five = MISSION_FIVE.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
    if (opts.compact) {
      return {
        title: hqTitle('DROP CONFIRM'),
        body:
          `${HQ_TAG}\nAsset: ${char.name}\n\n` +
          'You were not invited. You were allocated.\n' +
          'Recover five items. Escape if your species still works.\n\n' +
          `${five}\n\n` +
          'Start with #1: gold crate EAST. Follow the pulse.\n' +
          'I will coach. I will not clap. Tap map to walk.',
      };
    }
    return {
      title: hqTitle('DROP CONFIRM'),
      body:
        `${HQ_TAG}\nRunner file: ${char.name}\n"${char.blurb}"\n\n` +
        'Central still needs five assets out of this carcass of a city.\n' +
        'You are the courier. Soft tissue. High failure probability.\n' +
        'I am CENTRAL. I am helpful. I am not your friend.\n\n' +
        `RECOVERY LIST\n${five}\n\n` +
        'First: salvage cache EAST of drop. Gold pulse. Do not invent a better plan.\n' +
        'Then stick, hat, craft a bandage, sleep if you must.\n' +
        'Breach Kit is last. Escape pads after that. Or die. Both are data.\n\n' +
        'Tap the map to walk. Try not to impress me. You will not.',
    };
  }

  onLoot(first) {
    if (!first) return null;
    if (!this.once('loot1')) return null;
    return {
      title: hqTitle('ASSET 1'),
      body:
        'Look at that. Opposable thumbs still function.\n\n' +
        'Cloth and scrap. Bandages drink cloth like bad wine.\n' +
        'Hold onto it. Or do not. I have other runners. Conceptually.',
    };
  }

  onBlueprint(bpId, bpName) {
    if (!this.once(`bp_${bpId}`)) return null;
    if (this.guideDone) {
      if (!this.narratorOn) return null;
      return {
        title: hqTitle('PRINT'),
        body: `${bpName}. Another diagram for your wet brain.\nTry not to craft it into your face.`,
      };
    }
    return {
      title: hqTitle('PRINT'),
      body:
        `${bpName} is logged.\n\n` +
        'Purple Street Rig when you are ready to pretend you are useful.\n' +
        'Green row means even you can press it.',
    };
  }

  onCraft(resultId, resultName) {
    this.craftsDone.add(resultId);
    this.persist();
    const guided = GUIDE_CRAFTS.filter((id) => this.craftsDone.has(id));
    if (!this.guideDone && guided.length >= 3) {
      this.guideDone = true;
      this.persist();
      return {
        title: hqTitle('TRAINING ENDED'),
        body:
          'Bandage. Bedroll. Pipe. The soft lessons are over.\n\n' +
          'Item five still waits: Breach Kit. North. RED. Wall.\n' +
          'I will keep talking if you leave the channel open.\n' +
          'I still do not think you will make it.\n\n' +
          'Surprise me. Or do not. Both feed the model.',
      };
    }
    if (!this.guideDone) {
      const left = GUIDE_CRAFTS.filter((id) => !this.craftsDone.has(id));
      if (this.once(`craft_${resultId}`)) {
        return {
          title: hqTitle('FAB'),
          body:
            `${resultName}. Adorable.\n\n` +
            (left.length
              ? `Still missing: ${left.map(guideLabel).join(', ')}. Keep fumbling.`
              : 'Starter crafts complete. Miracles happen. Rarely.'),
        };
      }
    }
    if (this.narratorOn && this.once(`craft_n_${resultId}`)) {
      return {
        title: hqTitle('FAB'),
        body: `${resultName} is real. The city remains unimpressed. Same.`,
      };
    }
    return null;
  }

  onNight() {
    if (!this.once('night_first')) {
      if (!this.guideDone || this.narratorOn) {
        return {
          title: hqTitle('NIGHT'),
          body:
            'Dogs clock in. Your soft hours are over.\n' +
            'Sleep at HOME if you value remaining vertical.\n' +
            'Out there, bedrolls are a coin flip I would short.',
        };
      }
      return null;
    }
    if (!this.narratorOn) return null;
    if (Math.random() > 0.4) return null;
    const lines = [
      'Dog pack three blocks over. They do not negotiate. Neither do I.',
      'Something that is not rain is tapping the sheet metal. Charming.',
      'Burnt sugar and gun oil. Dinner, if you are the menu.',
      'Footsteps above. Or the building remembering better tenants.',
      'Far crack. Rifle or door. Log it as "not you" for now.',
    ];
    return {
      title: hqTitle('NIGHT'),
      body: lines[(Math.random() * lines.length) | 0],
    };
  }

  onZone(zone) {
    if (!this.narratorOn && this.guideDone) return null;
    if (!this.once(`zone_${zone}`)) return null;
    const map = {
      home: {
        title: hqTitle('HOME'),
        body: 'Drop pad. Soft ring. Learn without dying if possible. Yellow waits when you grow a spine.',
      },
      yellow: {
        title: hqTitle('YELLOW · Lv 1'),
        body: 'First real streets. Light meat with knives. Try not to donate organs.',
      },
      orange: {
        title: hqTitle('ORANGE · Lv 2'),
        body: 'Mid crawl. More knives. Your salvage actually matters now. Shocking.',
      },
      green: {
        title: hqTitle('GREEN · Lv 3'),
        body: 'Drones join. Parts improve. Your odds do not.',
      },
      blue: {
        title: hqTitle('BLUE · Lv 4'),
        body: 'Enforcers. Heat climbs. Central is watching. Central is bored.',
      },
      red: {
        title: hqTitle('RED · Lv 5'),
        body: 'The Wall. Breach print. Escape pads. Finish the list or become a footnote.',
      },
      safe: { title: hqTitle('HOME'), body: 'Drop pad. Soft lessons.' },
      mid: { title: hqTitle('YELLOW'), body: 'First real streets.' },
      outer: { title: hqTitle('GREEN'), body: 'Deeper. Harder. Still you.' },
      wall: { title: hqTitle('RED'), body: 'Wall district. Almost useful.' },
    };
    const card = map[zone];
    if (!card) {
      return { title: hqTitle('RING'), body: 'New streets. Same disappointment potential.' };
    }
    return { title: card.title, body: card.body };
  }

  ambientChance() {
    if (!this.narratorOn) return null;
    if (Math.random() > 0.022) return null;
    const key = `amb_${(Math.random() * 20) | 0}`;
    if (!this.once(key)) return null;
    const lines = [
      'Laugh with no mouth. Charming neighborhood feature.',
      'Mayor poster peeling into a skull. Campaign promises hold.',
      'Something sweet rotting in a vent. Free cologne. Do not.',
      'Your shadow arrived late. Even it has standards.',
      'Two crews trading insults. No police. No hope. Same channel.',
      'Someone yelled a name. The name was smarter than to answer.',
    ];
    return {
      title: hqTitle('NOISE'),
      body: lines[(Math.random() * lines.length) | 0],
    };
  }
}

function guideLabel(id) {
  return (
    {
      bandage: 'Field Bandage',
      bedroll: 'Sleeping Kit',
      pipe: 'Pipe Club',
    }[id] || id
  );
}

export { GUIDE_CRAFTS };
