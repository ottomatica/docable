const { assert } = require('console');

const spawnSync = require('child_process').spawnSync;

describe('Executing remote instructions', () => {
    test('On local host', () => {
        let result = spawnSync('node index.js report examples/remote/steps.yml', { shell:true, stdio: 'inherit' });

        expect(result.error).toBeUndefined();
    });
});

