#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');

const Select    = require('./lib/select');
const Operators = require('./lib/operators');
const Steps     = require('./lib/steps');
const Parse     = require('./lib/parse');

(async()=>{

    yargs.command('test <stepfile>', 'Test markdown file', (yargs) => { }, async (argv) => {

        // documents and associated steps; connector to infrastructure provider
        let stepper = new Steps();
        let parser   = new Parse();

        let {docs, conn, provider} = await stepper.read(argv.stepfile);
        let cwd = provider === 'local' ? path.join(__dirname, path.dirname(argv.stepfile), 'docable_results') : '.';

        let op = new Operators(conn, cwd);
        let sl = new Select( op );

        console.log(chalk`{bold \nRunning documentation tests:\n}`)

        // Select/translate/perform/assert workflow
        
        for( let doc of docs )
        {
            let md = path.join( path.dirname(argv.stepfile), doc.file);
            let $ = await parser.markdown2HTML(md);
            for( let stepFn of doc.steps )
            {
                await stepFn($,sl);
            }
        }

        // Close spawned processes
        await op.tearDown();
        // process.exit()

    });

    yargs.command('report <stepfile>', 'Test markdown file and report feedback into rendered output', (yargs) => { }, async (argv) => {

        // documents and associated steps; connector to infrastructure provider
        let stepper = new Steps();
        let parser   = new Parse();

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
            let md = path.join( path.dirname(argv.stepfile), doc.file);
            let $ = await parser.markdown2HTML(md);
            for( let stepFn of doc.steps )
            {
                await stepFn($, sl);
                fs.writeFileSync(path.join(results_dir, path.basename(doc.file, '.md') + '.html'), $.html())
            }
        }
        
        // Close spawned processes
        await op.tearDown();
        // process.exit()

    });


    // Turn on help and access argv
    yargs.help().argv;

})();

