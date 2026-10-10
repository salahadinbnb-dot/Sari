// What the viewer is told, and when (sim time windows + freeze tags).
export const STEPS = ['READ', 'TEST', 'CHECKPOINT', 'SCREEN', 'READ HELP'];

export const CAPTIONS = [
  { from: 0.0, to: 1.25, step: 0, title: 'THE CATCH', text: 'Defender already square, <b>arm’s length</b> away. Help waits at the rim.' },
  { from: 1.25, to: 2.72, step: 1, title: 'READ HIM FIRST', text: 'No cushion to shoot. <b>No closeout</b> to attack.' },
  { from: 2.72, to: 4.3, step: 1, title: 'READ HIM FIRST', text: 'Your jab gets <b>no reaction</b> — it never guarantees one.' },
  { from: 4.3, to: 5.47, step: 2, title: 'TEST THE RIGHT SIDE', text: 'Dribble into the <b>space beside him</b> — not into his chest.' },
  { from: 5.47, to: 7.12, step: 3, title: 'CHECKPOINT', text: '2 dribbles, no ground gained → <b>back out</b>, ball alive.' },
  { from: 7.12, to: 8.6, step: 4, title: 'GET A SCREEN', text: 'Don’t go until your screener is <b>set</b>.' },
  { from: 8.6, to: 9.51, step: 4, title: 'USE THE SCREEN', text: '<b>Shoulder to shoulder</b> — a wide loop lets him slide through.' },
  { from: 9.51, to: 9.99, step: 5, title: 'READ THE HELP', text: 'Find the next defender <b>before</b> you gather.' },
  { from: 9.99, to: 11.9, step: 5, title: 'READ THE HELP', text: 'He stepped up → <b>hit the man he left</b>.' },
];

export const VERDICTS = {
  notbeaten: { word: 'NOT BEATEN', color: 'red', line1: 'His chest is still in your path to the rim.', line2: 'Opening = his torso <b>beside or behind your left shoulder</b>.' },
  opening: { word: 'OPENING', color: 'green', line1: 'He’s chasing — <b>behind your left side</b>.', line2: 'Ball on your right. Keep going.' },
  help: { word: 'HELP STEPS UP', color: 'amber', line1: 'He left the roller.', line2: '<b>Pass now</b> — before you gather.' },
};

// floating labels: [name, text, color, from, to]
export const TAGS = [
  // name, text, color, from, to, label offset in px (dx, dy) from the head anchor
  ['d1', 'YOUR DEFENDER', 'red', 0.0, 5.47, 170, -95],
  ['d2', 'HELP', 'amber', 0.0, 4.3, -120, -70],
  ['screener', 'SCREENER', 'blue', 6.1, 9.2, -150, -80],
  ['d1', 'DEFENDER', 'red', 8.7, 9.9, -170, -80],
  ['d2', 'HELP', 'amber', 9.51, 10.5, 150, -85],
  ['screener', 'ROLLER', 'blue', 9.51, 10.9, -150, -80],
];
