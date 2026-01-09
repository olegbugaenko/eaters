import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { AudioModule } from "./audio.module";

export const createAudioDefinition = (): ServiceDefinition<AudioModule, "audio"> => ({
  token: "audio",
  factory: () => new AudioModule(),
  registerAsModule: true,
});
