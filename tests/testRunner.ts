export type TestFunction = () => void | Promise<void>;

interface RegisteredTest {
  name: string;
  fn: TestFunction;
}

const tests: RegisteredTest[] = [];
const suiteStack: string[] = [];

export const describe = (name: string, fn: () => void): void => {
  suiteStack.push(name);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
};

export const test = (name: string, fn: TestFunction): void => {
  const fullName = [...suiteStack, name].join(" › ");
  tests.push({ name: fullName, fn });
};

export const run = async (): Promise<void> => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${name}`);
      console.error(error);
    }
  }
  if (tests.length === 0) {
    console.warn("No tests registered.");
    return;
  }
  if (failures > 0) {
    throw new Error(`${failures} test${failures === 1 ? "" : "s"} failed.`);
  }
  console.log(`${tests.length} test${tests.length === 1 ? "" : "s"} passed.`);
};
