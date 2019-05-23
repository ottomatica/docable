#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');
const child = require('child_process');
const cheerio = require('cheerio');
const marked = require('marked');

const Select    = require('./lib/select');
const Operators = require('./lib/operators');
const Infra     = require('./lib/infrastructure');

(async()=>{

    yargs.command('test <documentation> <infra>', 'Test markdown file', (yargs) => { }, async (argv) => {

        let markdown = fs.readFileSync( argv.documentation ).toString();
        let infra = argv.infra;

        // Set options
        marked.setOptions({
            renderer: new marked.Renderer(),
            pedantic: false,
            gfm: true,
            tables: true,
            breaks: false,
            sanitize: false,
            smartLists: true,
            smartypants: false,
            xhtml: false
        });

        // Compile
        let html = await marked(markdown);

        console.log(chalk`{bold Translated markdown into html:}`)
        console.log(chalk`{gray ${html}}`);

        const $ = cheerio.load(html)

        // Headless infrastructure (slim)
        //let conn = Connector.getConnector('local');
        // to be replaced by better infra.connectors
        let conn = await Infra.setup('phpx');

        let sl = new Select( new Operators(conn) );

        console.log(chalk`{bold \nRunning documentation tests:\n}`)

        // Select/translate/perform/assert workflow

        // create php content
        await sl.selectAsFile($('.language-php').text(), 'server.php');

        // start server
        await sl.selectAndServe($('p:contains("start it:")').next().text());

        // netcat test
        await sl.selectAndExpect($('p:contains("another terminal:")').next().text());
        
        // force process exit.
        process.exit()

    });


    // Turn on help and access argv
    yargs.help().argv;

})();

