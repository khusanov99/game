/* model/fork.js — Road fork: every 1000 m a 180 m split. Left = FAST road (+25% speed, dense hazards, few coins),
   right = COIN road (-20% speed, lots of coins). The middle lane is walled off. */
"use strict";
const FORK_CYC = 1000,
  FORK_A = 700,
  FORK_B = 880;
function forkZone(z) {
  const base = Math.floor(z / FORK_CYC) * FORK_CYC,
    a = base + FORK_A,
    b = base + FORK_B;
  for (let z = a - 130; z <= b + 20; z += 30) if (secAt(z) || plazaOf(Math.floor(z / CH)) >= 0) return null;
  if (a < 600) return null;
  return [a, b];
}
const forkAt = (z) => {
  const f = forkZone(z);
  return !!f && z >= f[0] && z < f[1];
};
/* the next fork's start at or ahead of z (for the warning gantry) */
function forkAhead(z) {
  for (let i = 0; i < 2; i++) {
    const f = forkZone(z + i * FORK_CYC);
    if (f && f[0] + 10 > z) return f;
  }
  return null;
}
