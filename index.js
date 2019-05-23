#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');

const Select    = require('./lib/select');
const Operators = require('./lib/operators');
const Infra     = require('./lib/infrastructure');
const Steps     = require('./lib/steps');
const Parse     = require('./lib/parse');

(async()=>{

    yargs.command('test <stepfile>', 'Test markdown file', (yargs) => { }, async (argv) => {

        let kind = 'slim';

        // Headless infrastructure (slim)
        //let conn = Connector.getConnector('local');
        // to be replaced by better infra.connectors
        let conn = await Infra.setup('slim', 'tobefixed', 'phpx');

        let sl = new Select( new Operators(conn) );
        let stepper = new Steps();
        let parser   = new Parse();

        console.log(chalk`{bold \nRunning documentation tests:\n}`)

        // Select/translate/perform/assert workflow
        let docs = await stepper.read(argv.stepfile);
        for( let doc of docs )
        {
            let md = path.join( path.dirname(argv.stepfile), doc.file);
            let $ = await parser.markdown2HTML(md);
            for( let stepFn of doc.steps )
            {
                await stepFn($,sl);
            }
        }

        // // create php content
        // await sl.selectAsFile($('.language-php').text(), 'server.php');

        // // start server
        // await sl.selectAndServe($('p:contains("start it:")').next().text());

        // // netcat test
        // await sl.selectAndExpect($('p:contains("another terminal:")').next().text());
        
        // force process exit.
        process.exit()

    });


    // Turn on help and access argv
    yargs.help().argv;

})();

