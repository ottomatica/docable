#! /usr/bin/env node
const path  = require('path');
const fs    = require('fs');
const yargs = require('yargs');
const chalk = require('chalk');
const child = require('child_process');
const cheerio = require('cheerio');
const marked = require('marked');


(async()=>{

    // Create VM
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

        console.log( $('.language-php').text() );
    
    });


    // Turn on help and access argv
    yargs.help().argv;

})();