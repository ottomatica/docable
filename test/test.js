const { assert } = require('console');

const spawnSync = require('child_process').spawnSync;

describe('Executing remote instructions', () => {
    test('On local host', () => {
        let result = spawnSync('node index.js report examples/remote/steps.yml', { shell:true });

        // console.log(result);

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
    });
});

