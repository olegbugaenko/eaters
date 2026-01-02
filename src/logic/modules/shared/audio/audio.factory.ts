import { ServiceDefinition } from "../../../core/loader/types";
import { AudioModule } from "./audio.module";

export const createAudioDefinition = (): ServiceDefinition<AudioModule> => ({
  token: "audio",
  factory: () => new AudioModule(),
  registerAsModule: true,
});
