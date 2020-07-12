const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const Parse     = require('./markdownParser');
const Setup     = require('./setup');
const { select } = require('../infra/infrastructure');

class StepsReader {
 
    constructor(renderer, selector, css) 
    {
        this.renderer = renderer;
        this.css = css;
        if (selector) this.codeBlockSelector = selector;
    }

    async read(stepFile)
    {
        let setup = new Setup();

        let document = await yaml.safeLoad(fs.readFileSync(stepFile));
        let {conn, cwd, docPath, targets, clean, verify} = await setup.setup(document, stepFile);

        return {docs: await this.documents(document, docPath), conn, cwd, targets, clean, verify};
    }

    async readNotebook(notebook) {
        // TODO: extract conn type etc from notebook metadata
        // for now using ssh connector.

        const setup = new Setup();
        const conn = await setup.setupNotebook();
        const { cells, $ } = await this.notebookCells(notebook);

        return { conn, cells, $ };
    }

    async documents(doc, cwd)
    {
        let docs = [];
        let parser   = new Parse(this.css);

        for ( let topLevelProperty of Object.keys(doc))
        {
            if( topLevelProperty.endsWith(".md") )
            {
                console.log(cwd, topLevelProperty)
                let md = path.join(cwd, topLevelProperty);
                let {engine, metadata} = await parser.markdown2HTML(md, this.renderer, cwd);

                if( doc[topLevelProperty].steps )
                {
                    let docSteps = [];
                    if( doc[topLevelProperty].steps == "inline" )
                    {
                        // Use metadata to construct steps.
                        docSteps = await this.annotationSteps(metadata);
                    }
                    else
                    {
                        docSteps = await this.documentSteps( doc[topLevelProperty] );
                    }
                    docs.push( {file: topLevelProperty, steps: docSteps, engine: engine} );
                }
            } else if(topLevelProperty.endsWith('.html')) {
                console.log(cwd, topLevelProperty)
                let html = path.join(cwd, topLevelProperty);
                let { engine } = await parser.parseHTML(html, cwd);


                if (doc[topLevelProperty].steps) {
                    let docSteps = [];
                    docSteps = await this.documentSteps(doc[topLevelProperty]);
                    docs.push({ file: topLevelProperty, steps: docSteps, engine: engine });
                }
            }
        }
        return docs;
    }

    async annotationSteps(metadata)
    {
        let steps = [];
        for( let code of Object.keys(metadata) )
        {
            let file = metadata[code].content;
            let expect = metadata[code].expect;
            let serve  = metadata[code].serve;
            let run  = metadata[code].run;
            let user = metadata[code].user;
            let persistent = metadata[code].persistent;
            let target     = metadata[code].target;

            console.log( metadata[code] );
            console.log( code );

            if( file )
            {
               steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAsFile( code, file, user, target )));
            }
            else if( serve )
            {
                steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAndServe( code, user, persistent, target )));
            }
            else if( expect )
            {
                steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAndExpect( code, user, persistent, target )));
            }
            else if( run )
            {
                steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAndRun( code, user, persistent, target )) );
            }
        }
        return steps;
    }

    async documentSteps(doc)
    {
        let steps = [];

        for( let step of doc.steps )
        {
            if( step instanceof Object )
            {
                let key;
                let user;
                let persistent;
                let target;
                let permission;

                for (const k of Object.keys(step)) {
                    if (k === 'user') user = step[k];
                    else if (k === 'persistent') persistent = step[k]
                    else if (k === 'target') target = step[k]
                    else if (k === 'permission') permission = step[k]
                    else key = k
                }

                switch( key )
                {
                    case "selectAsFile":
                    {
                        let searchText, file;
                        if (step[key].permission && step[key].select) {
                            [searchText, file] = step[key].select.split("=>").map(step => step.trim());
                            permission = step[key].permission;
                        } else {
                            [searchText, file] = step[key].split("=>").map(step => step.trim());
                        }

                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAsFile( sl.asContainsNext($, searchText), file, user, target, permission )));
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndServe( sl.asContainsNext($, searchText), user, persistent, target )));
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndExpect( sl.asContainsNext($, searchText), user, persistent, target )) );
                        break;
                    }
                    case "selectAndRun":
                    {
                        // responding to interactive prompts
                        let opts = {};
                        let selectSearchText;
                        if (step[key].input && step[key].select) {
                            opts.prompts = [];
                            if (typeof (step[key].input) == 'object') {
                                step[key].input.forEach(input => {
                                    let [prompt, answer] = input.split('=>').map(i => i.trim());
                                    opts.prompts.push({ prompt, answer })
                                })
                            }
                            else {
                                let [prompt, answer] = step[key].input.split('=>').map(i => i.trim());
                                opts.prompts = [{ prompt, answer }]
                            }

                            selectSearchText = step[key].select;
                        }

                        if( step[key].expectblock && step[key].select )
                        {
                            let searchText = step[key].select;
                            steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText).add(sl.asContainsNextElement($, step[key].expectblock)), await sl.selectAndExpect( sl.asContainsNext($, searchText), sl.asContainsNext($, step[key].expectblock), user, persistent, target, opts )) );
                            break;
                        }
                        else
                        {
                            let searchText = selectSearchText || step[key];
                            steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndRun( sl.asContainsNext($, searchText), user, persistent, target, opts )) );
                            break;
                        }
                    }
                    default:
                        throw new Error(`Unknown step: ${step}`);
                }
            }
        }

        return steps;
    }

    async notebookCells(notebook) {
        let cells = [];

        const $ = cheerio.load(notebook);
        $('[data-docable="true"]').each(function (index, elem) {
            cells.push({
                index,
                content: $(elem).text(),
                ...$(elem).data(),
                elem
            });
        });

        return { cells, $ };
    }

    codeBlockSelector($, N) {
        return () => $(`pre:nth-of-type(${N})`);
    }

    async _setResults(selector, results)
    {
        let response = results;
        if( !response) return;


        if(response.status)
            await this._setPassing(selector);
        else
            await this._setFailing(selector, response );
        return results;
    }

    async _setPassing(selector)
    {
        selector = typeof selector == 'function' ? selector() : selector;
        selector.prepend('<span>✓ </span>');
        selector.addClass('passing');
    }

    async _setFailing(selector, response)
    {
        selector = typeof selector == 'function' ? selector() : selector;
        selector.prepend('<span>𐄂 </span>');
        selector.append(`<br/><br/>`);
        selector.append(`<span>️ error: ${response.error || response.stderr}</span> </br>`);
        selector.append(`<span> exit code: ${response.exitCode}</span> </br>`);
        selector.append(`<span> command output: ${response.stdout || '""'}</span> </br>`);
        selector.addClass('failing');
    }
}

module.exports = StepsReader;
