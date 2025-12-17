import { createTamagui } from 'tamagui';
import { config } from '@tamagui/config/v3';

// Create the Tamagui config from the base config
// This must be called at module load time before any components use Tamagui
const tamaguiConfig = createTamagui(config);

export default tamaguiConfig;

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

