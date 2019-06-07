const cheerio = require('cheerio');
const marked = require('marked');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');

class Parse
{
    async markdown2HTML( file, renderer = undefined )
    {
        // Simplifying assumption: Never a duplicate code block in same tutorial.
        let metadata = {};
        let html = await this.render(file, metadata, renderer);

        console.log(chalk`{bold Translated markdown into html:}`)
        console.log(chalk`{gray ${html}}`);

        let $ = cheerio.load(html)

        let highlightjs = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.6/styles/default.min.css">
                            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.6/highlight.min.js"></script>
                            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/3.0.1/github-markdown.min.css">`;

        let width = `<style>
                        .markdown-body {
                            box-sizing: border-box;
                            min-width: 200px;
                            max-width: 980px;
                            margin: 0 auto;
                            padding: 45px;
                        }
                    
                        @media (max-width: 767px) {
                            .markdown-body {
                                padding: 15px;
                            }
                        }
                    </style>`;

        $('head').append(highlightjs);
        $('head').append(width);
        $('body').addClass('markdown-body')

        // console.log( metadata );

        return {engine: $, metadata: metadata };
    }

    async render(file, metadata, renderer) {
        let html;
        if(renderer) {
            html = renderer.parser(file);
        } 
        
        // if renderer is not provided, use marked.parser() by default
        else {
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
            let parsedTokens = this.tokenize(file, metadata);
            html = await marked.parser(parsedTokens);
        }
        return html;
    }

    // Parse tokens
    tokenize(file, metadata) {
        let markdown = fs.readFileSync( file ).toString();
        let tokens = marked.lexer(markdown);
        let parsedTokens = [];
        let index = 1;
        for( let t of tokens )
        {
            if( t.type == "code" && t.lang )
            {
                let data = t.lang.indexOf("|") >= 0 ? t.lang.split('|') : [];
                let metaObj = {};
                let lang = data.length > 0 ? data[0] : "";
                metaObj.codeIndex = index++;

                for( let propertyFragment of data )
                {
                    if( propertyFragment.indexOf("=") >= 0)
                    {
                        let property = propertyFragment.split("=")[0].trim();
                        let val = propertyFragment.split("=")[1].trim();
                        metaObj[property] = val;
                    }
                    else {
                        metaObj[propertyFragment] = propertyFragment;
                    }
                    metadata[t.text] = metaObj;
                }
                // Remove metadata
                t.lang = lang;
            }
            parsedTokens.push(t);
        }
        parsedTokens.links = tokens.links;
        return parsedTokens;
    }
}

module.exports = Parse;