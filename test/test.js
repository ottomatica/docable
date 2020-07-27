const { assert } = require('console');

const spawnSync = require('child_process').spawnSync;

describe('Running basic commands [inline]', () => {

    test('Should be able to run a simple command', () => {
        let result = spawnSync('node index.js report test/resources/commands/command.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
    });


    test('Should fail on bad commands in pipes', () => {
        let result = spawnSync('node index.js report test/resources/commands/badpipe.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).not.toHaveLength(0);
    });
});

