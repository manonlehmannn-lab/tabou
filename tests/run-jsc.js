// Lance les tests dans JavaScriptCore (le moteur de Safari) : tools/test.sh
import { run } from './harness.js';
import './engine.test.js';
import './cards.test.js';

const { failed } = await run();
if (failed) quit(1);
