#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');
const child = require('child_process');
const cheerio = require('cheerio');
const marked = require('marked');

const Operators = require('./lib/operators');
const Connector = require('infra.connectors');

(async()=>{

    yargs.command('test <documentation>', 'Test markdown file', (yargs) => { }, async (argv) => {

        let markdown = fs.readFileSync( argv.documentation ).toString();

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
        console.log(chalk`{gray ${html}}`);

        const $ = cheerio.load(html)

        // Headless infrastructure
        let conn = Connector.getConnector('local');
        let op = new Operators(conn);

        // Select/translate/perform/assert workflow
        let content = $('.language-php').text();
        await op.file( content, 'server.php');

        let cmd = $('p:contains("start it:")').next().text();
        if( cmd.startsWith("$") )
        {
            cmd = cmd.substr(1).trimLeft();
        }

        // server...
        //await op.running(cmd);

        // netcat test
        let netcatCmd = $('p:contains("another terminal:")').next().text();
        
        // The first line is command, the second is input for the command.
        // The third line is the expected output.
        let lines = netcatCmd.split('\n');
        let expect = lines[1].trimRight();
        lines.splice(1,1);
        let toRun = lines.join('\n') + "\n\n";

        if( toRun.startsWith("$") )
        {
            toRun = toRun.substr(1).trimLeft();
        }

        let serverResponse = await op.run(toRun);

        if(serverResponse.trimRight() != expect )
        {
            console.log(chalk`{red expected ${serverResponse} == ${expect}}`);
        }
        else{
            console.log(chalk`{green Received expected response: ${serverResponse}}`);
        }

    });


    // Turn on help and access argv
    yargs.help().argv;

})();