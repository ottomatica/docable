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

        let {docs, conn} = await stepper.read(argv.stepfile);
        let sl = new Select( new Operators(conn) );

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
        
        // force process exit (killing child processes when running in local)
        process.exit()

    });


    // Turn on help and access argv
    yargs.help().argv;

})();

