// v2 (1v1): what the viewer is told, and when (sim-time windows, freeze verdicts, player tags).
export const STEPS = ['READ', 'TEST', 'CHECKPOINT', 'ATTACK', 'FINISH'];

export const CAPTIONS = [
  { from: 0.0, to: 1.15, step: 0, title: 'THE CATCH', text: 'He’s already <b>square</b> — an arm’s length away.' },
  { from: 1.15, to: 2.35, step: 1, title: 'READ HIM FIRST', text: 'Sagging → shoot. Closing out → attack. <b>Balanced</b> → neither yet.' },
  { from: 2.35, to: 2.86, step: 1, title: 'READ HIM FIRST', text: 'Ball fake — <b>no reaction</b>. It never guarantees one.' },
  { from: 2.86, to: 3.34, step: 2, title: 'TEST THE RIGHT SIDE', text: 'Right hand, into the <b>space beside him</b> — not his chest.' },
  { from: 3.34, to: 4.4, step: 3, title: 'CHECKPOINT', text: '1–2 dribbles, no ground gained → <b>back out</b> diagonally. Ball alive.' },
  { from: 4.4, to: 5.6, step: 3, title: 'STAY LIVE', text: 'Dribble alive, eyes up. <b>Read him again.</b>' },
  { from: 5.6, to: 5.93, step: 4, title: 'ATTACK THE CLOSEOUT', text: 'Here he comes…' },
  { from: 5.93, to: 6.89, step: 4, title: 'ATTACK THE CLOSEOUT', text: 'Go <b>while he’s still coming</b> — before he’s balanced.' },
  { from: 6.89, to: 8.45, step: 5, title: 'FINISH', text: 'Read the next defender before you collect — <b>nobody home</b>.' },
  { from: 8.45, to: 10.05, step: 5, title: 'FINISH', text: 'Collect close enough to finish — <b>right side of the rim</b>.' },
];

export const VERDICTS = {
  notbeaten: { word: 'NOT BEATEN', color: 'red', line1: 'His chest is still in your path to the rim.', line2: 'Opening = his torso <b>beside or behind your left shoulder</b>.' },
  closeout: { word: 'HE’S CLOSING OUT', color: 'amber', line1: 'All that momentum — <b>he can’t change direction</b>.', line2: 'Attack now, <b>before he’s balanced</b>.' },
  opening: { word: 'OPENING', color: 'green', line1: 'His torso is <b>behind your left shoulder</b>.', line2: 'Ball on your right. Keep going.' },
};
// step highlighted during each freeze
export const FREEZE_STEP = { setup: 1, notbeaten: 2, closeout: 4, opening: 4 };

// name, text, color, from, to, label offset in px (dx, dy) from the head anchor
export const TAGS = [
  ['d1', 'YOUR DEFENDER', 'red', 0.0, 3.34, 170, -95],
  ['d1', 'YOUR DEFENDER', 'red', 4.4, 5.62, 170, -95],
];

export const TITLE = `<div class="kick">ONE POSSESSION · 1-ON-1</div><div class="big">YOU vs. THE<br>SQUARE DEFENDER</div><div class="sub">Behind-the-player POV · read it like the pros</div>`;
export const END = `<div class="big">YOUR DRIVE IS A <span>TEST</span>,<br>NOT A COMMITMENT.</div><div class="sub">Read → Test → Checkpoint → Attack → Finish</div>`;
export const SCORE_AT = 9.9;   // ball through the net (sim time)
export const END_AT = 10.2;    // end card fades in
export const LABELS = ['space', 'arm', 'check', 'go', 'ghost', 'finish'];
