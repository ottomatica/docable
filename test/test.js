const { assert } = require('console');

const spawnSync = require('child_process').spawnSync;
const execSync = require('child_process').execSync;

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

    test('Should fail with fail_when condition', () => {
        let result = spawnSync('node index.js report test/resources/commands/failedWhen.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.status).not.toEqual(0);
    });

    test('Should create simple file with content', () => {
        let result = spawnSync('node index.js report test/resources/commands/file.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stdout.toString()).toMatch('docable');
    });

    test('Should apply edit to file', () => {
        let result = spawnSync('node index.js report test/resources/commands/diff.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
        expect(result.status).toEqual(0);

    });

});

describe('Running basic commands [bakerx/ssh]', () => {

    const HOST = '192.168.99.10';
    let sshConfig = null;
    beforeAll(() => {
        execSync(`bakerx run docable-vm-test bionic-node --ip ${HOST} --memory 1024`, {stdio: 'inherit'});

        sshConfig = JSON.parse(execSync(`bakerx ssh-info docable-vm-test --format json`).toString().trim());
    })

    afterAll(() => {
        // delete test vm
        execSync('bakerx delete vm docable-vm-test');
        
        // // delete test files
        // execSync('rm /tmp/foo /tmp/foo.json /tmp/foo.yml /tmp/app.js');
    });

    test('Should be able to run a simple command', () => {
        let result = spawnSync('node index.js report test/resources/commands/ssh-command.yml', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.status).toEqual(0);
    });
});

