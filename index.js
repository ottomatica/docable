#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');

const Select    = require('./lib/select');
const Operators = require('./lib/operators');
const Steps     = require('./lib/steps');

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

async function testreport(mode, argv)
{
    // documents and associated steps; connector to infrastructure provider
    let stepper = new Steps();

    let {docs, conn, provider} = await stepper.read(argv.stepfile);
    let cwd = provider === 'local' ? path.join(process.cwd(), path.dirname(argv.stepfile), 'docable_results') : '.';

    let op = new Operators(conn, cwd);
    let sl = new Select( op );

    console.log(chalk`{bold \nRunning documentation tests:\n}`)

    // Select/translate/perform/assert workflow
    
    let results_dir = path.join(path.dirname(argv.stepfile), 'docable_results');
    if (!fs.existsSync(results_dir)) {
        fs.mkdirSync(results_dir);
    }
    
    for( let doc of docs )
    {
        let engine = doc.engine;
        for( let stepFn of doc.steps )
        {
            await stepFn(engine, sl);
            if( mode == "report")
            {
                fs.writeFileSync(path.join(results_dir, path.basename(doc.file, '.md') + '.html'), engine.html())
            }
        }
    }
    
    // Close spawned processes
    await op.tearDown();
    process.exit()
}