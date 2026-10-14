// P6: starter packs. Words only, no prices. Each pack gives a scope, inclusions, exclusions and suggested lines.
// Square brackets [like this] mark the words the person must replace. Everything stays editable.
import { has } from '../../app/js/format.js';

const L = (...lines) => lines.join('\n');

/** The lines under each pack are the same job names as on the Line Items tab. */
const LABOUR = { Electrician: 'Labour - licensed electrician', Plumber: 'Labour - licensed plumber' };
const MATERIALS = 'Materials at cost plus markup';
const E_CERT = 'Compliance paperwork and test results (where required in your state)';
const P_CERT = 'Permit, inspection or compliance paperwork (where required in your state)';

const WIRING = 'Work carried out in line with the Wiring Rules (AS/NZS 3000) where they apply.';
const CERT = 'Compliance certificate or test results where required in your state.';
const TESTING = 'Testing of the completed work.';
const RUBBISH = 'Removal of our own rubbish from site.';
const UNSAFE = 'Repairs to existing work found to be unsafe or non-compliant (quoted separately as a variation).';
const ASBESTOS = 'Asbestos identification, testing or removal.';
const MAKE_GOOD = 'Painting, plastering and making good after the work (by others).';
const SUPPLIED = 'Items supplied by the customer (no warranty on supplied items).';
const HIDDEN = 'Hidden problems found during the work (quoted separately as a variation).';

/** @typedef {{ id: string, name: string, scope: string, inclusions: string, exclusions: string, lines: string[] }} Pack */

/** @type {Record<string, Pack[]>} */
export const PACKS = {
  Electrician: [
    {
      id: 'e-power-lights', name: 'Power points and lighting',
      scope: 'Supply and install [number] double power points and [number] LED downlights at [address or rooms], including connection to the existing circuits.',
      inclusions: L('Labour and materials as listed.', TESTING, CERT, WIRING, RUBBISH),
      exclusions: L('Painting, plastering and making good after cable runs (by others).', 'New circuits or switchboard changes, unless listed above.', UNSAFE, ASBESTOS),
      lines: [LABOUR.Electrician, 'Supply and install double power point (GPO)', 'Supply and install LED downlight', MATERIALS, E_CERT],
    },
    {
      id: 'e-switchboard', name: 'Switchboard upgrade',
      scope: 'Replace the existing switchboard at [address] with a new switchboard fitted with [number] circuit breakers and safety switches (RCDs), and reconnect the existing circuits.',
      inclusions: L('Labour and materials as listed.', 'Safety switches (RCDs) as listed.', 'Testing of every reconnected circuit.', CERT, 'Labelling of the circuits.', 'Removal of the old switchboard and our own rubbish.', 'Planned power outage on [date and time], about [number] hours.'),
      exclusions: L('Electricity network provider work, fees or approvals, unless listed above.', 'Painting, plastering and making good around the switchboard (by others).', UNSAFE, 'Asbestos identification, testing or removal (older switchboards can contain asbestos).'),
      lines: ['Switchboard upgrade (supply and install)', 'Supply and install safety switch (RCD)', LABOUR.Electrician, MATERIALS, E_CERT],
    },
    {
      id: 'e-smoke', name: 'Smoke alarms',
      scope: "Supply and install [number] interconnected smoke alarms at [address], placed where your state's rules and the manufacturer's instructions require.",
      inclusions: L('Labour and materials as listed.', 'Testing of every alarm after installation.', 'A short handover on how to test the alarms.', CERT),
      exclusions: L('Painting, plastering and making good (by others).', 'Running new cabling through areas that cannot be safely reached, unless listed above.', 'Any work not listed in the scope above.'),
      lines: ['Supply and install interconnected smoke alarm', LABOUR.Electrician, E_CERT],
    },
    {
      id: 'e-fan', name: 'Ceiling fan',
      scope: 'Supply and install [number] ceiling fan(s) at [rooms], including the fan, the wall control and connection to the existing circuit.',
      inclusions: L('Labour and materials as listed.', 'Testing after installation.', RUBBISH),
      exclusions: L('Strengthening or changing the ceiling or roof structure.', MAKE_GOOD, 'Fans or fittings supplied by the customer (no warranty on supplied items).', 'New circuits, unless listed above.'),
      lines: ['Supply and install ceiling fan', LABOUR.Electrician, MATERIALS],
    },
    {
      id: 'e-ev', name: 'EV charger',
      scope: 'Supply and install one [brand and model] electric vehicle charger at [location], including cabling from the switchboard, a dedicated protective device and testing.',
      inclusions: L('Labour and materials as listed.', 'Testing and commissioning.', CERT, 'A short handover on how to use the charger.'),
      exclusions: L('Electricity network provider approvals, fees or upgrades, unless listed above.', 'Switchboard upgrades, unless listed above.', 'Trenching, concrete cutting and reinstatement, unless listed above.', 'A charger supplied by the customer (no warranty on supplied items).'),
      lines: ['EV charger installation (supply and install)', LABOUR.Electrician, MATERIALS, E_CERT],
    },
    {
      id: 'e-fault', name: 'Fault finding and repair',
      scope: 'Attend [address] to find the cause of [describe the fault, for example no power in the kitchen] and repair it where the repair is described below.',
      inclusions: L('The call-out and first look.', 'Testing to find the fault.', 'A written note of what was found.', 'Repairs described in this quote.'),
      exclusions: L('Repairs not described in this quote (quoted separately before the work).', 'Painting, plastering and making good after opening walls or ceilings.', 'Faults caused by appliances or fittings supplied by the customer.', ASBESTOS),
      lines: ['Call-out fee (standard hours)', 'Fault finding and diagnosis', LABOUR.Electrician, MATERIALS],
    },
    {
      id: 'e-data', name: 'Data, TV and antenna points',
      scope: 'Supply and install [number] data, TV or antenna points at [rooms], with cabling from [location] and wall plates.',
      inclusions: L('Labour and materials as listed.', 'Testing of each point.', RUBBISH),
      exclusions: L('Modems, routers, network equipment and set-top boxes.', MAKE_GOOD, 'Cabling through areas that cannot be safely reached, unless listed above.'),
      lines: ['Data, TV or antenna point', LABOUR.Electrician, MATERIALS],
    },
    {
      id: 'e-testtag', name: 'Test and tag',
      scope: 'Test and tag the portable electrical appliances at [address or business], and give you a record of the results.',
      inclusions: L('A visual check and test of each item.', 'A tag on each item that passes.', 'A record of the results for your files.', 'Failed items taken out of use, with your agreement.'),
      exclusions: L('Repairs to items that fail.', 'Items that cannot be reached or switched off safely on the day.', 'Permanently wired equipment, unless listed above.'),
      lines: ['Test and tag (portable appliances)', 'Travel or mobilisation'],
    },
    {
      id: 'e-rewire', name: 'Rewire (house or rooms)',
      scope: 'Rewire [the whole house, or describe the areas] at [address], including new cabling, power points, lights and switches, and a new or upgraded switchboard where listed.',
      inclusions: L('Labour and materials as listed.', TESTING, CERT, WIRING, RUBBISH),
      exclusions: L('Cutting into and making good plaster, brick, tiles and paint (by others).', 'Electricity network provider work, fees or approvals, unless listed above.', ASBESTOS, HIDDEN),
      lines: [LABOUR.Electrician, MATERIALS, 'Switchboard upgrade (supply and install)', E_CERT],
    },
  ],
  Plumber: [
    {
      id: 'p-tap', name: 'Tap or mixer replacement',
      scope: 'Supply and install [number] new mixer tap(s) at [location], including new flexible hoses and isolation valves where needed.',
      inclusions: L('Labour and materials as listed.', 'Testing for leaks after installation.', 'Removal of the old tap and our own rubbish.'),
      exclusions: L('Repairs to damaged benchtops, basins or tiles.', 'Taps or fittings supplied by the customer (no warranty on supplied items).', 'Hidden problems found during the work, such as corroded or damaged pipes (quoted separately as a variation).'),
      lines: ['Supply and install mixer tap', 'Replace flexible hoses or isolation valves', LABOUR.Plumber],
    },
    {
      id: 'p-toilet', name: 'Toilet replacement',
      scope: 'Remove the existing toilet suite at [location] and supply and install a new [brand and model] suite, connected to the existing waste and water supply.',
      inclusions: L('Labour and materials as listed.', 'A new flexible hose and connection kit.', 'Testing for leaks after installation.', 'Removal of the old suite and our own rubbish.'),
      exclusions: L('Tiling, flooring and painting make-good (by others).', 'Repairs to damaged pipes, flanges or floors found during the work (quoted separately as a variation).', 'A suite supplied by the customer (no warranty on supplied items).'),
      lines: ['Replace toilet suite (supply and install)', 'Replace flexible hoses or isolation valves', LABOUR.Plumber],
    },
    {
      id: 'p-hws', name: 'Hot water system replacement',
      scope: 'Remove the existing hot water system at [address] and supply and install a new [brand, model and size] hot water system, connected to the existing water supply [and gas or power].',
      inclusions: L('Labour and materials as listed.', 'Removal and disposal of the old system.', 'Relief and tempering valves as required.', 'Testing and commissioning.', 'Permit, inspection or compliance paperwork where required in your state.', 'A short handover on the controls.'),
      exclusions: L('Electrical or gas work by other trades, unless listed above.', 'New bases, enclosures or stands, unless listed above.', 'Repairs to pipes or fittings found in poor condition (quoted separately as a variation).', 'Painting and making good.'),
      lines: ['Hot water system (supply and install)', 'Remove and dispose of old hot water system', 'Pressure limiting or tempering valve (supply and install)', LABOUR.Plumber, P_CERT],
    },
    {
      id: 'p-drain', name: 'Blocked drain',
      scope: 'Attend [address] to clear the blocked [drain, sewer or stormwater line] at [location] and check it with a camera where listed.',
      inclusions: L('The call-out and first look.', 'Clearing the blockage using [method].', 'A camera inspection afterwards, where listed.', 'A written note of what was found.'),
      exclusions: L('Repairs to broken, collapsed or root-damaged pipes (quoted separately).', 'Excavation, concrete cutting and reinstatement.', "Work on the authority's main or street connection."),
      lines: ['Call-out fee (standard hours)', 'Clear blocked drain', 'Drain camera inspection', LABOUR.Plumber],
    },
    {
      id: 'p-leak', name: 'Leak detection and repair',
      scope: 'Find the source of the leak at [location] and repair it where the repair is described below.',
      inclusions: L('The call-out and first look.', 'Leak detection using [method].', 'A written note of where the leak was and why.', 'Repairs described in this quote.'),
      exclusions: L('Cutting into and making good walls, floors and ceilings (by others).', 'Water damage repairs, drying and mould treatment.', 'Repairs not described in this quote (quoted separately before the work).'),
      lines: ['Leak detection', LABOUR.Plumber, MATERIALS],
    },
    {
      id: 'p-gas', name: 'Gas fitting',
      scope: 'Supply and install [describe the gas work, for example a new gas cooktop connection] at [address].',
      inclusions: L('Labour and materials as listed.', 'Gas leak testing and commissioning.', 'Compliance certificate or paperwork where required in your state.', 'Work carried out in line with the relevant gas installation standard (for example AS/NZS 5601) where it applies.'),
      exclusions: L('Electrical work and cabinetry changes by other trades.', SUPPLIED, 'Repairs to existing gas lines found to be unsafe or non-compliant (quoted separately as a variation).', 'Painting and making good.'),
      lines: ['Gas fitting work (licensed gasfitter only)', MATERIALS, P_CERT],
    },
    {
      id: 'p-reno', name: 'Renovation rough-in and fit-off',
      scope: 'Rough-in and fit-off of the plumbing for the [bathroom, kitchen or laundry] at [address], as described in [plans or scope].',
      inclusions: L('Labour and materials as listed.', 'Pressure testing of the new pipework.', 'Permit, inspection or compliance paperwork where required in your state.', 'Work carried out in line with the plumbing standard (AS/NZS 3500) where it applies.', RUBBISH),
      exclusions: L('Tiling, waterproofing, carpentry, painting and cabinetry (by others).', 'Fixtures and fittings not listed above.', 'Concrete cutting, excavation and reinstatement.', HIDDEN),
      lines: [LABOUR.Plumber, MATERIALS, P_CERT],
    },
    {
      id: 'p-emergency', name: 'Emergency call-out',
      scope: 'Attend [address] after hours to deal with [describe the problem, for example a burst pipe], make it safe and repair it where the repair is described below.',
      inclusions: L('The after-hours call-out.', 'Making the problem safe.', 'Repairs described in this quote.', 'A written note of what was done.'),
      exclusions: L('Repairs not described in this quote (quoted separately before the work).', 'Water damage repairs, drying and mould treatment.', 'Painting and making good.'),
      lines: ['After-hours or emergency call-out fee', LABOUR.Plumber, MATERIALS],
    },
  ],
};

/** The packs for a trade. "Other" has none. */
export const packsFor = (trade) => PACKS[trade] || [];

/** True when text still has words in [square brackets] to replace. */
export const hasPlaceholder = (text) => /\[[^\]\n]+\]/.test(String(text ?? ''));

/**
 * What filling a pack would do. It only fills boxes that are empty, so nothing the person typed is lost.
 * @param {Pack} pack
 * @param {Record<string, any>} cur  scope, incl, excl, rows, and d1.. q1.. p1.. for each row
 */
export function fillPlan(pack, cur) {
  /** @type {Record<string, string>} */
  const set = {};
  const filled = [];
  const kept = [];
  for (const [key, label, text] of [['scope', 'scope of work', pack.scope], ['incl', 'inclusions', pack.inclusions], ['excl', 'exclusions', pack.exclusions]]) {
    if (has(cur[key])) kept.push(label);
    else {
      set[key] = text;
      filled.push(label);
    }
  }
  const free = [];
  const have = new Set();
  for (let i = 1; i <= (cur.rows || 0); i++) {
    if (has(cur['d' + i])) have.add(String(cur['d' + i]).trim());
    if (!has(cur['d' + i]) && !has(cur['q' + i]) && !has(cur['p' + i])) free.push(i);
  }
  let linesAdded = 0;
  let linesSkipped = 0;
  for (const line of pack.lines) {
    if (have.has(line)) continue;
    if (linesAdded >= free.length) linesSkipped++;
    else set['d' + free[linesAdded++]] = line;
  }
  return { set, filled, kept, linesAdded, linesSkipped };
}
