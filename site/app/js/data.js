// Words and lists that appear in the app. Edit text here, not inside the screens.

export const TABS = ['Start Here', 'My Details', 'Quote', 'Tax Invoice', 'Invoice', 'Variation', 'Rate Calculator', 'Line Items', 'Worked Examples'];

/** Tabs that make a finished document (they get Preview and Save as PDF). */
export const DOC_TABS = ['Quote', 'Tax Invoice', 'Invoice', 'Variation'];

export const FOOT = 'General template for administrative and educational use only. Not legal, tax or WHS advice. Adapt to your business and each job. Have your SWMS reviewed by a qualified WHS professional before use.';

export const PRIVACY = 'Your details stay on this device. Nothing you type is sent to anyone.';

export const ATO_STAMP = 'The Tax Invoice tab covers the 7 details the ATO lists for tax invoices, plus the extra buyer name or ABN for sales of $1,000 or more. Checked against the ATO "Tax invoices" page (ato.gov.au), last updated 18 September 2026. Not approved or endorsed by the ATO. Rules change, so check the ATO page for anything new.';

export const TRADES = ['Electrician', 'Plumber', 'Other'];

/** Job suggestions for the Description boxes, by trade. Prices are blank on purpose. */
export const LISTS = {
  Electrician: [
    'Labour - licensed electrician',
    'Labour - apprentice',
    'Call-out fee (standard hours)',
    'After-hours or emergency call-out fee',
    'Fault finding and diagnosis',
    'Supply and install double power point (GPO)',
    'Supply and install LED downlight',
    'Supply and install ceiling fan',
    'Supply and install interconnected smoke alarm',
    'Supply and install safety switch (RCD)',
    'Switchboard upgrade (supply and install)',
    'EV charger installation (supply and install)',
    'Data, TV or antenna point',
    'Test and tag (portable appliances)',
    'Materials at cost plus markup',
    'Travel or mobilisation',
    'Compliance paperwork and test results (where required in your state)',
  ],
  Plumber: [
    'Labour - licensed plumber',
    'Labour - apprentice',
    'Call-out fee (standard hours)',
    'After-hours or emergency call-out fee',
    'Leak detection',
    'Supply and install mixer tap',
    'Replace toilet suite (supply and install)',
    'Hot water system (supply and install)',
    'Remove and dispose of old hot water system',
    'Clear blocked drain',
    'Drain camera inspection',
    'Replace flexible hoses or isolation valves',
    'Pressure limiting or tempering valve (supply and install)',
    'Gas fitting work (licensed gasfitter only)',
    'Materials at cost plus markup',
    'Travel or mobilisation',
    'Permit, inspection or compliance paperwork (where required in your state)',
  ],
  Other: [
    'Labour - tradesperson',
    'Labour - apprentice or offsider',
    'Call-out fee (standard hours)',
    'After-hours or emergency call-out fee',
    'Quote or site inspection fee',
    'Minimum charge (first hour)',
    'Materials at cost plus markup',
    'Materials supply only',
    'Delivery',
    'Equipment or plant hire',
    'Waste removal and tip fees',
    'Site clean-up',
    'Travel or mobilisation',
    'Progress payment - stage 1',
    'Progress payment - stage 2',
    'Permit, inspection or compliance paperwork (where required in your state)',
    'Other work (describe it)',
  ],
};

/** The unit that goes with each suggestion above, in the same order. */
export const UNITS = {
  Electrician: [
    'hour',
    'hour',
    'each',
    'each',
    'hour',
    'each',
    'each',
    'each',
    'each',
    'each',
    'job',
    'job',
    'each',
    'item',
    'lot',
    'each',
    'job',
  ],
  Plumber: [
    'hour',
    'hour',
    'each',
    'each',
    'hour',
    'each',
    'each',
    'each',
    'each',
    'job',
    'job',
    'each',
    'each',
    'hour',
    'lot',
    'each',
    'job',
  ],
  Other: [
    'hour',
    'hour',
    'each',
    'each',
    'each',
    'each',
    'lot',
    'lot',
    'each',
    'day',
    'lot',
    'each',
    'each',
    'stage',
    'stage',
    'job',
    'job',
  ],
};

/** Suggested exclusions for a Quote, by trade. */
export const EXCLUSIONS = {
  Electrician: [
    'Painting, plastering and making good after cable runs (by others).',
    'Asbestos identification, testing or removal.',
    'Repairs to existing wiring found to be unsafe or non-compliant (quoted separately as a variation).',
    'Network provider and council fees, unless listed in this quote.',
    'Work in roof, wall or floor spaces that cannot be safely reached.',
    'Fittings or appliances supplied by the customer (no warranty on supplied items).',
    'Any work not listed in the scope above.',
  ],
  Plumber: [
    'Tiling, plastering, painting and carpentry make-good (by others).',
    'Concrete cutting, excavation and reinstatement.',
    'Asbestos identification, testing or removal.',
    'Hidden or concealed problems found during the work, such as corroded or damaged pipes (quoted separately as a variation).',
    'Permit, inspection and authority fees, unless listed in this quote.',
    'Damage caused by tree roots or ground movement.',
    'Fittings or fixtures supplied by the customer (no warranty on supplied items).',
  ],
  Other: [
    'Painting, plastering and making good (by others).',
    'Asbestos identification, testing or removal.',
    'Hidden or concealed problems found during the work (quoted separately as a variation).',
    'Permit, inspection and authority fees, unless listed in this quote.',
    'Work that cannot be safely reached.',
    'Items supplied by the customer (no warranty on supplied items).',
    'Any work not listed in the scope above.',
  ],
};

const MARKUP = 'Pick your markup on the Rate Calculator tab.';
const MAIN_RATE = 'Your main hourly rate. See the Rate Calculator tab.';
const CALL_OUT = 'Covers travel and the first look.';
const AFTER_HOURS = 'Say your after-hours times on the quote.';
const STATE_RULES = 'Check your state rules for where they are required.';
const NAMES_DIFFER = 'Names and rules differ by state.';

/** Small hints under a suggestion on the Line Items tab. The number is the position in LISTS. */
export const NOTES = {
  Electrician: { 0: MAIN_RATE, 2: CALL_OUT, 3: AFTER_HOURS, 8: STATE_RULES, 10: 'List what is included and what is not.', 14: MARKUP, 16: 'Certificate names and rules differ by state.' },
  Plumber: { 0: MAIN_RATE, 2: CALL_OUT, 3: AFTER_HOURS, 7: 'List the model and size.', 12: STATE_RULES, 13: 'Only if you hold the licence.', 14: MARKUP, 16: NAMES_DIFFER },
  Other: { 0: MAIN_RATE, 2: CALL_OUT, 3: AFTER_HOURS, 4: 'Say if it is credited back when the job goes ahead.', 6: MARKUP, 13: 'Describe what the stage covers.', 15: NAMES_DIFFER },
};

/** Starting values for boxes the person has not touched yet. */
export const DEFAULTS = {
  D: { gst: 'Yes', trade: 'Electrician', terms: '7', rate: '10' },
  'Rate Calculator': { wage: '$90,000.00', costs: '$25,000.00', weeks: '46', hrs: '25', part: '$120.00', mk: '30' },
  Variation: { pay: 'Added to the final invoice', prev: '$0.00' },
};

export const PRICE_TYPES = ['Fixed price', 'Estimate (final price based on actual hours and materials)'];
/** True when the Price type box says Estimate. */
export const isEstimate = (v) => String(v ?? '').startsWith('Estimate');
export const WHY_OPTIONS = ['Customer asked for it', 'Hidden problem found', 'Rule or compliance change', 'Material or supplier change', 'Other'];
export const MARKUPS = [10, 15, 20, 25, 30, 40, 50];
