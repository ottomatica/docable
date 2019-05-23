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
        let conn = Connector.getConnector('slim', 'phpx');
        console.log('Headless infrastructure is:', await conn.getState());

        if( await conn.getState().catch(e => false) === "running" )
        {
        }
        else
        {
            console.log("Preparing headless infrastructure one-time build")
            child.execSync(`slim build ${infra}`, {stdio: 'inherit'});
            child.execSync(`slim delete vm phpx`);
            child.execSync(`slim run phpx ${path.basename(infra)}`);
            conn = Connector.getConnector('slim', 'phpx');
        }

        let op = new Operators(conn);

        console.log(chalk`{bold \nRunning documentation tests:\n}`)

        // Select/translate/perform/assert workflow
        let content = $('.language-php').text();
        await op.file( content, 'server.php');

        let cmd = $('p:contains("start it:")').next().text();
        if( cmd.startsWith("$") )
        {
            cmd = cmd.substr(1).trimLeft();
        }

        // server...
        await op.running(cmd);
        
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
        

        // force process exit.
        process.exit()

    });


    // Turn on help and access argv
    yargs.help().argv;

})();

