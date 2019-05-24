const cheerio = require('cheerio');
const marked = require('marked');
const fs = require('fs');
const chalk = require('chalk');

class Parse
{
    async markdown2HTML( file )
    {
        let markdown = fs.readFileSync( file ).toString();

        // Set options
        marked.setOptions({
            renderer: new marked.Renderer(),
            highlight: function(code) {
                return require('highlight.js').highlightAuto(code).value;
            },            
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

        let $ = cheerio.load(html)

        let highlightjs = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.6/styles/default.min.css">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.6/highlight.min.js"></script>`
        $('head').append(highlightjs);

        return $;
    }
}

module.exports = Parse;