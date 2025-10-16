let instancedParticlesEnabled = false;

export const setInstancedParticlesEnabled = (enabled: boolean): void => {
  instancedParticlesEnabled = !!enabled;
};

export const getInstancedParticlesEnabled = (): boolean => instancedParticlesEnabled;


