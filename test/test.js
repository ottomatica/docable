const { assert } = require('console');
const fs = require('fs');
const os = require('os');
const Connector = require('infra.connectors');

const spawnSync = require('child_process').spawnSync;
const execSync = require('child_process').execSync;


function tmpdir()
{
    if( os.platform()=='win32') return os.tmpdir();
    return '/tmp';    
}

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

    test('Should create simple file with content [relative]', () => {
        let result = spawnSync('node index.js report test/resources/commands/relative_file.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stdout.toString()).toMatch('docable');
    });

    test('Should apply edit to file', () => {
        let result = spawnSync('node index.js report test/resources/commands/diff.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
        expect(result.status).toEqual(0);

    });

    test('Should be able to run a simple command in a shell', () => {
        let result = spawnSync('node index.js report test/resources/commands/shells.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
    });

    test('Should be able to spawn a command', () => {
        let result = spawnSync('node index.js report test/resources/commands/spawn.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
    });

    test('Should be able to run command with multiple lines', () => {
        let result = spawnSync('node index.js report test/resources/commands/multiline.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stderr.toString()).toHaveLength(0);
    });
});

describe('Running edge cases', () => {

    // https://github.com/ottomatica/docable/issues/13
    test('Should be able to select text with inline code', async () => {

        let result = spawnSync('node index.js report test/resources/commands/select-with-inline.yml', { shell:true });

        let content = await fs.promises.readFile(`${tmpdir()}/inline-select-test.txt`);
        expect(content.toString()).toMatch('jekyll serve');

    });

});

describe('Running basic commands [docker]', () => {

    let conn = Connector.getConnector('docker', 'docableContainer');

    test('Run a simple command', async () => {
        await conn.pull('ubuntu:18.04', false);
        if (await conn.containerExists()) await conn.delete();
        await conn.run('ubuntu:18.04', '/bin/bash');

        let result = spawnSync('node index.js report test/resources/docker/command.md', { shell: true });

        await conn.delete();

        expect(result.error).toBeUndefined();
        expect(result.status).toEqual(0);

    }, 60000);

    test('Should create simple file with content', async () => {
        await conn.run('ubuntu:18.04', '/bin/bash');

        let result = spawnSync('node index.js report test/resources/docker/file.md', { shell:true });

        await conn.delete();

        expect(result.error).toBeUndefined();
        expect(result.stdout.toString()).toMatch('docable');
    });

    test('Should perform diff on file', async () => {
        await conn.run('ubuntu:18.04', '/bin/bash');

        let result = spawnSync('node index.js report test/resources/docker/diff.md', { shell:true });

        await conn.delete();

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

