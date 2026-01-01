import { AudioModule } from "../../../../modules/shared/AudioModule";
import { ServiceDefinition } from "../../types";

export const createAudioDefinition = (): ServiceDefinition<AudioModule> => ({
  token: "audio",
  factory: () => new AudioModule(),
  registerAsModule: true,
});
