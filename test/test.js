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

    test('Should create simple file with content', () => {
        let result = spawnSync('node index.js report test/resources/commands/file.md', { shell:true });

        expect(result.error).toBeUndefined();
        expect(result.stdout.toString()).toMatch('docable');
    });
});

// describe('Running basic commands [bakerx/ssh]', () => {

//     const HOST = '192.168.33.10';
//     let sshConfig = null;
//     beforeAll(() => {
//         execSync('bakerx pull ottomatica/bakerx#images bionic-node', {stdio: 'inherit'});
//         execSync(`bakerx run opunit-test-vm bionic-node --ip ${HOST} --memory 1024 --up test/resources/init.sh`, {stdio: 'inherit'});

//         sshConfig = JSON.parse(execSync(`bakerx ssh-info opunit-test-vm --format json`).toString().trim());
//     })

//     afterAll(() => {
//         // delete test vm
//         execSync('bakerx delete vm opunit-test-vm');
        
//         // delete test files
//         execSync('rm /tmp/foo /tmp/foo.json /tmp/foo.yml /tmp/app.js');
//     });

//     test('Should be able to run a simple command', () => {
//         let result = spawnSync('node index.js report test/resources/commands/command.yml', { shell:true });

//         expect(result.error).toBeUndefined();
//         expect(result.stderr.toString()).toHaveLength(0);
//     });


//     test('Should fail on bad commands in pipes', () => {
//         let result = spawnSync('node index.js report test/resources/commands/badpipe.yml', { shell:true });

//         expect(result.error).toBeUndefined();
//         expect(result.stderr.toString()).not.toHaveLength(0);
//     });

//     test('Should create simple file with content', () => {
//         let result = spawnSync('node index.js report test/resources/commands/file.yml', { shell:true });

//         expect(result.error).toBeUndefined();
//         expect(result.stdout.toString()).toMatch('docable');
//     });

// });

