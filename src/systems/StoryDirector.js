/**
 * Guided story for the first stretch, then optional narrator cards.
 * Player-facing text uses regular punctuation only (no long dashes).
 */

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
   * Main intro after character select (single card; quest 1 merged in).
   * opts.compact: shorter copy for phones so GOT IT stays tappable.
   */
  introCard(char, opts = {}) {
    if (opts.compact) {
      return {
        title: 'SIGNAL BOOT',
        body:
          `${char.name}\n\n` +
          'QUEST 1: Follow the gold pulse.\n' +
          'Tap the gold crate EAST of you.\n\n' +
          'Then: stick · hat · BAG · workbench craft · dog · SLEEP.\n' +
          'Tap map to walk.',
      };
    }
    return {
      title: 'SIGNAL BOOT',
      body:
        `${char.name}: "${char.blurb}"\n\n` +
        'The Wall still stands. Dogs own the dark.\n' +
        'Scavenge. Craft. Breach. Get out.\n\n' +
        'QUEST 1: Follow the gold pulse.\n' +
        'Click the gold crate EAST of you.\n\n' +
        'Then: stick south · hat west · BAG equip ·\n' +
        'purple U workbench CRAFT bandage · dog · SLEEP.\n\n' +
        'Click map to walk. Left-click enemies to fight.',
    };
  }

  onLoot(first) {
    if (!first) return null;
    if (!this.once('loot1')) return null;
    return {
      title: 'JUNK IS GOSPEL',
      body:
        'Gold crates spit scrap, cloth, wire, the usual sins.\n\n' +
        'Hold onto cloth. Bandages and bedrolls drink it dry.\n' +
        'Static in the vents laughs. Keep digging.',
    };
  }

  onBlueprint(bpId, bpName) {
    if (!this.once(`bp_${bpId}`)) return null;
    if (this.guideDone) {
      if (!this.narratorOn) return null;
      return {
        title: 'SCHEMATIC PING',
        body: `New print: ${bpName}.\nThe city leaves receipts if you listen.`,
      };
    }
    return {
      title: 'BLUEPRINT ACQUIRED',
      body:
        `${bpName} is now in your head.\n\n` +
        'Track parts if you want a hunt list.\n' +
        'Purple Street Rig is the altar. CRAFT when green.',
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
        title: 'SIGNAL CUTS CLEAN',
        body:
          'Bandage. Bedroll. Pipe.\nYou are no longer a tourist.\n\n' +
          'From here the Wall is your problem.\n' +
          'Narrator cards can keep whispering if you want them.\n' +
          '(Toggle anytime in BAG options later, or keep them on.)\n\n' +
          'You are on your own now. Try not to die funny.',
      };
    }
    if (!this.guideDone) {
      const left = GUIDE_CRAFTS.filter((id) => !this.craftsDone.has(id));
      if (this.once(`craft_${resultId}`)) {
        return {
          title: 'KIT ONLINE',
          body:
            `${resultName} is live.\n\n` +
            (left.length
              ? `Still need: ${left.map(guideLabel).join(', ')}.`
              : 'Starter set complete.'),
        };
      }
    }
    if (this.narratorOn && this.once(`craft_n_${resultId}`)) {
      return {
        title: 'FAB PULSE',
        body: `${resultName} clicks together. The grid pretends not to notice.`,
      };
    }
    return null;
  }

  onNight() {
    if (!this.once('night_first')) {
      if (!this.guideDone || this.narratorOn) {
        return {
          title: 'NIGHT SHIFT',
          body:
            'Neon coughs. Dogs clock in.\n' +
            'Sleep at HQ if you can. Out there, bedrolls roll dice.',
        };
      }
      return null;
    }
    if (!this.narratorOn) return null;
    if (Math.random() > 0.4) return null;
    const lines = [
      'A dog pack argues three blocks over. Nobody owns them.',
      'Rain that is not rain taps the sheet metal.',
      'You smell burnt sugar and gun oil. Dinner, maybe.',
      'Footsteps above. Or the building remembering people.',
      'A far crack. Rifle or door. Same difference out here.',
    ];
    return {
      title: 'NIGHT NOTE',
      body: lines[(Math.random() * lines.length) | 0],
    };
  }

  onZone(zone) {
    if (!this.narratorOn && this.guideDone) return null;
    if (!this.once(`zone_${zone}`)) return null;
    const map = {
      safe: 'Inner blocks still pretend to be neighborhoods.',
      mid: 'Mid sprawl. Ads peel. Alleys keep secrets poorly.',
      outer: 'Outer chaos. The Wall casts a long, cold shadow.',
      wall: 'Wall district. Steel taste on the tongue. Almost free.',
    };
    return {
      title: 'DISTRICT READ',
      body: map[zone] || 'New streets. Same city.',
    };
  }

  ambientChance() {
    if (!this.narratorOn) return null;
    if (Math.random() > 0.022) return null;
    const key = `amb_${(Math.random() * 20) | 0}`;
    if (!this.once(key)) return null;
    const lines = [
      'You catch a laugh with no mouth attached.',
      'A poster of a smiling mayor peels into a skull.',
      'Something sweet rots in a vent. Free perfume.',
      'Your shadow arrives half a second late.',
      'Two crews trade insults across an avenue. No cops coming.',
      'Someone yells a name. The name does not answer.',
    ];
    return {
      title: 'SIGNAL NOISE',
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
