// ─── 预设注册入口 ───
// 所有预设在此导入注册，容器通过 registry 发现

import { registerPreset } from "./registry";
import { preset as warpStars } from "./WarpStars";
import { preset as cosmicWarp } from "./CosmicWarp";
import { preset as blackHole } from "./BlackHole";
import { preset as supernova } from "./Supernova";
import { preset as auroraSummit } from "./AuroraSummit";
import { preset as wormhole } from "./Wormhole";
import { preset as pulsar } from "./Pulsar";
import { preset as solarStorm } from "./SolarStorm";
import { preset as quantumOcean } from "./QuantumOcean";
import { preset as darkFlow } from "./DarkFlow";
import { preset as cyberRing } from "./CyberRing";
import { preset as neonCity } from "./NeonCity";
import { preset as dataStream } from "./DataStream";
import { preset as nebulaBirth } from "./NebulaBirth";

registerPreset(warpStars.definition.id, warpStars);
registerPreset(cosmicWarp.definition.id, cosmicWarp);
registerPreset(blackHole.definition.id, blackHole);
registerPreset(supernova.definition.id, supernova);
registerPreset(auroraSummit.definition.id, auroraSummit);
registerPreset(wormhole.definition.id, wormhole);
registerPreset(pulsar.definition.id, pulsar);
registerPreset(solarStorm.definition.id, solarStorm);
registerPreset(quantumOcean.definition.id, quantumOcean);
registerPreset(darkFlow.definition.id, darkFlow);
registerPreset(cyberRing.definition.id, cyberRing);
registerPreset(neonCity.definition.id, neonCity);
registerPreset(dataStream.definition.id, dataStream);
registerPreset(nebulaBirth.definition.id, nebulaBirth);

export {
  getPresetDefinitions,
  getPresetDefinition,
  getPresetRenderer,
  getPresetIds,
  getDefaultPresetId,
} from "./registry";

export type {
  PresetDefinition,
  PresetModule,
  PresetRenderer,
} from "./types";
