#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');

const Select    = require('./lib/test/select');
const Operators = require('./lib/infra/operators');
const Steps     = require('./lib/read/stepsReader');

(async()=>{

    yargs.command('test <stepfile>', 'Test markdown file', (yargs) => { }, async (argv) => {

        await testreport("test", argv);

    });

    yargs.command('report <stepfile>', 'Test markdown file and report feedback into rendered output', (yargs) => { }, async (argv) => {

        await testreport("report", argv);

    });


    // Turn on help and access argv
    yargs.help().argv;

})();

async function testreport(mode, argv, options = {rendered: undefined, selector: undefined, css: undefined, textSelector: undefined})
{
    // documents and associated steps; connector to infrastructure provider
    let stepper = new Steps(options.renderer, options.selector, options.css);

    let {docs, conn, cwd, targets, clean, verify} = await stepper.read(argv.stepfile);

    console.log(`Using cwd ${cwd}`);
    let op = new Operators(conn, cwd,targets);
    let sl = new Select( op, options.textSelector );

    console.log(chalk`{bold \nRunning documentation tests:\n}`)

    // Select/translate/perform/assert workflow
    
    let results_dir = path.join(path.dirname(argv.stepfile), 'docable_results');
    if (!fs.existsSync(results_dir)) {
        fs.mkdirSync(results_dir);
    }

    let results = [];
    for( let doc of docs )
    {
        let engine = doc.engine;
        for( let stepFn of doc.steps )
        {
            let result = await stepFn(engine, sl);
            results.push(result);
        }

        if (verify) {
            verifyOut = await op.run(verify);
            console.log(chalk`{${verifyOut.exitCode == 0 ? 'green' : 'red'} ${verifyOut.stdout + '\n' + verifyOut.stderr}}`);
            doc.engine('body').append(`<h2>docable verification results</h2><div class="verify ${verifyOut.exitCode == 0 ? 'passing' : 'failing'}">$ ${verify}\n${verifyOut.stdout}\n${verifyOut.stderr}</div>`);
        }

        if (mode == "report") {
            let reportHtml = path.join(results_dir, path.basename(doc.file, '.md') + '.html');
            fs.writeFileSync(reportHtml, doc.engine.html())
            console.log(`Generated report ${reportHtml}`);
        }
    }

    // Close spawned processes
    console.log('cleaning up...');
    await op.tearDown(targets);
    await op.run(clean);
    

    let exitCode = 0;
    if(results.filter(result => result.status == false).length > 0) exitCode = 1;

    process.exit(exitCode);
}

module.exports = testreport;