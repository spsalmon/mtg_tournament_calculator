import type { GameProfile } from '../core/types';
import mtgRaw from './games/mtg.json';

// The JSON's inferred type widens `max` per row, so a cast is needed to land on
// GameProfile. The shape is asserted by tests in tests/core/structure.test.ts.
export const MTG_PROFILE = mtgRaw as GameProfile;
