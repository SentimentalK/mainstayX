// Shared geometry for the intro (door) and warp scenes. Low-res px.
import { W } from '../../types';

/** Horizon line of the synthwave backdrop. */
export const HZ = 112;
/** Ground line the door (and Clawd) stand on. */
export const GROUND = 150;

export const DOOR_W = 36;
export const DOOR_H = 60;
export const DOOR_CX = W / 2;
export const DOOR_X = DOOR_CX - DOOR_W / 2;
export const DOOR_Y = GROUND - DOOR_H;
/** Centre of the doorway (the warp zooms into this point). */
export const DOOR_MID_Y = DOOR_Y + DOOR_H / 2;

/** Neon sign box above the door. */
export const SIGN_TEXT = 'MEET MY AI TEAM';
export const SIGN_W = 82;
export const SIGN_H = 11;
export const SIGN_X = DOOR_CX - SIGN_W / 2;
export const SIGN_Y = DOOR_Y - 22;
export const SIGN_TEXT_Y = SIGN_Y + SIGN_H / 2;

/** Lenient "over the door" area for the pointer cursor. */
export const DOOR_HIT = { x: DOOR_X - 14, y: SIGN_Y - 4, w: DOOR_W + 28, h: GROUND + 6 - (SIGN_Y - 4) };

/** Rng fork salt so intro and warp build identical backdrops for a seed. */
export const BACKDROP_SALT = 7;
