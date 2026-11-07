/**
 * Melview fan stage <-> HomeKit RotationSpeed percentage mapping.
 * Stages used by Melview: 0 (auto), 1, 2, 3, 5, 6.
 */

export function fanStageToPercent(stage: number): number {
  switch (stage) {
    case 1: return 20;
    case 2: return 40;
    case 3: return 60;
    case 5: return 80;
    case 6: return 100;
    default: return 0; // auto
  }
}

export function percentToFanStage(percent: number): number {
  if (percent <= 0) {
    return 0;
  }
  if (percent <= 20) {
    return 1;
  }
  if (percent <= 40) {
    return 2;
  }
  if (percent <= 60) {
    return 3;
  }
  if (percent <= 80) {
    return 5;
  }
  return 6;
}
