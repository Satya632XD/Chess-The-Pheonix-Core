// src/lib/glicko2.js

const Q = Math.log(10) / 400;

function g(phi) {
  return 1 / Math.sqrt(1 + (3 * Q * Q * phi * phi) / (Math.PI * Math.PI));
}

function E(mu, muJ, phiJ) {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

// Convert rating → Glicko scale
function toMu(r) {
  return (r - 1500) / 173.7178;
}

function toRating(mu) {
  return mu * 173.7178 + 1500;
}

export function updateGlicko(player, opponent, score) {
  // player = { rating, rd }
  const mu = toMu(player.rating);
  const phi = player.rd;

  const muJ = toMu(opponent.rating);
  const phiJ = opponent.rd;

  const EVal = E(mu, muJ, phiJ);
  const gVal = g(phiJ);

  const d2 =
    1 /
    (Q * Q * gVal * gVal * EVal * (1 - EVal));

  const newMu =
    mu +
    (Q / ((1 / (phi * phi)) + (1 / d2))) *
      gVal *
      (score - EVal);

  const newPhi = Math.sqrt(
    1 / ((1 / (phi * phi)) + (1 / d2))
  );

  return {
    rating: Math.round(toRating(newMu)),
    rd: Math.min(newPhi, 350)
  };
}
