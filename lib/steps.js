const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');

const Infra     = require('./infrastructure');
const Parse     = require('./parse');


class Steps {
 
    constructor() 
    {
    }

    async read(stepFile)
    {
        let document = await yaml.safeLoad(fs.readFileSync(stepFile));
        let provider = Object.keys(document.setup)[0];
        return {docs: await this.documents(document, path.dirname(stepFile)), conn: await this.setup(document, stepFile), provider};
    }

    async setup(doc, stepFile)
    {
        let provider = Object.keys(doc.setup)[0];
        // Headless infrastructure (slim)
        let conn = Infra.select( doc, provider, path.dirname(stepFile))
        return conn;
    }

    async documents(doc, cwd)
    {
        let docs = [];
        let parser   = new Parse();

        for ( let topLevelProperty of Object.keys(doc))
        {
            if( topLevelProperty.endsWith(".md") )
            {
                console.log(cwd, topLevelProperty)
                let md = path.join(cwd, topLevelProperty);
                let {engine, metadata} = await parser.markdown2HTML(md);

                if( doc[topLevelProperty].steps )
                {
                    let docSteps = [];
                    if( doc[topLevelProperty].steps == "inline" )
                    {
                        let code =  Object.keys(metadata)[0];
                        let file = metadata[code].content;
                        // Use metadata to construct steps.
                        docSteps.push( ($,sl) => this._setResults(() => $('.code'), sl.selectAsFile( code, file )));
                    }
                    else
                    {
                        docSteps = await this.documentSteps( doc[topLevelProperty] );
                    }
                    docs.push( {file: topLevelProperty, steps: docSteps, engine: engine} );
                }
            }
        }
        return docs;
    }

    async documentSteps(doc)
    {
        let steps = [];

        for( let step of doc.steps )
        {
            if( step instanceof Object )
            {
                let key = Object.keys(step)[0];
                switch( key )
                {
                    case "selectAsFile":
                    {
                        let searchText = step[key].split("=>")[0];
                        let file = step[key].split("=>")[1];

                        steps.push( ($,sl) => this._setResults(() => sl.asContainsNext($, searchText), sl.selectAsFile( sl.asContainsNext($, searchText), file )));
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => this._setResults(() => sl.asContainsNext($, searchText), sl.selectAndServe( sl.asContainsNext($, searchText) )));
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => this._setResults(() => sl.asContainsNext($, searchText), sl.selectAndExpect( sl.asContainsNext($, searchText))) );
                        break;
                    }
                    default:
                        throw new Error(`Unknown step: ${step}`);
                }
            }
        }

        return steps;
    }

    async _setResults(selector, results)
    {
        let response = await results;
        if(response.status)
            this._setPassing(selector);
        else
            this._setFailing(selector, response.error);
        return selector;
    }

    async _setPassing(selector) 
    {
        const content = await selector().text();
        await selector().text('✓ ' + content);
        await selector().css('background-color', '#BDFCC9');
    }

    async _setFailing(selector, error)
    {
        const content = await selector().text();
        await selector().text('𐄂 ' + content + "\n\n" + error);
        await selector().css('background-color', 'LightCoral');
    }
}


module.exports = Steps;