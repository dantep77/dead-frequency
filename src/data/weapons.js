// Data-driven weapon, calibre, magazine and attachment definitions.
// Adding a weapon = adding an entry here (+ an optional model builder in weaponmodels.js).

export const CALIBERS = {
  '9mm':  { name: '9×19mm',      dmg: 34,  vel: 370, pen: 1.0, noise: 85,  unit: 0.10, pellets: 1, loud: 0.85 },
  '.45':  { name: '.45 ACP',     dmg: 44,  vel: 260, pen: 0.8, noise: 85,  unit: 0.13, pellets: 1, loud: 0.9 },
  '.38':  { name: '.38 Special', dmg: 37,  vel: 290, pen: 0.8, noise: 85,  unit: 0.12, pellets: 1, loud: 0.85 },
  '12ga': { name: '12 gauge 00', dmg: 17,  vel: 400, pen: 0.45, noise: 105, unit: 0.30, pellets: 9, loud: 1.15, spread: 2.1 },
  '5.56': { name: '5.56×45mm',   dmg: 64,  vel: 940, pen: 2.4, noise: 110, unit: 0.15, pellets: 1, loud: 1.1 },
  '.308': { name: '.308 Win',    dmg: 115, vel: 820, pen: 4.0, noise: 120, unit: 0.25, pellets: 1, loud: 1.25 },
};

export const MAGS = {
  m1911: { name: 'M1911 magazine', cal: '.45',  cap: 7,  unit: 1.5 },
  g17:   { name: 'G17 magazine',   cal: '9mm',  cap: 17, unit: 2 },
  m9:    { name: 'M9 magazine',    cal: '9mm',  cap: 15, unit: 2 },
  ar15:  { name: 'AR-15 magazine', cal: '5.56', cap: 30, unit: 3 },
  m40:   { name: 'M40 box magazine', cal: '.308', cap: 5, unit: 2 },
};

export const ATTACHMENTS = {
  reddot:      { name: 'Red dot sight',     slot: 'optic',  unit: 2, zoom: 1 },
  scope4:      { name: '4× rifle scope',    slot: 'optic',  unit: 3, zoom: 4 },
  scope10:     { name: '10× sniper scope',  slot: 'optic',  unit: 4, zoom: 10 },
  light:       { name: 'Weapon light',      slot: 'rail',   unit: 2 },
  laser:       { name: 'Laser sight',       slot: 'rail',   unit: 2 },
  supp_pistol: { name: 'Pistol suppressor', slot: 'muzzle', unit: 3 },
  supp_rifle:  { name: 'Rifle suppressor',  slot: 'muzzle', unit: 4 },
};

// action: pistol | rifle_semi | semi_shotgun | revolver | pump | bolt
// feed:   mag | tube | internal | cyl
// trigger (self-loaders): sa | striker | dasa
// recoil: pitch (deg up per shot), yaw (deg random), back (viewmodel kick m), recover (0..1 fraction that settles back)
// spread: hip / ads in degrees (cone half-angle)
export const WEAPONS = {
  m1911: {
    name: 'M1911A1', desc: 'Single-action .45. Thumb safety locks the slide. Hammer must be cocked.',
    slot: 'sidearm', action: 'pistol', feed: 'mag', cal: '.45', magType: 'm1911',
    trigger: 'sa', extHammer: true, safety: 'manual', safetyNeedsCock: true, safetyLocksSlide: true, slideLock: true,
    recoil: { pitch: 4.2, yaw: 1.3, back: 0.05, recover: 0.6 }, spread: { hip: 3.4, ads: 0.35 }, cycle: 0.11,
    wear: 0.0022, mass: 1.1, attach: { muzzle: ['supp_pistol'] }, unit: 5,
  },
  g17: {
    name: 'G17', desc: 'Striker-fired 9mm. No manual safety. A dry striker needs the slide racked to reset.',
    slot: 'sidearm', action: 'pistol', feed: 'mag', cal: '9mm', magType: 'g17',
    trigger: 'striker', extHammer: false, safety: 'none', slideLock: true,
    recoil: { pitch: 3.0, yaw: 1.1, back: 0.04, recover: 0.65 }, spread: { hip: 3.2, ads: 0.38 }, cycle: 0.09,
    wear: 0.0016, mass: 0.9, attach: { optic: ['reddot'], rail: ['light', 'laser'], muzzle: ['supp_pistol'] }, unit: 5,
  },
  m9: {
    name: 'M9', desc: 'Double/single-action 9mm. The safety lever also drops the hammer.',
    slot: 'sidearm', action: 'pistol', feed: 'mag', cal: '9mm', magType: 'm9',
    trigger: 'dasa', extHammer: true, safety: 'decocker', slideLock: true,
    recoil: { pitch: 2.8, yaw: 1.0, back: 0.04, recover: 0.65 }, spread: { hip: 3.2, ads: 0.36 }, cycle: 0.1,
    wear: 0.0018, mass: 1.0, attach: { rail: ['light', 'laser'], muzzle: ['supp_pistol'] }, unit: 5,
  },
  model10: {
    name: 'Model 10 revolver', desc: 'Double-action .38 with a swing-out cylinder. Six shots. Very little to go wrong.',
    slot: 'sidearm', action: 'revolver', feed: 'cyl', cal: '.38', cap: 6, revolver: 'da',
    recoil: { pitch: 3.6, yaw: 1.0, back: 0.035, recover: 0.6 }, spread: { hip: 3.3, ads: 0.34 }, cycle: 0.22,
    wear: 0.0012, mass: 0.95, attach: {}, unit: 5, malfScale: 0.35,
  },
  saa: {
    name: 'Single Action Army', desc: 'Single-action .38 revolver. Loads one chamber at a time through a gate at half-cock.',
    slot: 'sidearm', action: 'revolver', feed: 'cyl', cal: '.38', cap: 6, revolver: 'sa',
    recoil: { pitch: 4.4, yaw: 0.9, back: 0.035, recover: 0.5 }, spread: { hip: 3.6, ads: 0.33 }, cycle: 0.2,
    wear: 0.0010, mass: 1.05, attach: {}, unit: 5, malfScale: 0.3,
  },
  r870: {
    name: 'Model 870', desc: 'Pump-action 12 gauge. The action locks when cocked; use the action release to open it.',
    slot: 'primary', action: 'pump', feed: 'tube', cal: '12ga', cap: 5, safety: 'manual',
    recoil: { pitch: 8.5, yaw: 2.4, back: 0.11, recover: 0.55 }, spread: { hip: 2.6, ads: 0.6 }, cycle: 0.2,
    wear: 0.0020, mass: 3.4, attach: { optic: ['reddot'], rail: ['light', 'laser'] }, unit: 12, malfScale: 0.5, long: true,
  },
  m1014: {
    name: 'M1014', desc: 'Gas-operated semi-automatic 12 gauge. Bolt locks open when the tube runs dry.',
    slot: 'primary', action: 'semi_shotgun', feed: 'tube', cal: '12ga', cap: 6,
    trigger: 'sa', extHammer: false, safety: 'manual', slideLock: true,
    recoil: { pitch: 7.0, yaw: 2.2, back: 0.09, recover: 0.6 }, spread: { hip: 2.6, ads: 0.6 }, cycle: 0.16,
    wear: 0.0030, mass: 3.8, attach: { optic: ['reddot'], rail: ['light', 'laser'] }, unit: 12, long: true,
  },
  ar15: {
    name: 'AR-15', desc: 'Semi-automatic 5.56 rifle. Charging handle, bolt catch, selector only moves to SAFE when cocked.',
    slot: 'primary', action: 'rifle_semi', feed: 'mag', cal: '5.56', magType: 'ar15',
    trigger: 'sa', extHammer: false, safety: 'manual', safetyNeedsCock: true, slideLock: true,
    recoil: { pitch: 2.4, yaw: 0.9, back: 0.035, recover: 0.7 }, spread: { hip: 2.8, ads: 0.12 }, cycle: 0.085,
    wear: 0.0020, mass: 3.2, attach: { optic: ['reddot', 'scope4'], rail: ['light', 'laser'], muzzle: ['supp_rifle'] }, unit: 12, long: true,
  },
  model70: {
    name: 'Model 70', desc: 'Bolt-action .308 hunting rifle. Five-round internal magazine, loaded through the open action.',
    slot: 'primary', action: 'bolt', feed: 'internal', cal: '.308', cap: 5, safety: 'manual',
    recoil: { pitch: 7.5, yaw: 1.4, back: 0.09, recover: 0.5 }, spread: { hip: 3.0, ads: 0.07 }, cycle: 0.3,
    wear: 0.0014, mass: 3.6, attach: { optic: ['scope4', 'scope10'] }, unit: 12, malfScale: 0.4, long: true,
  },
  m40: {
    name: 'M40A5', desc: 'Heavy-barrel .308 sniper rifle. Bolt action fed from a detachable five-round box.',
    slot: 'primary', action: 'bolt', feed: 'mag', cal: '.308', magType: 'm40', safety: 'manual',
    recoil: { pitch: 5.5, yaw: 1.0, back: 0.08, recover: 0.55 }, spread: { hip: 3.6, ads: 0.035 }, cycle: 0.3,
    wear: 0.0012, mass: 6.0, attach: { optic: ['scope10', 'scope4'], muzzle: ['supp_rifle'] }, unit: 14, malfScale: 0.4, long: true, noIrons: true,
  },
};

export const SIDEARMS = Object.keys(WEAPONS).filter(k => WEAPONS[k].slot === 'sidearm');
export const PRIMARIES = Object.keys(WEAPONS).filter(k => WEAPONS[k].slot === 'primary');
