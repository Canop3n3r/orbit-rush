// Physical constants for the full-scale Earth (WGS84 equatorial radius) and the game's reference lines.
export const R_E = 6378137;            // m, WGS84 equatorial radius
export const MU_E = 3.986004418e14;    // m^3/s^2, Earth's gravitational parameter (GM)
export const OMEGA_E = 7.2921159e-5;   // rad/s, sidereal rotation rate
export const G0 = 9.80665;             // m/s^2, standard gravity (defines specific impulse)
export const KARMAN = 100000;          // m, the Kármán line: the conventional edge of space
export const ATM_TOP = 1000000;        // m, density is treated as zero above this
export const RAILS_ALT = 140000;       // m, above this a coasting craft can be put "on rails" (Kepler orbit)
export const P0 = 101325;              // Pa, sea-level standard pressure
// surface gravity from inverse-square: g(h) = MU_E / (R_E + h)^2  (9.798 m/s^2 at the equator, sea level)
export const gravityAt = h => MU_E / ((R_E + h) * (R_E + h));
